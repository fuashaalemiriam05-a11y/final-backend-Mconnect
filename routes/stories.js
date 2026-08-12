import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
  destination: join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

router.get('/', optionalAuth, async (req, res) => {
  try {
    await prisma.story.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        comments: { include: { author: { select: { id: true, fullName: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const caption = req.body.caption || '';
    const text = req.body.text || '';
    const mediaType = req.body.mediaType || 'image';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let mediaUrl = null;
    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    }

    if (!mediaUrl && !text) {
      return res.status(400).json({ error: 'Either a file or text is required' });
    }

    const story = await prisma.story.create({
      data: {
        userId: req.userId,
        mediaUrl,
        mediaType,
        caption,
        text,
        expiresAt,
      },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.story.deleteMany({ where: { id: Number(req.params.id), userId: req.userId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    const comment = await prisma.storyComment.create({
      data: { storyId: Number(req.params.id), authorId: req.userId, text },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:storyId/comments/:commentId', authenticate, async (req, res) => {
  try {
    await prisma.storyComment.deleteMany({
      where: { id: Number(req.params.commentId), authorId: req.userId },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
