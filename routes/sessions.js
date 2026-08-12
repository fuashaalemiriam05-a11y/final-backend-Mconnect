import { Router } from 'express';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

router.get('/', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    const where = { OR: [{ mentorId: req.userId }, { menteeId: req.userId }] };
    if (date) where.date = date;

    const sessions = await prisma.session.findMany({
      where,
      include: {
        mentor: { select: { id: true, fullName: true, avatarUrl: true } },
        mentee: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        mentor: { select: { id: true, fullName: true, avatarUrl: true } },
        mentee: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { menteeId, title, date, time } = req.body;
    const session = await prisma.session.create({
      data: { mentorId: req.userId, menteeId, title, date, time },
      include: {
        mentor: { select: { id: true, fullName: true } },
        mentee: { select: { id: true, fullName: true } },
      },
    });
    await prisma.notification.create({
      data: {
        userId: menteeId,
        type: 'session_reminder',
        message: `New session "${title}" scheduled for ${date} at ${time}.`,
        linkTo: `/sessions/${session.id}`,
      },
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const session = await prisma.session.update({
      where: { id: Number(req.params.id) },
      data: req.body,
      include: {
        mentor: { select: { id: true, fullName: true } },
        mentee: { select: { id: true, fullName: true } },
      },
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const session = await prisma.session.update({
      where: { id: Number(req.params.id) },
      data: { status: 'cancelled' },
      include: {
        mentor: { select: { id: true, fullName: true } },
        mentee: { select: { id: true, fullName: true } },
      },
    });
    const recipientId = session.mentorId === req.userId ? session.menteeId : session.mentorId;
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'session_reminder',
        message: `Session "${session.title}" has been cancelled.`,
        linkTo: `/sessions/${session.id}`,
      },
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
