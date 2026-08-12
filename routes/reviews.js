import { Router } from 'express';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

router.get('/mentor/:mentorId', optionalAuth, async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { mentorId: Number(req.params.mentorId) },
      include: { mentee: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { mentorId, rating, text } = req.body;
    const mentor = await prisma.user.findUnique({ where: { id: Number(mentorId) } });
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    if (!mentor.isMentorProfileComplete) {
      return res.status(400).json({ error: 'This user is not a mentor' });
    }
    const existing = await prisma.review.findFirst({
      where: { mentorId, menteeId: req.userId },
    });
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this mentor' });
    }
    const review = await prisma.review.create({
      data: { mentorId, menteeId: req.userId, rating, text },
      include: { mentee: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    const avgResult = await prisma.review.aggregate({
      where: { mentorId },
      _avg: { rating: true },
    });
    await prisma.user.update({
      where: { id: mentorId },
      data: { rating: avgResult._avg.rating || 0 },
    });
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { rating, text } = req.body;
    const review = await prisma.review.findUnique({ where: { id: Number(req.params.id) } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.menteeId !== req.userId) return res.status(403).json({ error: 'Not your review' });

    const updated = await prisma.review.update({
      where: { id: Number(req.params.id) },
      data: { rating, text },
      include: { mentee: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    const avgResult = await prisma.review.aggregate({
      where: { mentorId: review.mentorId },
      _avg: { rating: true },
    });
    await prisma.user.update({
      where: { id: review.mentorId },
      data: { rating: avgResult._avg.rating || 0 },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: Number(req.params.id) } });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    if (review.menteeId !== req.userId) return res.status(403).json({ error: 'Not your review' });

    await prisma.review.delete({ where: { id: Number(req.params.id) } });

    const avgResult = await prisma.review.aggregate({
      where: { mentorId: review.mentorId },
      _avg: { rating: true },
    });
    await prisma.user.update({
      where: { id: review.mentorId },
      data: { rating: avgResult._avg.rating || 0 },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
