import bcrypt from 'bcrypt';

export class SignupError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'SignupError';
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
      throw new SignupError('Email already registered', 409);
    }

    throw error;
  }
}
