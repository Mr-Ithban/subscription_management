import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createStaffRouter } from './staff.js';

const secret = 'staff-test-secret';
process.env.JWT_SECRET = secret;
const token = (role) => jwt.sign({ id: `${role.toLowerCase()}-1`, role }, secret);

function setup(role = 'ADMIN') {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: `${role.toLowerCase()}-1`, role, customer: null }),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([{ id: 'staff-1', name: 'Sam Staff', email: 'sam@example.test', role: 'STAFF', createdAt: new Date() }]),
      create: jest.fn().mockImplementation(async ({ data, select }) => ({ id: 'staff-new', ...Object.fromEntries(Object.keys(select).filter((key) => key !== 'id').map((key) => [key, data[key]])) })),
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/staff', createStaffRouter(prisma));
  return { app, prisma };
}

describe('staff administration', () => {
  it('lets admin create and list staff without password hashes', async () => {
    const { app, prisma } = setup();
    const created = await request(app).post('/api/staff').set('Authorization', `Bearer ${token('ADMIN')}`).send({ name: 'Sam Staff', email: 'SAM@example.test', password: 'StrongPass!' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ role: 'STAFF', email: 'sam@example.test', name: 'Sam Staff' });
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toEqual(expect.any(String));
    expect(created.body.passwordHash).toBeUndefined();

    const listed = await request(app).get('/api/staff').set('Authorization', `Bearer ${token('ADMIN')}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({ page: 1, limit: 20, total: 1, data: [{ role: 'STAFF', name: 'Sam Staff' }] });
  });

  it.each(['STAFF', 'CUSTOMER'])('rejects %s from staff administration', async (role) => {
    const { app } = setup(role);
    const response = await request(app).get('/api/staff').set('Authorization', `Bearer ${token(role)}`);
    expect(response.status).toBe(403);
  });
});
