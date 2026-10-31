import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createAuthRouter } from './routes.js';

const email = 'ada@example.test';
const nextPassword = 'UpdatedPass!';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createHarness({ userExists = true, resetToken, resetExpiry } = {}) {
  const user = userExists
    ? {
        id: 'user-1',
        email,
        passwordHash: 'old-password-hash',
        resetTokenHash: resetToken ? hashToken(resetToken) : null,
        resetExpiry: resetExpiry ?? null,
      }
    : null;

  const prisma = {
    user: {
      findUnique: jest.fn().mockImplementation(async () => user),
      update: jest.fn().mockImplementation(async ({ data }) => Object.assign(user, data)),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        if (
          !user ||
          user.resetTokenHash !== where.resetTokenHash ||
          !user.resetExpiry ||
          user.resetExpiry <= where.resetExpiry.gt
        ) {
          return { count: 0 };
        }

        Object.assign(user, data);
        return { count: 1 };
      }),
    },
  };
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'mail-1' });
  const app = express();

  app.use(express.json());
  app.use('/api/auth', createAuthRouter(prisma, sendMail));

  return { app, user, prisma, sendMail };
}

beforeEach(() => {
  process.env.CLIENT_URL = 'https://brightloop.test';
  process.env.RESET_TOKEN_TTL_MINUTES = '15';
});

describe('password reset endpoints', () => {
  it('sends a reset link and resets the password once', async () => {
    const { app, user, prisma, sendMail } = createHarness();
    const forgotResponse = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ADA@example.test' });
    const sentMessage = sendMail.mock.calls[0][0];
    const token = sentMessage.html.match(/token=([a-f0-9]{64})/)[1];

    expect(forgotResponse.status).toBe(200);
    expect(forgotResponse.body.message).toBe(
      'If an account exists for that email, password reset instructions have been sent.'
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        subject: expect.any(String),
        html: expect.stringContaining('https://brightloop.test/reset-password?token='),
      })
    );
    expect(user.resetTokenHash).toBe(hashToken(token));
    expect(user.resetTokenHash).not.toBe(token);
    expect(user.resetExpiry.getTime()).toBeGreaterThan(Date.now());

    const resetResponse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: nextPassword });

    expect(resetResponse.status).toBe(200);
    expect(await bcrypt.compare(nextPassword, user.passwordHash)).toBe(true);
    expect(user.resetTokenHash).toBeNull();
    expect(user.resetExpiry).toBeNull();
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { resetTokenHash: hashToken(token), resetExpiry: { gt: expect.any(Date) } },
      data: {
        passwordHash: expect.any(String),
        resetTokenHash: null,
        resetExpiry: null,
      },
    });
  });

  it('returns the same generic response when the email is unknown', async () => {
    const { app, sendMail } = createHarness({ userExists: false });
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      'If an account exists for that email, password reset instructions have been sent.'
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects an expired reset token', async () => {
    const token = 'expired-token';
    const { app } = createHarness({
      resetToken: token,
      resetExpiry: new Date(Date.now() - 60_000),
    });
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: nextPassword });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Invalid or expired reset token');
  });

  it('rejects a token after it has already been used', async () => {
    const token = 'one-time-token';
    const { app } = createHarness({
      resetToken: token,
      resetExpiry: new Date(Date.now() + 60_000),
    });
    const firstResponse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: nextPassword });
    const reusedResponse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: nextPassword });

    expect(firstResponse.status).toBe(200);
    expect(reusedResponse.status).toBe(400);
    expect(reusedResponse.body.error.message).toBe('Invalid or expired reset token');
  });
});
