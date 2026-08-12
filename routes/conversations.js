import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
  destination: join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

router.get('/', authenticate, async (req, res) => {
  try {
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId: req.userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
            },
            messages: {
              orderBy: { sentAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
    });
    const conversations = participations.map((p) => ({
      ...p.conversation,
      lastMessage: p.conversation.messages[0]?.text || null,
      lastMessageSenderId: p.conversation.messages[0]?.senderId || null,
      lastMessageSenderName: p.conversation.messages[0]?.sender?.fullName || null,
      lastMessageType: p.conversation.messages[0]?.messageType || 'text',
      lastMessageAt: p.conversation.messages[0]?.sentAt || p.conversation.createdAt,
    }));
    conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { participantIds, groupName, groupIconUrl } = req.body;
    const allIds = [...new Set([req.userId, ...participantIds])];
    const isGroup = allIds.length > 2;
    if (isGroup) {
      const creator = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!creator?.isMentorProfileComplete) {
        return res.status(403).json({ error: 'Only mentors can create groups' });
      }
    }
    const conv = await prisma.conversation.create({
      data: {
        type: isGroup ? 'group' : 'direct',
        groupName: isGroup ? groupName : null,
        groupIconUrl: isGroup ? groupIconUrl : null,
        createdById: req.userId,
      },
    });
    await prisma.conversationParticipant.createMany({
      data: allIds.map((userId) => ({ conversationId: conv.id, userId })),
    });
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/direct/:userId', authenticate, async (req, res) => {
  try {
    const otherUserId = Number(req.params.userId);
    if (otherUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }
    const other = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other) return res.status(404).json({ error: 'User not found' });

    const mine = await prisma.conversationParticipant.findMany({
      where: { userId: req.userId },
      select: { conversationId: true },
    });
    const theirs = await prisma.conversationParticipant.findMany({
      where: { userId: otherUserId, conversationId: { in: mine.map((m) => m.conversationId) } },
      select: { conversation: { include: { participants: true } } },
    });

    const existing = theirs.find(
      (t) => t.conversation.participants.length === 2 && t.conversation.type === 'direct'
    );
    if (existing) return res.json(existing.conversation);

    const conv = await prisma.conversation.create({
      data: { type: 'direct' },
    });
    await prisma.conversationParticipant.createMany({
      data: [
        { conversationId: conv.id, userId: req.userId },
        { conversationId: conv.id, userId: otherUserId },
      ],
    });
    const full = await prisma.conversation.findUnique({
      where: { id: conv.id },
      include: { participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } },
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: Number(req.params.id) },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { sentAt: 'asc' },
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/messages', authenticate, upload.single('file'), async (req, res) => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: Number(req.params.id) } });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.frozen) {
      return res.status(400).json({ error: 'This conversation has been ended and is read-only' });
    }

    const { text, messageType } = req.body;
    let attachmentUrl = null;
    let type = messageType || 'text';

    if (req.file) {
      attachmentUrl = `/uploads/${req.file.filename}`;
      if (!type || type === 'text') {
        const ext = req.file.originalname.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
        else if (['mp3', 'wav', 'ogg', 'm4a', 'webm', 'aac', 'opus'].includes(ext)) type = 'voice';
        else type = 'document';
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: Number(req.params.id),
        senderId: req.userId,
        text: text || '',
        messageType: type,
        attachmentUrl,
      },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    await prisma.conversation.update({
      where: { id: Number(req.params.id) },
      data: { updatedAt: new Date() },
    });

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: Number(req.params.id), NOT: { userId: req.userId } },
    });
    await Promise.all(
      participants.map((p) =>
        prisma.notification.create({
          data: {
            userId: p.userId,
            type: 'new_message',
            message: `New message from ${message.sender.fullName}`,
            linkTo: `/messages/${req.params.id}`,
          },
        })
      )
    );
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/messages/:messageId', authenticate, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const messageId = Number(req.params.messageId);
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.conversationId !== convId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (message.senderId !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }
    if (Date.now() - new Date(message.sentAt).getTime() > 3 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Messages can only be edited within 3 hours of sending' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { text: text.trim(), editedAt: new Date() },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await prisma.message.updateMany({
      where: {
        conversationId: Number(req.params.id),
        NOT: { senderId: req.userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, upload.single('file'), async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.type !== 'group') return res.status(400).json({ error: 'Can only edit groups' });

    const isMember = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId: req.userId } },
    });
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser?.isMentorProfileComplete) {
      return res.status(403).json({ error: 'Only mentors can modify group settings' });
    }

    const data = {};
    if (req.body.groupName !== undefined) data.groupName = req.body.groupName;
    if (req.file) data.groupIconUrl = `/uploads/${req.file.filename}`;

    const updated = await prisma.conversation.update({ where: { id: convId }, data });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/participants', authenticate, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const { userId } = req.body;
    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.type !== 'group') return res.status(400).json({ error: 'Can only edit groups' });

    const existing = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId: req.userId } },
    });
    if (!existing) return res.status(403).json({ error: 'Not a member' });

    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser?.isMentorProfileComplete) {
      return res.status(403).json({ error: 'Only mentors can add members to groups' });
    }

    const alreadyMember = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId } },
    });
    if (alreadyMember) return res.status(400).json({ error: 'Already a member' });

    await prisma.conversationParticipant.create({
      data: { conversationId: convId, userId },
    });

    const updated = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/participants/:userId', authenticate, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const removeUserId = Number(req.params.userId);
    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.type !== 'group') return res.status(400).json({ error: 'Can only edit groups' });

    const isMember = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId: req.userId } },
    });
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser?.isMentorProfileComplete) {
      return res.status(403).json({ error: 'Only mentors can remove members from groups' });
    }

    await prisma.conversationParticipant.delete({
      where: { conversationId_userId: { conversationId: convId, userId: removeUserId } },
    });

    const updated = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/freeze', authenticate, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const isMember = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId: req.userId } },
    });
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const updated = await prisma.conversation.update({
      where: { id: convId },
      data: { frozen: true },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { participants: true },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const isMember = conv.participants.some((p) => p.userId === req.userId);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    if (conv.type === 'group') {
      await prisma.conversationParticipant.delete({
        where: { conversationId_userId: { conversationId: convId, userId: req.userId } },
      });
      return res.json({ ok: true, type: 'left' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { conversationId: convId } });
      await tx.conversationParticipant.deleteMany({ where: { conversationId: convId } });
      await tx.conversation.delete({ where: { id: convId } });
    });
    res.json({ ok: true, type: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
