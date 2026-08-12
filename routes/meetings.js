import { Router } from 'express';
import { randomBytes } from 'crypto';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

const includeAll = {
  creator: { select: { id: true, fullName: true, avatarUrl: true } },
  participants: {
    include: { user: { select: { id: true, fullName: true, avatarUrl: true, isMentorProfileComplete: true } } },
  },
};

router.get('/', authenticate, async (req, res) => {
  try {
    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { creatorId: req.userId },
          { participants: { some: { userId: req.userId } } },
        ],
      },
      include: includeAll,
      orderBy: { startAt: 'asc' },
    });
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: Number(req.params.id) },
      include: includeAll,
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const isCreator = meeting.creatorId === req.userId;
    const isParticipant = meeting.participants.some((p) => p.userId === req.userId);
    if (!isCreator && !isParticipant) {
      return res.status(403).json({ error: 'You are not part of this meeting' });
    }
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, startAt, type, participantIds, startNow } = req.body;

    const creator = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!creator?.isMentorProfileComplete) {
      return res.status(403).json({ error: 'Only mentors can create meetings' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Meeting title is required' });
    }
    if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
      return res.status(400).json({ error: 'A valid meeting time is required' });
    }
    const inviteeIds = [...new Set((participantIds || []).map(Number))].filter(
      (id) => id !== req.userId
    );

    const meeting = await prisma.meeting.create({
      data: {
        creatorId: req.userId,
        title: title.trim(),
        description: description || '',
        startAt: new Date(startAt),
        type: type === 'audio' ? 'audio' : 'video',
        roomName: `mconnect-mtg-${randomBytes(6).toString('hex')}`,
        status: startNow ? 'ongoing' : 'scheduled',
        activeUserIds: startNow ? [req.userId] : [],
        participants: {
          create: inviteeIds.map((userId) => ({ userId })),
        },
      },
      include: includeAll,
    });

    await Promise.all(
      inviteeIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: 'meeting_invite',
            message: `${creator.fullName} invited you to a meeting: ${meeting.title}`,
            linkTo: `/meetings/${meeting.id}`,
          },
        })
      )
    );

    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getAccessibleMeeting(meetingId, userId) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: Number(meetingId) },
    include: includeAll,
  });
  if (!meeting) return null;
  const isCreator = meeting.creatorId === userId;
  const isParticipant = meeting.participants.some((p) => p.userId === userId);
  if (!isCreator && !isParticipant) {
    const err = new Error('You are not part of this meeting');
    err.status = 403;
    throw err;
  }
  return meeting;
}

router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const meeting = await getAccessibleMeeting(req.params.id, req.userId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: 'ongoing',
        activeUserIds: [...new Set([...(meeting.activeUserIds || []), req.userId])],
      },
      include: includeAll,
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const meeting = await getAccessibleMeeting(req.params.id, req.userId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.status === 'cancelled') {
      return res.status(400).json({ error: 'This meeting is cancelled' });
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: meeting.status === 'ended' ? 'ongoing' : meeting.status,
        activeUserIds: [...new Set([...(meeting.activeUserIds || []), req.userId])],
      },
      include: includeAll,
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/leave', authenticate, async (req, res) => {
  try {
    const meeting = await getAccessibleMeeting(req.params.id, req.userId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const activeUserIds = (meeting.activeUserIds || []).filter((id) => id !== req.userId);
    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        activeUserIds,
        status: activeUserIds.length === 0 ? 'ended' : meeting.status,
      },
      include: includeAll,
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/end', authenticate, async (req, res) => {
  try {
    const meeting = await getAccessibleMeeting(req.params.id, req.userId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Only the meeting creator can end it' });
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'ended', activeUserIds: [] },
      include: includeAll,
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/invite', authenticate, async (req, res) => {
  try {
    const { participantIds } = req.body;
    const meeting = await prisma.meeting.findUnique({
      where: { id: Number(req.params.id) },
      include: includeAll,
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const isCreator = meeting.creatorId === req.userId;
    const isParticipant = meeting.participants.some((p) => p.userId === req.userId);
    if (!isCreator && !isParticipant) {
      return res.status(403).json({ error: 'You are not part of this meeting' });
    }
    if (meeting.status === 'cancelled') {
      return res.status(400).json({ error: 'This meeting is cancelled' });
    }

    const inviter = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!inviter?.isMentorProfileComplete) {
      return res.status(403).json({ error: 'Only mentors can add participants' });
    }

    const requests = await prisma.mentorshipRequest.findMany({
      where: { mentorId: req.userId, status: 'ACTIVE' },
      select: { menteeId: true },
    });
    const myMenteeIds = new Set(requests.map((r) => r.menteeId));

    const candidateIds = [...new Set((participantIds || []).map(Number))];
    const alreadyInvited = new Set([
      meeting.creatorId,
      ...meeting.participants.map((p) => p.userId),
    ]);

    const validIds = [];
    for (const id of candidateIds) {
      if (id === req.userId || alreadyInvited.has(id)) continue;
      if (myMenteeIds.has(id)) {
        validIds.push(id);
      } else if (isCreator) {
        const target = await prisma.user.findUnique({ where: { id } });
        if (target?.isMentorProfileComplete) {
          validIds.push(id);
        }
      }
    }
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid participants to add' });
    }

    await prisma.meetingParticipant.createMany({
      data: validIds.map((userId) => ({ meetingId: meeting.id, userId })),
      skipDuplicates: true,
    });

    await Promise.all(
      validIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: 'meeting_invite',
            message: `${inviter.fullName} added you to a meeting: ${meeting.title}`,
            linkTo: `/meetings/${meeting.id}`,
          },
        })
      )
    );

    const updated = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: includeAll,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: Number(req.params.id) },
      include: includeAll,
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Only the meeting creator can cancel it' });
    }

    const updated = await prisma.meeting.update({
      where: { id: Number(req.params.id) },
      data: { status: 'cancelled' },
      include: includeAll,
    });

    await Promise.all(
      meeting.participants.map((p) =>
        prisma.notification.create({
          data: {
            userId: p.userId,
            type: 'meeting_cancelled',
            message: `${meeting.creator.fullName} cancelled the meeting "${meeting.title}".`,
            linkTo: `/meetings/${meeting.id}`,
          },
        })
      )
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
