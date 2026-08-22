import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { signToken } from '../middleware/auth.js';

const router = Router();

let prisma;

function getPrisma() {
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new pkg.PrismaClient({ adapter });
  }
  return prisma;
}

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    console.log(`\n📧 Ethereal test email account: ${testAccount.user}`);
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }
  return transporter;
}

function sanitizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

router.post('/signup', async (req, res) => {
  try {
    const { fullName, email: rawEmail, password } = req.body || {};
    const email = sanitizeEmail(rawEmail);

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = getPrisma();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await db.user.create({
      data: { fullName: String(fullName), email, passwordHash },
    });
    const token = signToken(user.id, user.isAdmin);
    const { passwordHash: _, ...safe } = user;
    res.status(201).json({ user: safe, token });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body || {};
    const email = sanitizeEmail(rawEmail);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getPrisma();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.suspended) {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }
    const token = signToken(user.id, user.isAdmin);
    const { passwordHash: _, ...safe } = user;
    res.json({ user: safe, token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email: rawEmail } = req.body || {};
    const email = sanitizeEmail(rawEmail);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = getPrisma();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || 'MConnect <no-reply@mconnect.com>',
      to: user.email,
      subject: 'Reset your MConnect password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#7c3aed">Reset your password</h2>
          <p>Hi ${user.fullName},</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
          <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log(`\n📧 Password reset email sent! Preview URL:\n${preview}\n`);
    }

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const db = getPrisma();
    const reset = await db.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.used || reset.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await db.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    });
    await db.passwordReset.update({
      where: { id: reset.id },
      data: { used: true },
    });

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

export default router;
