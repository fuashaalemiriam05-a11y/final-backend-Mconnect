import { Router } from 'express';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

router.get('/:mentorId', authenticate, async (req, res) => {
  try {
      const availability = await prisma.availability.findUnique({
      where: { mentorId: Number(req.params.mentorId) },
    });
    if (availability && typeof availability.slots === 'string') {
      availability.slots = JSON.parse(availability.slots);
    }
    res.json(availability || { slots: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:mentorId', authenticate, async (req, res) => {
  try {
    const { slots } = req.body;
    const availability = await prisma.availability.upsert({
      where: { mentorId: req.userId },
      update: { slots: JSON.stringify(slots) },
      create: { mentorId: req.userId, slots: JSON.stringify(slots) },
    });
    res.json(availability);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
