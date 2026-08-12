import { ensureSystemUser } from './systemUser.js';

export async function findDirectConversation(prisma, userIdA, userIdB) {
  const a = await prisma.conversationParticipant.findMany({
    where: { userId: userIdA },
    select: { conversation: { include: { participants: true } } },
  });
  const found = a.find(
    (x) =>
      x.conversation.type === 'direct' &&
      x.conversation.participants.length === 2 &&
      x.conversation.participants.some((p) => p.userId === userIdB)
  );
  return found?.conversation || null;
}

export async function checkExpiredMentorships(prisma) {
  const systemUserId = await ensureSystemUser(prisma);
  const now = new Date();

  const expired = await prisma.mentorshipRequest.findMany({
    where: {
      status: 'ACTIVE',
      extendPromptSent: false,
      endDate: { not: null, lte: now },
    },
    include: {
      mentor: { select: { id: true, fullName: true } },
      mentee: { select: { id: true, fullName: true } },
    },
  });

  let count = 0;
  for (const req of expired) {
    try {
      const conv = await findDirectConversation(prisma, req.mentorId, req.menteeId);
      if (!conv) {
        await prisma.mentorshipRequest.update({
          where: { id: req.id },
          data: { extendPromptSent: true },
        });
        continue;
      }

      const durationText = req.durationDays
        ? `${req.durationDays} day${req.durationDays === 1 ? '' : 's'}`
        : req.duration || '30 days';

      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: systemUserId,
          text: `Your mentorship period with ${req.mentor.fullName} (${durationText}) has ended. Would you like to extend your mentorship?`,
          messageType: 'mentorship_extend',
          metadata: {
            mentorshipRequestId: req.id,
            mentorId: req.mentorId,
            mentorName: req.mentor.fullName,
            menteeId: req.menteeId,
            durationDays: req.durationDays || 30,
          },
        },
      });

      await prisma.conversation.update({
        where: { id: conv.id },
        data: { updatedAt: new Date() },
      });

      await prisma.notification.create({
        data: {
          userId: req.menteeId,
          type: 'mentorship_expired',
          message: `Your mentorship with ${req.mentor.fullName} has ended. Reply in the chat to extend it.`,
          linkTo: `/messages/${conv.id}`,
        },
      });

      await prisma.mentorshipRequest.update({
        where: { id: req.id },
        data: { extendPromptSent: true },
      });
      count++;
    } catch (err) {
      console.error('checkMentorships error for request', req.id, err.message);
    }
  }

  if (count > 0) console.log(`[mentorship] Extension prompts sent for ${count} expired mentorship(s)`);
  return count;
}

export function startMentorshipScheduler(prisma, intervalMs = 15 * 60 * 1000) {
  const run = () => checkExpiredMentorships(prisma).catch((err) => console.error('mentorship scheduler:', err.message));
  setTimeout(run, 15 * 1000);
  return setInterval(run, intervalMs);
}
