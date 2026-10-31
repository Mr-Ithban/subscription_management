import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export function getPublicUser(user) {
  return {
    id: user.id,
    name: user.customer?.name ?? null,
    email: user.email,
    role: user.role,
  };
}

export async function loginUser(prisma, { email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { customer: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AuthError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return { token, user: getPublicUser(user) };
}

export class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export async function signupUser(prisma, { name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.$transaction((tx) =>
      tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          role: 'CUSTOMER',
          customer: { create: { name } },
        },
        select: {
          id: true,
          email: true,
          role: true,
          customer: { select: { name: true } },
        },
      })
    );

    return {
      id: user.id,
      name: user.customer.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AuthError('Email already registered', 409);
    }

    throw error;
  }
}

const PASSWORD_RESET_MESSAGE =
  'If an account exists for that email, password reset instructions have been sent.';

export async function forgotPassword(prisma, email, sendMail) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return PASSWORD_RESET_MESSAGE;
  }

  const token = randomBytes(32).toString('hex');
  const resetTokenHash = createHash('sha256').update(token).digest('hex');
  const configuredTtl = Number(process.env.RESET_TOKEN_TTL_MINUTES);
  const ttlMinutes = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 15;
  const resetExpiry = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash, resetExpiry },
  });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your Brightloop password',
      html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">Reset password</a></p>`,
    });
  } catch (error) {
    console.error('Unable to send password reset email', error);
  }

  return PASSWORD_RESET_MESSAGE;
}

export async function resetPassword(prisma, { token, password }) {
  const resetTokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.user.updateMany({
    where: { resetTokenHash, resetExpiry: { gt: new Date() } },
    data: { passwordHash, resetTokenHash: null, resetExpiry: null },
  });

  if (result.count !== 1) {
    throw new AuthError('Invalid or expired reset token', 400);
  }
}
