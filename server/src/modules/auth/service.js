import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
