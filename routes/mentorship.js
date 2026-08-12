import { Router } from 'express';
import { randomBytes } from 'crypto';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

const MIN_DAYS = 1;
const MAX_DAYS = 180;

const SESSION_TYPES = ['VIDEO', 'CHAT', 'IN_PERSON'];

function normalizeSessionType(value) {
  const raw = String(value || 'VIDEO').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return SESSION_TYPES.includes(raw) ? raw : 'VIDEO';
}

function parseDaysFromString(duration) {
  const d = (duration || '').toLowerCase();
  const m = d.match(/(\d+)\s*day/);
  if (m) return Math.max(MIN_DAYS, Math.min(MAX_DAYS, Number(m[1])));
  if (d.includes('month')) return 30;
  if (d.includes('week')) return 7;
  if (d.includes('year')) return 180;
  return 30;
}

function formatDuration(days) {
  if (days === 1) return '1 day';
  return `${days} days`;
}

function normalizeDuration(body) {
  let days = null;
  let display = null;
  if (body.durationDays !== undefined) {
    days = Math.round(Number(body.durationDays));
    if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) {
      throw new Error(`Duration must be between ${MIN_DAYS} day and ${MAX_DAYS} days`);
    }
    display = formatDuration(days);
  } else if (body.duration) {
    days = parseDaysFromString(body.duration);
    display = body.duration;
  }
  return { days, display };
}

function endDateFromStart(start, days) {
  const d = new Date(start);
  d.setDate(d.getDate() + (days || 30));
  return d;
}

router.get('/mentees', authenticate, async (req, res) => {
  try {
    const requests = await prisma.mentorshipRequest.findMany({
      where: { mentorId: req.userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: {
        mentee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role === 'mentor') where.mentorId = req.userId;
    else if (role === 'mentee') where.menteeId = req.userId;
    else where.OR = [{ mentorId: req.userId }, { menteeId: req.userId }];

    const requests = await prisma.mentorshipRequest.findMany({
      where,
      include: {
        mentor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        mentee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { mentorId, message } = req.body;
    const sessionType = normalizeSessionType(req.body.sessionType);
    let durationDays;
    let duration;
    try {
      ({ days: durationDays, display: duration } = normalizeDuration(req.body));
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const mentor = await prisma.user.findUnique({ where: { id: Number(mentorId) } });
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    if (!mentor.isMentorProfileComplete) {
      return res.status(400).json({ error: 'This user is not a mentor' });
    }
    const existing = await prisma.mentorshipRequest.findFirst({
      where: { mentorId, menteeId: req.userId, status: 'PENDING' },
    });
    if (existing) {
      return res.status(400).json({ error: 'You already have a pending request with this mentor' });
    }
const request = await prisma.mentorshipRequest.create({
      data: {
        message,
        duration,
        durationDays,
        sessionType,
        mentor: { connect: { id: mentorId } },
        mentee: { connect: { id: req.userId } },
      },
      include: {
        mentor: { select: { id: true, fullName: true, email: true } },
        mentee: { select: { id: true, fullName: true, email: true } },
      },
    });
    await prisma.notification.create({
      data: {
        userId: mentorId,
        type: 'mentorship_request',
        message: `${req.userFullName || 'A mentee'} sent you a ${sessionType.toLowerCase().replace('_', ' ')} mentorship request.`,
        linkTo: '/profile',
      },
    });
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    const existing = await prisma.mentorshipRequest.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!existing) return res.status(404).json({ error: 'Request not found' });
    if (!['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const data = { status };
    if (status === 'ACTIVE') {
      const startDate = existing.startDate || new Date();
      const days = existing.durationDays || parseDaysFromString(existing.duration);
      data.startDate = startDate;
      data.endDate = endDateFromStart(startDate, days);
      data.startedAt = new Date();
      if (existing.durationDays === null) data.durationDays = days;
    }
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      data.endedAt = new Date();
    }

    const request = await prisma.mentorshipRequest.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        mentor: { select: { id: true, fullName: true, email: true } },
        mentee: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (status === 'ACTIVE') {
      const conv = await prisma.conversation.create({ data: { type: 'direct' } });
      await prisma.conversationParticipant.createMany({
        data: [
          { conversationId: conv.id, userId: request.mentorId },
          { conversationId: conv.id, userId: request.menteeId },
        ],
      });

      let meetingId = request.meetingId;
      let meetingTitle = null;
      if (!meetingId && (request.sessionType || 'VIDEO') === 'VIDEO') {
        const meeting = await prisma.meeting.create({
          data: {
            creatorId: request.mentorId,
            title: `${request.mentor.fullName} × ${request.mentee.fullName} — Mentorship Session`,
            description: 'Mentorship video call created from an accepted mentorship request.',
            startAt: new Date(),
            type: 'video',
            roomName: `mconnect-mtg-${randomBytes(6).toString('hex')}`,
            status: 'ongoing',
            activeUserIds: [request.mentorId],
            participants: {
              create: [
                { userId: request.mentorId },
                { userId: request.menteeId },
              ],
            },
          },
        });
        meetingId = meeting.id;
        meetingTitle = meeting.title;
        await prisma.mentorshipRequest.update({
          where: { id: request.id },
          data: { meetingId: meeting.id },
        });
      }

      await prisma.notification.create({
        data: {
          userId: request.menteeId,
          type: 'mentorship_request',
          message: meetingId
            ? `${request.mentor.fullName} accepted your video mentorship request! Join the call: ${meetingTitle}`
            : `${request.mentor.fullName} accepted your mentorship request!`,
          linkTo: meetingId ? `/meetings/${meetingId}` : '/profile',
        },
      });

      const fresh = await prisma.mentorshipRequest.findUnique({
        where: { id: request.id },
        include: {
          mentor: { select: { id: true, fullName: true, email: true } },
          mentee: { select: { id: true, fullName: true, email: true } },
        },
      });
      return res.json(fresh);
    }
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const existing = await prisma.mentorshipRequest.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!existing) return res.status(404).json({ error: 'Request not found' });
    if (existing.mentorId !== req.userId && existing.menteeId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const request = await prisma.mentorshipRequest.update({
      where: { id: Number(req.params.id) },
      data: { status: 'COMPLETED', endedAt: new Date() },
      include: {
        mentor: { select: { id: true, fullName: true, email: true } },
        mentee: { select: { id: true, fullName: true, email: true } },
      },
    });
    await prisma.notification.create({
      data: {
        userId: existing.mentorId === req.userId ? existing.menteeId : existing.mentorId,
        type: 'mentorship_request',
        message: `Mentorship with ${req.userFullName || 'your partner'} has been completed.`,
        linkTo: '/profile',
      },
    });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

