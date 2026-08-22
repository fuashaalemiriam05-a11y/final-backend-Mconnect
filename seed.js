import 'dotenv/config';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding...');

  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.session.deleteMany();
  await prisma.mentorshipRequest.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      fullName: 'Admin User',
      email: 'admin@mconnect.com',
      passwordHash,
      isAdmin: true,
      bio: 'Platform administrator',
      isMentorProfileComplete: false,
    },
  });

  const sarah = await prisma.user.create({
    data: {
      fullName: 'Sarah Chen',
      email: 'sarah@mconnect.com',
      passwordHash,
      bio: 'Senior full-stack engineer with 8+ years of experience in React, Node.js, and cloud architecture.',
      expertiseTags: ['JavaScript', 'React', 'Node.js', 'AWS'],
      rating: 4.8,
      isMentorProfileComplete: true,
    },
  });

  const marcus = await prisma.user.create({
    data: {
      fullName: 'Marcus Johnson',
      email: 'marcus@mconnect.com',
      passwordHash,
      bio: 'Product designer and UX researcher. Passionate about building accessible, user-centered products.',
      expertiseTags: ['Design', 'Figma', 'UX Research', 'CSS'],
      rating: 4.5,
      isMentorProfileComplete: true,
    },
  });

  const elena = await prisma.user.create({
    data: {
      fullName: 'Elena Rodriguez',
      email: 'elena@mconnect.com',
      passwordHash,
      bio: 'Data scientist specializing in machine learning and Python. Previously at Google Brain.',
      expertiseTags: ['Python', 'Machine Learning', 'Data Science', 'TensorFlow'],
      rating: 4.9,
      isMentorProfileComplete: true,
    },
  });

  const james = await prisma.user.create({
    data: {
      fullName: 'James Park',
      email: 'james@mconnect.com',
      passwordHash,
      bio: 'DevOps engineer focused on CI/CD, Docker, and Kubernetes.',
      expertiseTags: ['DevOps', 'Docker', 'Kubernetes', 'CI/CD'],
      rating: 4.3,
      isMentorProfileComplete: true,
    },
  });

  const aisha = await prisma.user.create({
    data: {
      fullName: 'Aisha Patel',
      email: 'aisha@mconnect.com',
      passwordHash,
      bio: 'Mobile developer building iOS and Android apps with React Native.',
      expertiseTags: ['React Native', 'iOS', 'Android', 'TypeScript'],
      rating: 4.6,
      isMentorProfileComplete: true,
    },
  });

  const mentee1 = await prisma.user.create({
    data: {
      fullName: 'Tom Wilson',
      email: 'tom@mconnect.com',
      passwordHash,
      bio: 'Junior developer looking to improve my skills.',
    },
  });

  const mentee2 = await prisma.user.create({
    data: {
      fullName: 'Lisa Chang',
      email: 'lisa@mconnect.com',
      passwordHash,
      bio: 'Career switcher from finance to tech.',
    },
  });

  await prisma.mentorshipRequest.createMany({
    data: [
      { mentorId: sarah.id, menteeId: mentee1.id, message: 'I want to learn full-stack development.', duration: '3 months', status: 'ACTIVE' },
      { mentorId: marcus.id, menteeId: mentee2.id, message: 'I want to transition into UX design.', duration: '1 month', status: 'PENDING' },
      { mentorId: elena.id, menteeId: mentee1.id, message: 'Interested in data science fundamentals.', duration: '6 months', status: 'PENDING' },
    ],
  });

  await prisma.session.createMany({
    data: [
      { mentorId: sarah.id, menteeId: mentee1.id, title: 'React Hooks Deep Dive', date: '2026-07-25', time: '14:00', status: 'upcoming', videoCallUrl: 'https://meet.google.com/abc-defg-hij' },
      { mentorId: sarah.id, menteeId: mentee1.id, title: 'Node.js API Best Practices', date: '2026-07-18', time: '14:00', status: 'completed', videoCallUrl: 'https://meet.google.com/xyz-uvwx-rst' },
      { mentorId: marcus.id, menteeId: mentee2.id, title: 'Intro to Figma', date: '2026-07-26', time: '10:00', status: 'upcoming', videoCallUrl: 'https://meet.google.com/lmn-opqr-stu' },
    ],
  });

  await prisma.availability.create({
    data: {
      mentorId: sarah.id,
      slots: JSON.stringify([
        { day: 'Monday', startTime: '09:00', endTime: '12:00', recurring: true },
        { day: 'Wednesday', startTime: '14:00', endTime: '17:00', recurring: true },
        { day: 'Friday', startTime: '10:00', endTime: '13:00', recurring: true },
      ]),
    },
  });

  await prisma.availability.create({
    data: {
      mentorId: marcus.id,
      slots: JSON.stringify([
        { day: 'Tuesday', startTime: '09:00', endTime: '11:00', recurring: true },
        { day: 'Thursday', startTime: '15:00', endTime: '18:00', recurring: true },
      ]),
    },
  });

  const post1 = await prisma.post.create({
    data: {
      authorId: sarah.id,
      content: 'Just finished a deep dive into React Server Components. The mental model is shifting — think of components as data transformers, not UI builders. Excited to share what I learned!',
      commentCount: 2,
    },
  });

  const post2 = await prisma.post.create({
    data: {
      authorId: marcus.id,
      content: 'New article on accessible design patterns. TL;DR: Start with semantic HTML, enhance with ARIA, and test with a screen reader. Accessibility is not an afterthought.',
      commentCount: 1,
    },
  });

  const post3 = await prisma.post.create({
    data: {
      authorId: elena.id,
      content: 'Published my latest research on transformer architectures for time-series forecasting. The results are promising — 15% improvement over baseline LSTM models.',
      mediaUrl: '/uploads/paper.pdf',
      mediaType: 'doc',
      commentCount: 3,
    },
  });

  await prisma.comment.createMany({
    data: [
      { postId: post1.id, authorId: mentee1.id, text: 'This is really helpful! I\'ve been confused about RSCs.' },
      { postId: post1.id, authorId: aisha.id, text: 'Great breakdown, Sarah! Would love to see a workshop on this.' },
      { postId: post2.id, authorId: mentee2.id, text: 'Thanks for sharing! Accessibility is so important.' },
      { postId: post3.id, authorId: james.id, text: 'Amazing work, Elena! The methodology section is particularly strong.' },
      { postId: post3.id, authorId: sarah.id, text: 'This could be a great mentoring topic for data science mentees.' },
      { postId: post3.id, authorId: mentee1.id, text: 'Fascinating results! How long did the training take?' },
    ],
  });

  await prisma.postReaction.createMany({
    data: [
      { postId: post1.id, userId: mentee1.id, type: 'like' },
      { postId: post1.id, userId: aisha.id, type: 'celebrate' },
      { postId: post1.id, userId: james.id, type: 'support' },
      { postId: post2.id, userId: sarah.id, type: 'like' },
      { postId: post2.id, userId: mentee2.id, type: 'support' },
      { postId: post3.id, userId: sarah.id, type: 'celebrate' },
      { postId: post3.id, userId: marcus.id, type: 'like' },
      { postId: post3.id, userId: mentee1.id, type: 'support' },
    ],
  });

  const conv1 = await prisma.conversation.create({ data: { type: 'direct', createdById: sarah.id } });
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conv1.id, userId: sarah.id },
      { conversationId: conv1.id, userId: mentee1.id },
    ],
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conv1.id, senderId: sarah.id, text: 'Hi Tom! Welcome to our mentorship session. How can I help you today?' },
      { conversationId: conv1.id, senderId: mentee1.id, text: 'Hi Sarah! I wanted to discuss the best practices for structuring a React project.' },
      { conversationId: conv1.id, senderId: sarah.id, text: 'Great topic! Let\'s start with folder structure and then move to state management patterns.' },
    ],
  });

  const conv2 = await prisma.conversation.create({ data: { type: 'group', groupName: 'Mentorship Circle', groupIconUrl: null, createdById: sarah.id } });
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conv2.id, userId: sarah.id },
      { conversationId: conv2.id, userId: marcus.id },
      { conversationId: conv2.id, userId: elena.id },
      { conversationId: conv2.id, userId: mentee1.id },
    ],
  });

  await prisma.message.create({
    data: {
      conversationId: conv2.id,
      senderId: sarah.id,
      text: 'Welcome everyone to the Mentorship Circle! Feel free to share resources and ask questions here.',
    },
  });

  await prisma.notification.createMany({
    data: [
      { userId: sarah.id, type: 'mentorship_request', message: 'Tom Wilson sent you a mentorship request.', read: false, linkTo: '/dashboard' },
      { userId: marcus.id, type: 'mentorship_request', message: 'Lisa Chang sent you a mentorship request.', read: false, linkTo: '/dashboard' },
      { userId: mentee1.id, type: 'session_reminder', message: 'You have a session with Sarah Chen tomorrow at 2:00 PM.', read: false, linkTo: '/sessions/1' },
      { userId: sarah.id, type: 'new_comment', message: 'Tom Wilson commented on your post.', read: true, linkTo: '/posts/1' },
    ],
  });

  await prisma.review.create({
    data: {
      mentorId: sarah.id,
      menteeId: mentee1.id,
      rating: 5,
      text: 'Sarah is an incredible mentor. She explained complex concepts clearly and provided practical examples.',
    },
  });

  await prisma.report.create({
    data: {
      type: 'Inappropriate content',
      status: 'pending',
      reportedBy: mentee2.id,
      targetType: 'post',
      targetId: post2.id,
    },
  });

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
