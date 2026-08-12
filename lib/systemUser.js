import bcrypt from 'bcrypt';

export const SYSTEM_EMAIL = 'system@mconnect.com';

let cachedSystemUserId = null;

export async function ensureSystemUser(prisma) {
  if (cachedSystemUserId) return cachedSystemUserId;
  let system = await prisma.user.findUnique({ where: { email: SYSTEM_EMAIL } });
  if (!system) {
    system = await prisma.user.create({
      data: {
        fullName: 'Mentor Connect',
        email: SYSTEM_EMAIL,
        passwordHash: await bcrypt.hash(Math.random().toString(36).slice(2), 10),
        bio: 'Official Mentor Connect system account.',
      },
    });
  }
  cachedSystemUserId = system.id;
  return system.id;
}
