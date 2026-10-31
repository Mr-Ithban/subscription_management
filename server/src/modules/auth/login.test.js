import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createAuthRouter } from './routes.js';

const secret = 'test-only-jwt-secret';
const password = 'CorrectPass!';
let customerUser;

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.JWT_EXPIRES_IN = '1h';
  customerUser = {
    id: 'user-1',
    email: 'ada@example.test',
    passwordHash: await bcrypt.hash(password, 10),
    role: 'CUSTOMER',
    customer: {
      id: 'customer-1',
      userId: 'user-1',
      name: 'Ada Lovelace',
      phone: null,
      address: null,
    },
  };
});

function createTestApp({ findUser } = {}) {
  const findUnique = findUser ?? jest.fn().mockResolvedValue(customerUser);
  const prisma = { user: { findUnique } };
  const app = express();

  app.use(express.json());
  app.use('/api/auth', createAuthRouter(prisma));

  return { app, findUnique };
}

describe('POST /api/auth/login', () => {
  it('returns a JWT and public user details for valid credentials', async () => {
    const { app, findUnique } = createTestApp();
    const response = await request(app).post('/api/auth/login').send({
      email: 'ADA@example.test',
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      role: 'CUSTOMER',
    });
    expect(response.body.token).toEqual(expect.any(String));
    expect(jwt.verify(response.body.token, secret)).toMatchObject({
      id: 'user-1',
      role: 'CUSTOMER',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.test' },
      include: { customer: true },
    });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('returns the invalid-credentials error for a wrong password', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.test', password: 'WrongPassword!' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { message: 'Invalid email or password' } });
  });

  it('returns the same invalid-credentials error for an unknown email', async () => {
    const { app } = createTestApp({ findUser: jest.fn().mockResolvedValue(null) });
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.test', password });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { message: 'Invalid email or password' } });
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a Bearer token', async () => {
    const { app, findUnique } = createTestApp();
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Authentication required');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns the current user and customer profile with a valid token', async () => {
    const { app, findUnique } = createTestApp();
    const token = jwt.sign({ id: 'user-1', role: 'CUSTOMER' }, secret, { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 'user-1',
        name: 'Ada Lovelace',
        email: 'ada@example.test',
        role: 'CUSTOMER',
      },
      customer: customerUser.customer,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { customer: true },
    });
  });
});
