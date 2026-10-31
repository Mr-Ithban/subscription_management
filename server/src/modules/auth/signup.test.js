import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createAuthRouter } from './routes.js';

const validInput = {
  name: 'Ada Lovelace',
  email: 'ADA@example.test',
  password: 'StrongPass!',
};

function createTestApp({ createUser } = {}) {
  const tx = {
    user: {
      create: createUser ?? jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.test',
        role: 'CUSTOMER',
        customer: { name: 'Ada Lovelace' },
      }),
    },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
  const app = express();

  app.use(express.json());
  app.use('/api/auth', createAuthRouter(prisma));

  return { app, prisma, tx };
}

describe('POST /api/auth/signup', () => {
  it('rejects a password of exactly 8 characters', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ ...validInput, password: 'Aa1234!x' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('at least 9 characters');
  });

  it('rejects a password with no uppercase letter', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ ...validInput, password: 'validpass!' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('uppercase letter');
  });

  it('rejects a password with no lowercase letter', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ ...validInput, password: 'VALIDPASS!' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('lowercase letter');
  });

  it('rejects a password with no special character', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ ...validInput, password: 'ValidPass1' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('special character');
  });

  it('returns 409 when the email is already registered', async () => {
    const createUser = jest.fn().mockRejectedValue({ code: 'P2002' });
    const { app, prisma } = createTestApp({ createUser });
    const response = await request(app).post('/api/auth/signup').send({ ...validInput, role: 'ADMIN' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { message: 'Email already registered' } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('creates a customer, hashes the password, and returns only public fields', async () => {
    const createUser = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'user-1',
      email: data.email,
      role: data.role,
      customer: { name: data.customer.create.name },
      passwordHash: data.passwordHash,
    }));
    const { app, prisma } = createTestApp({ createUser });
    const response = await request(app).post('/api/auth/signup').send(validInput);
    const { data } = createUser.mock.calls[0][0];

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      role: 'CUSTOMER',
    });
    expect(response.body.passwordHash).toBeUndefined();
    expect(data.email).toBe('ada@example.test');
    expect(data.role).toBe('CUSTOMER');
    expect(data.customer).toEqual({ create: { name: 'Ada Lovelace' } });
    expect(data.passwordHash).not.toBe(validInput.password);
    expect(await bcrypt.compare(validInput.password, data.passwordHash)).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
