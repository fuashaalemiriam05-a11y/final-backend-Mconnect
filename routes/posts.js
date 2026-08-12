import { Router } from 'express';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new pkg.PrismaClient({ adapter });

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { authorId } = req.query;
    const where = authorId ? { authorId: Number(authorId) } : {};
    const posts = await prisma.post.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const result = posts.map((p) => {
      const userReaction = req.userId
        ? p.reactions.find((r) => r.userId === req.userId)?.type || null
        : null;
      return {
        ...p,
        reactions: {
          like: p.reactions.filter((r) => r.type === 'like').length,
          celebrate: p.reactions.filter((r) => r.type === 'celebrate').length,
          support: p.reactions.filter((r) => r.type === 'support').length,
        },
        userReaction,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        reactions: true,
      },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const userReaction = post.reactions.find((r) => r.userId === req.userId);
    const result = {
      ...post,
      reactions: {
        like: post.reactions.filter((r) => r.type === 'like').length,
        celebrate: post.reactions.filter((r) => r.type === 'celebrate').length,
        support: post.reactions.filter((r) => r.type === 'support').length,
      },
      userReaction: userReaction?.type || null,
    };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;
    const post = await prisma.post.create({
      data: { authorId: req.userId, content, mediaUrl, mediaType },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        reactions: true,
      },
    });
    res.status(201).json({ ...post, reactions: { like: 0, celebrate: 0, support: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.userId) return res.status(403).json({ error: 'Not allowed' });
    await prisma.postReaction.deleteMany({ where: { postId: post.id } });
    await prisma.comment.deleteMany({ where: { postId: post.id } });
    await prisma.post.delete({ where: { id: post.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reactions', authenticate, async (req, res) => {
  try {
    const { type } = req.body;
    const postId = Number(req.params.id);
    const existing = await prisma.postReaction.findFirst({
      where: { postId, userId: req.userId },
    });
    if (existing) {
      if (existing.type === type) {
        await prisma.postReaction.delete({ where: { id: existing.id } });
        return res.json({ action: 'removed', type });
      }
      await prisma.postReaction.delete({ where: { id: existing.id } });
    }
    await prisma.postReaction.create({
      data: { postId, userId: req.userId, type },
    });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (post && post.authorId !== req.userId) {
      const verbs = { like: 'liked', celebrate: 'celebrated', support: 'supported' };
      const actor = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { fullName: true },
      });
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: 'post_reaction',
          message: `${actor.fullName} ${verbs[type] || 'reacted to'} your post.`,
          linkTo: `/posts/${postId}`,
        },
      });
    }
    res.json({ action: 'added', type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/comments', optionalAuth, async (req, res) => {
  try {
    const authorSelect = { select: { id: true, fullName: true, avatarUrl: true } };
    const includeReplies = (depth) => {
      const nested = { author: authorSelect };
      if (depth > 1) nested.replies = { include: includeReplies(depth - 1), orderBy: { createdAt: 'asc' } };
      return nested;
    };
    const comments = await prisma.comment.findMany({
      where: { postId: Number(req.params.id), parentId: null },
      include: {
        author: authorSelect,
        replies: { include: includeReplies(3), orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { text, parentId } = req.body;
    const comment = await prisma.comment.create({
      data: {
        postId: Number(req.params.id),
        authorId: req.userId,
        text,
        parentId: parentId || null,
      },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    await prisma.post.update({
      where: { id: Number(req.params.id) },
      data: { commentCount: { increment: 1 } },
    });
    const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });

    let notifyUserIds = new Set();
    if (post.authorId !== req.userId) notifyUserIds.add(post.authorId);

    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: Number(parentId) } });
      if (parent && parent.authorId !== req.userId) notifyUserIds.add(parent.authorId);
    }

    const isReply = !!parentId;
    await Promise.all(
      [...notifyUserIds].map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: 'new_comment',
            message: isReply
              ? `${comment.author.fullName} replied to your comment.`
              : `${comment.author.fullName} commented on your post.`,
            linkTo: `/posts/${post.id}`,
          },
        })
      )
    );
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
