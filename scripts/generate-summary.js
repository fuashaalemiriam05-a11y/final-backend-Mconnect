import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, PageBreak } from 'docx';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({ text: 'MConnect — Mentorship & Networking Platform', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: 'Technical Documentation Summary', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 1. What the website is about ---
        new Paragraph({ text: '1. What the Website Is About', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 100 } }),
        new Paragraph({
          children: [
            new TextRun({ text: 'MConnect', bold: true }),
            new TextRun({ text: ' is a full-stack mentorship and networking platform that connects mentors and mentees. It provides a professional social network experience (similar to LinkedIn) with features such as news feed, direct messaging, group chats, voice calls, stories, mentor profiles with reviews, session scheduling, and an admin dashboard. The platform supports both light and dark themes and is fully responsive on desktop and mobile.' }),
          ]
        }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 2. Problem Statement ---
        new Paragraph({ text: '2. Problem Statement', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 100 } }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Many students, junior developers, and professionals struggle to find experienced mentors who can guide their career growth. Existing solutions are either informal (LinkedIn DMs, Twitter) or locked behind paywalls (paid coaching platforms). There is no free, all-in-one platform that combines:' }),
          ]
        }),
        new Paragraph({ text: '• Mentor discovery with search and filtering', bullet: true }),
        new Paragraph({ text: '• Direct messaging and group communication', bullet: true }),
        new Paragraph({ text: '• Session scheduling and management', bullet: true }),
        new Paragraph({ text: '• Social features (feed, stories, reactions, comments)', bullet: true }),
        new Paragraph({ text: '• Review and rating system for accountability', bullet: true }),
        new Paragraph({ text: '• Admin oversight and reporting for safety', bullet: true }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 3. Solution ---
        new Paragraph({ text: '3. Solution', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 100 } }),
        new Paragraph({
          children: [
            new TextRun({ text: 'MConnect', bold: true }),
            new TextRun({ text: ' solves this by providing a unified platform where any user can act as both mentor and mentee. The system uses a unified user role model (no separate tables for mentors/mentees — any user can complete a mentor profile). Key features include a JWT-based authentication system, real-time messaging, Jitsi-powered voice calls, Prisma ORM with PostgreSQL, and a React + Vite frontend with Tailwind CSS.' }),
          ]
        }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 4. Pages / Screens ---
        new Paragraph({ text: '4. Pages / Screens', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 100 } }),
        new Paragraph({ text: 'The application has 25+ screens (routes):', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ spacing: { after: 50 } }),

        // Pages table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Route', bold: true })], width: { size: 30, type: WidthType.PERCENTAGE } }), new TableCell({ children: [new Paragraph({ text: 'Description', bold: true })], width: { size: 70, type: WidthType.PERCENTAGE } })] }),
            ...([
              ['/', 'Welcome / Landing page (public)'],
              ['/login', 'Login page with password show/hide and forgot password link'],
              ['/signup', 'Registration page'],
              ['/forgot-password', 'Email-based password reset request'],
              ['/reset-password', 'Token-based password reset'],
              ['/feed', 'Social feed with posts, stories, reactions (publicly accessible)'],
              ['/feed/new', 'Create a new post with file upload'],
              ['/posts/:id', 'Post detail view'],
              ['/posts/:id/comments', 'Nested comments on a post'],
              ['/mentors', 'Search and filter mentors by tags and rating'],
              ['/mentors/:id', 'Mentor profile with bio, expertise, reviews'],
              ['/mentors/:id/request', 'Send mentorship request to a mentor'],
              ['/mentor-profile-setup', 'Edit own mentor profile (bio, tags, photo)'],
              ['/sessions/:id', 'View a scheduled session'],
              ['/messages', 'Chat inbox / conversation list'],
              ['/messages/:id', 'Direct message chat screen'],
              ['/messages/group/:id', 'Group chat screen with voice call button'],
              ['/groups/:id/edit', 'Edit group: rename, add/remove members, change icon'],
              ['/groups/:id/call', 'Voice call screen (Jitsi Meet audio-only)'],
              ['/groups', 'Group list'],
              ['/groups/new', 'Create a new group from accepted mentees'],
              ['/profile', 'User profile with photo upload, sessions, requests'],
              ['/settings', 'Settings: notifications, appearance, change password, delete account'],
              ['/notifications', 'Notification history'],
              ['/admin', 'Admin dashboard: stats, users, activities, reports'],
            ]).map(([route, desc]) => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: route })] }),
                new TableCell({ children: [new Paragraph({ text: desc })] }),
              ]
            })),
          ]
        }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 5. API Endpoints ---
        new Paragraph({ text: '5. API Endpoints', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 100 } }),
        new Paragraph({
          children: [
            new TextRun({ text: 'The backend runs on Express.js (port 3002) and exposes the following endpoint groups. All endpoints return JSON. Protected endpoints require a JWT token in the Authorization header (Bearer token).', }),
          ]
        }),
        new Paragraph({ spacing: { after: 100 } }),

        // Auth endpoints
        new Paragraph({ text: '5.1 Authentication (/api/auth)', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• POST /signup — Register a new user (name, email, password). Returns user object + JWT token.', bullet: true }),
        new Paragraph({ text: '• POST /login — Login with email + password. Checks if user is suspended. Returns user + token.', bullet: true }),
        new Paragraph({ text: '• POST /forgot-password — Sends password reset email via Ethereal (test) or SMTP. Generates crypto token stored in password_resets table (1hr expiry).', bullet: true }),
        new Paragraph({ text: '• POST /reset-password — Validates reset token, hashes new password, marks token as used.', bullet: true }),
        new Paragraph({ spacing: { after: 100 } }),

        // Users endpoints
        new Paragraph({ text: '5.2 Users (/api/users)', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• GET /me — Get current user profile (requires auth).', bullet: true }),
        new Paragraph({ text: '• GET /mentors — List all users with complete mentor profiles. Supports ?search, ?expertise, ?minRating filters.', bullet: true }),
        new Paragraph({ text: '• GET /:id — Get a user by ID.', bullet: true }),
        new Paragraph({ text: '• GET / — List all users (optional auth — public).', bullet: true }),
        new Paragraph({ text: '• PATCH /me — Update own profile (name, bio, avatarUrl, expertiseTags).', bullet: true }),
        new Paragraph({ text: '• DELETE /me — Delete own account. Cascades: deletes all related data (posts, messages, sessions, reviews, etc.) in a transaction.', bullet: true }),
        new Paragraph({ text: '• PATCH /:id/mentor-profile — Mark mentor profile as complete.', bullet: true }),
        new Paragraph({ text: '• PATCH /:id/password — Change password (requires current password).', bullet: true }),
        new Paragraph({ spacing: { after: 100 } }),

        // Posts endpoints
        new Paragraph({ text: '5.3 Posts (/api/posts)', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• GET / — List all posts with author, reactions, comment count. Returns userReaction for logged-in user.', bullet: true }),
        new Paragraph({ text: '• POST / — Create a post (content, mediaUrl, mediaType).', bullet: true }),
        new Paragraph({ text: '• GET /:id — Get single post with details.', bullet: true }),
        new Paragraph({ text: '• DELETE /:id — Delete own post.', bullet: true }),
        new Paragraph({ text: '• POST /:id/reactions — Toggle reaction (type: "like"). One reaction per user per post (unique constraint).', bullet: true }),
        new Paragraph({ text: '• GET /:id/comments — Get all comments with replies.', bullet: true }),
        new Paragraph({ text: '• POST /:id/comments — Add a comment (text, optional parentId for replies).', bullet: true }),
        new Paragraph({ text: '• DELETE /comments/:id — Delete own comment.', bullet: true }),
        new Paragraph({ spacing: { after: 100 } }),

        // Conversations / Messages
        new Paragraph({ text: '5.4 Conversations & Messages (/api/conversations)', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• GET / — List user\'s conversations with last message preview.', bullet: true }),
        new Paragraph({ text: '• POST / — Create a new conversation (direct or group).', bullet: true }),
        new Paragraph({ text: '• GET /:id — Get conversation details with participants.', bullet: true }),
        new Paragraph({ text: '• PATCH /:id — Update group name or icon (multipart file upload).', bullet: true }),
        new Paragraph({ text: '• GET /:id/messages — Get all messages in a conversation (ascending).', bullet: true }),
        new Paragraph({ text: '• POST /:id/messages — Send a message (text or file: image/voice/document).', bullet: true }),
        new Paragraph({ text: '• PATCH /:id/read — Mark all unread messages as read.', bullet: true }),
        new Paragraph({ text: '• POST /:id/participants — Add a member to a group.', bullet: true }),
        new Paragraph({ text: '• DELETE /:id/participants/:userId — Remove a member from a group.', bullet: true }),
        new Paragraph({ spacing: { after: 100 } }),

        // Stories
        new Paragraph({ text: '5.5 Stories (/api/stories)', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• GET / — Get stories that haven\'t expired (24h). Grouped by user.', bullet: true }),
        new Paragraph({ text: '• POST / — Create a story (media file or text-only). Sets expiresAt = now + 24h.', bullet: true }),
        new Paragraph({ text: '• DELETE /:id — Delete own story (cascade deletes story comments).', bullet: true }),
        new Paragraph({ text: '• POST /:id/comments — Add comment to a story.', bullet: true }),
        new Paragraph({ text: '• DELETE /comments/:id — Delete story comment.', bullet: true }),
        new Paragraph({ spacing: { after: 100 } }),

        // Reviews
        new Paragraph({ text: '5.6 Reviews (/api/reviews)', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• GET /mentor/:id — Get all reviews for a mentor.', bullet: true }),
        new Paragraph({ text: '• POST / — Create a review (mentorId, rating, text). One review per user per mentor.', bullet: true }),
        new Paragraph({ text: '• PATCH /:id — Update own review.', bullet: true }),
        new Paragraph({ text: '• DELETE /:id — Delete own review. Auto-recalculates mentor rating.', bullet: true }),
        new Paragraph({ spacing: { after: 100 } }),

        // Admin
        new Paragraph({ text: '5.7 Admin (/api/admin)', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• GET /stats — Overall platform statistics (users, mentors, sessions, reports, etc.).', bullet: true }),
        new Paragraph({ text: '• GET /activities — Recent platform activity feed (user joins, posts, messages, sessions, reports).', bullet: true }),
        new Paragraph({ text: '• GET /reports — All reports with reporter and target user info.', bullet: true }),
        new Paragraph({ text: '• PATCH /reports/:id — Update report status (e.g. reviewed, resolved).', bullet: true }),
        new Paragraph({ text: '• POST /reports — Submit a new report (type, targetType, targetId).', bullet: true }),
        new Paragraph({ text: '• PATCH /users/:id/suspend — Toggle user suspension.', bullet: true }),
        new Paragraph({ text: '• DELETE /users/:id — Admin delete user (cascade all data).', bullet: true }),
        new Paragraph({ spacing: { after: 100 } }),

        // Mentorship & Sessions
        new Paragraph({ text: '5.8 Mentorship & Sessions', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: '• /api/mentorship-requests — CRUD mentorship requests (send, accept, decline).', bullet: true }),
        new Paragraph({ text: '• /api/sessions — Manage mentorship sessions (schedule, cancel, update).', bullet: true }),
        new Paragraph({ text: '• /api/notifications — Get and mark notifications as read.', bullet: true }),
        new Paragraph({ text: '• /api/uploads — File upload endpoint (images, audio, documents up to 25MB).', bullet: true }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 6. How Components Interact ---
        new Paragraph({ text: '6. How the Components Interact', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 100 } }),
        new Paragraph({ text: 'Architecture Overview:', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ spacing: { after: 50 } }),
        new Paragraph({
          children: [
            new TextRun({ text: 'The application follows a client-server architecture:', }),
          ]
        }),
        new Paragraph({ spacing: { after: 50 } }),
        new Paragraph({ text: 'Frontend (React + Vite, port 5173)', bold: true }),
        new Paragraph({ text: '• React app with component-based architecture. Uses React Router for navigation.', bullet: true }),
        new Paragraph({ text: '• AuthContext provides user state globally. ThemeContext provides light/dark mode.', bullet: true }),
        new Paragraph({ text: '• All API calls go through the api() helper in services/api.js, which attaches JWT tokens automatically.', bullet: true }),
        new Paragraph({ text: '• Vite proxies /api and /uploads to the backend (localhost:3002).', bullet: true }),
        new Paragraph({ text: '• Components: AppLayout wraps all protected routes with DesktopSidebar, BottomNav (mobile), and max-w-[900px] content area.', bullet: true }),
        new Paragraph({ spacing: { after: 50 } }),
        new Paragraph({ text: 'Backend (Express + Prisma + PostgreSQL, port 3002)', bold: true }),
        new Paragraph({ text: '• Express.js server with 12 route files, each handling a domain (auth, users, posts, conversations, admin, etc.).', bullet: true }),
        new Paragraph({ text: '• Prisma ORM with PostgreSQL. Schema has 16 models (User, Post, Comment, Conversation, Message, Story, Review, Report, etc.).', bullet: true }),
        new Paragraph({ text: '• Authentication: JWT tokens with 7-day expiry. Middleware: authenticate (required), optionalAuth (public), adminOnly.', bullet: true }),
        new Paragraph({ text: '• File uploads: multer stores files in backend/uploads/ directory, served statically at /uploads.', bullet: true }),
        new Paragraph({ spacing: { after: 50 } }),
        new Paragraph({ text: 'Data Flow Example — User creates a post:', bold: true }),
        new Paragraph({ text: '1. User types content and optionally selects a file on CreatePostScreen.', bullet: true }),
        new Paragraph({ text: '2. If a file is selected, uploadFile() sends it to POST /api/uploads → returns server URL.', bullet: true }),
        new Paragraph({ text: '3. Post content + media URL is sent to POST /api/posts → creates record in PostgreSQL.', bullet: true }),
        new Paragraph({ text: '4. The feed screen (SocialFeedScreen) fetches GET /api/posts and renders PostCard components.', bullet: true }),
        new Paragraph({ text: '5. Other users can react (one per user), comment, or share the post.', bullet: true }),
        new Paragraph({ spacing: { after: 50 } }),
        new Paragraph({ text: 'Data Flow Example — Group Voice Call:', bold: true }),
        new Paragraph({ text: '1. User clicks the phone icon in GroupMessageScreen → navigates to /groups/:id/call.', bullet: true }),
        new Paragraph({ text: '2. GroupCallScreen loads the Jitsi Meet API script and creates an audio-only room: mconnect-voice-{groupId}.', bullet: true }),
        new Paragraph({ text: '3. Other group members join the same room URL — Jitsi handles peer-to-peer audio.', bullet: true }),
        new Paragraph({ text: '4. When a user clicks the hangup button, the Jitsi API disposes the session and navigates back to the group chat.', bullet: true }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 7. Database Schema ---
        new Paragraph({ text: '7. Database Schema (16 Tables)', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 100 } }),
        new Paragraph({ text: 'The database uses PostgreSQL with Prisma ORM. Tables use @@map for snake_case naming in SQL while allowing camelCase in Prisma:', spacing: { after: 100 } }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: 'Table', bold: true })], width: { size: 25, type: WidthType.PERCENTAGE } }), new TableCell({ children: [new Paragraph({ text: 'Purpose', bold: true })], width: { size: 75, type: WidthType.PERCENTAGE } })] }),
            ...([
              ['users', 'Core user accounts (unified — any user can be mentor)'],
              ['password_resets', 'Password reset tokens with expiry'],
              ['mentorship_requests', 'Mentorship requests between users (pending/accepted/declined)'],
              ['sessions', 'Scheduled mentorship sessions'],
              ['availability', 'Mentor availability slots (unused in UI)'],
              ['posts', 'User posts with media support'],
              ['comments', 'Post comments with nested replies (parentId)'],
              ['post_reactions', 'Post reactions (one per user per post)'],
              ['conversations', 'Direct messages and group conversations'],
              ['conversation_participants', 'Many-to-many: users in conversations'],
              ['messages', 'Message content, type (text/image/voice/document), read receipts'],
              ['notifications', 'In-app notifications with linkTo'],
              ['stories', '24-hour expiring stories (text or media)'],
              ['story_comments', 'Comments on stories (cascade delete)'],
              ['reports', 'User reports for admin moderation'],
              ['reviews', 'Mentor reviews with rating (one per user per mentor)'],
            ]).map(([table, desc]) => new TableRow({
              children: [new TableCell({ children: [new Paragraph({ text: table })] }), new TableCell({ children: [new Paragraph({ text: desc })] })]
            })),
          ]
        }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 8. Key Technical Decisions ---
        new Paragraph({ text: '8. Key Technical Decisions', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 50 } }),
        new Paragraph({ text: '• Unified user role: No separate mentor/mentee tables — any user can toggle mentor mode by completing their mentor profile.', bullet: true }),
        new Paragraph({ text: '• Prisma 7 with @prisma/adapter-pg: Required for ESM compatibility. Connection string in prisma.config.ts.', bullet: true }),
        new Paragraph({ text: '• JWT auth with optional auth middleware: Public routes (feed, profiles) work without login.', bullet: true }),
        new Paragraph({ text: '• Dark mode: CSS custom properties on :root and .dark class, persisted in localStorage via ThemeContext.', bullet: true }),
        new Paragraph({ text: '• File uploads: multer stores in backend/uploads/, served statically. Vite proxies /uploads to backend.', bullet: true }),
        new Paragraph({ text: '• Voice calls: Jitsi Meet external API in audio-only mode. No video, no account required.', bullet: true }),
        new Paragraph({ text: '• Password reset: crypto.randomBytes token stored in DB (1hr expiry), sent via Ethereal test emails (or SMTP).', bullet: true }),
        new Paragraph({ text: '• Account deletion: Transaction-based cascade delete in Prisma — removes all user data atomically.', bullet: true }),
        new Paragraph({ spacing: { after: 200 } }),

        // --- 9. Tech Stack ---
        new Paragraph({ text: '9. Tech Stack Summary', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ spacing: { after: 50 } }),
        new Paragraph({ text: 'Frontend: React 19, Vite 8, Tailwind CSS 4, React Router, Lucide React icons', bullet: true }),
        new Paragraph({ text: 'Backend: Node.js, Express.js, Prisma 7, PostgreSQL 18, JWT (jsonwebtoken), bcrypt, multer, nodemailer', bullet: true }),
        new Paragraph({ text: 'External services: Jitsi Meet (voice calls), Ethereal (test emails), Gravatar fallback (avatars)', bullet: true }),
        new Paragraph({ text: 'Authentication: JWT (7-day expiry), stored in localStorage', bullet: true }),
        new Paragraph({ text: 'Deployment: Two processes — Vite dev server (port 5173) + Express API (port 3002)', bullet: true }),
      ]
    }
  ]
});

const buffer = await Packer.toBuffer(doc);
const outPath = join(__dirname, '..', 'MConnect_Summary.docx');
writeFileSync(outPath, buffer);
console.log(`Document saved to: ${outPath}`);
