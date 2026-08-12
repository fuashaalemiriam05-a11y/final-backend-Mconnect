import { Router } from 'express';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

router.get('/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalMentors, totalMentees, totalSessions, pendingRequests, pendingReports, suspendedUsers, totalPosts, totalMessages] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isMentorProfileComplete: true } }),
      prisma.user.count({ where: { isMentorProfileComplete: false, isAdmin: false } }),
      prisma.session.count(),
      prisma.mentorshipRequest.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.user.count({ where: { suspended: true } }),
      prisma.post.count(),
      prisma.message.count(),
    ]);
    res.json({ totalUsers, totalMentors, totalMentees, totalSessions, pendingRequests, pendingReports, suspendedUsers, totalPosts, totalMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activities', authenticate, adminOnly, async (req, res) => {
  try {
    const [recentUsers, recentPosts, recentMessages, recentSessions, recentRequests, recentReports] = await Promise.all([
      prisma.user.findMany({ take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, fullName: true, email: true, createdAt: true, isAdmin: true, isMentorProfileComplete: true } }),
      prisma.post.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, fullName: true } } } }),
      prisma.message.findMany({ take: 10, orderBy: { sentAt: 'desc' }, include: { sender: { select: { id: true, fullName: true } } } }),
      prisma.session.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { mentor: { select: { id: true, fullName: true } }, mentee: { select: { id: true, fullName: true } } } }),
      prisma.mentorshipRequest.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { mentor: { select: { id: true, fullName: true } }, mentee: { select: { id: true, fullName: true } } } }),
      prisma.report.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { reporter: { select: { id: true, fullName: true } } } }),
    ]);

    const activities = [];
    recentUsers.forEach((u) => activities.push({ type: 'user_joined', user: u.fullName, userId: u.id, detail: u.isMentorProfileComplete ? 'registered as mentor' : u.isAdmin ? 'registered as admin' : 'registered', timestamp: u.createdAt }));
    recentPosts.forEach((p) => activities.push({ type: 'post_created', user: p.author?.fullName, userId: p.authorId, detail: p.content?.slice(0, 60), timestamp: p.createdAt }));
    recentMessages.forEach((m) => activities.push({ type: 'message_sent', user: m.sender?.fullName, userId: m.senderId, detail: m.text?.slice(0, 60) || 'media message', timestamp: m.sentAt }));
    recentSessions.forEach((s) => activities.push({ type: 'session', user: s.mentor?.fullName, detail: `${s.title} (${s.status})`, timestamp: s.createdAt }));
    recentRequests.forEach((r) => activities.push({ type: 'mentorship_request', user: r.mentee?.fullName, detail: `to ${r.mentor?.fullName} — ${r.status}`, timestamp: r.createdAt }));
    recentReports.forEach((r) => activities.push({ type: 'report', user: r.reporter?.fullName, detail: `${r.type} — ${r.status}`, timestamp: r.createdAt }));

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(activities.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/suspend', authenticate, adminOnly, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.isAdmin) return res.status(400).json({ error: 'Cannot suspend an admin' });

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { suspended: !target.suspended },
      select: { id: true, fullName: true, email: true, suspended: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.isAdmin) return res.status(400).json({ error: 'Cannot delete an admin' });

    await prisma.$transaction(async (tx) => {
      await tx.passwordReset.deleteMany({ where: { userId: targetId } });
      await tx.storyComment.deleteMany({ where: { authorId: targetId } });
      await tx.story.deleteMany({ where: { userId: targetId } });
      await tx.postReaction.deleteMany({ where: { userId: targetId } });
      await tx.comment.deleteMany({ where: { authorId: targetId } });
      await tx.post.deleteMany({ where: { authorId: targetId } });
      await tx.notification.deleteMany({ where: { userId: targetId } });
      await tx.message.deleteMany({ where: { senderId: targetId } });
      await tx.conversationParticipant.deleteMany({ where: { userId: targetId } });
      await tx.report.deleteMany({ where: { reportedBy: targetId } });
      await tx.review.deleteMany({ where: { OR: [{ mentorId: targetId }, { menteeId: targetId }] } });
      await tx.mentorshipRequest.deleteMany({ where: { OR: [{ mentorId: targetId }, { menteeId: targetId }] } });
      await tx.session.deleteMany({ where: { OR: [{ mentorId: targetId }, { menteeId: targetId }] } });
      await tx.availability.deleteMany({ where: { mentorId: targetId } });
      await tx.user.delete({ where: { id: targetId } });
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports', authenticate, adminOnly, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: { reporter: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(reports.map(async (r) => {
      let targetUser = null;
      if (r.targetType === 'user') {
        targetUser = await prisma.user.findUnique({
          where: { id: r.targetId },
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        });
      }
      return { ...r, targetUser };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/reports/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const report = await prisma.report.update({
      where: { id: Number(req.params.id) },
      data: req.body,
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports', authenticate, async (req, res) => {
  try {
    const { type, targetType, targetId } = req.body;
    const report = await prisma.report.create({
      data: { type, targetType, targetId, reportedBy: req.userId },
    });
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
