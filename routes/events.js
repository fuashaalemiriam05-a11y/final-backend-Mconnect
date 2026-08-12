import { Router } from 'express';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

const includeCreator = {
  creator: { select: { id: true, fullName: true, avatarUrl: true } },
};

router.get('/', authenticate, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: includeCreator,
      orderBy: { startAt: 'asc' },
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: Number(req.params.id) },
      include: includeCreator,
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, location, startAt, endAt, category, imageUrls } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Event title is required' });
    }
    if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
      return res.status(400).json({ error: 'A valid event time is required' });
    }
    const event = await prisma.event.create({
      data: {
        creatorId: req.userId,
        title: title.trim(),
        description: description || '',
        location: location || null,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        category: category || 'academic',
        imageUrls: Array.isArray(imageUrls) ? imageUrls.slice(0, 5) : [],
      },
      include: includeCreator,
    });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.creatorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: 'Only the creator or an admin can edit this event' });
    }

    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.location !== undefined) data.location = req.body.location || null;
    if (req.body.startAt !== undefined) data.startAt = new Date(req.body.startAt);
    if (req.body.endAt !== undefined) data.endAt = req.body.endAt ? new Date(req.body.endAt) : null;
    if (req.body.category !== undefined) data.category = req.body.category;
    if (req.body.imageUrls !== undefined) data.imageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls.slice(0, 5) : [];

    const updated = await prisma.event.update({
      where: { id: event.id },
      data,
      include: includeCreator,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.creatorId !== req.userId && !req.isAdmin) {
      return res.status(403).json({ error: 'Only the creator or an admin can delete this event' });
    }
    await prisma.event.delete({ where: { id: event.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
