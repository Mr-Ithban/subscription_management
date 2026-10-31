import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createAuthenticate } from './authenticate.js';
import { authorize } from './authorize.js';

const secret = 'test-only-rbac-secret';

function createProtectedApp(role, allowedRoles) {
  const user = { id: 'user-1', email: 'user@example.test', role, customer: null };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const app = express();

  app.get(
    '/protected',
    createAuthenticate(prisma),
    authorize(...allowedRoles),
    (req, res) => res.status(200).json({ id: req.user.id, role: req.user.role })
  );

  return app;
}

function bearerToken(role) {
  return jwt.sign({ id: 'user-1', role }, secret, { expiresIn: '1h' });
}

beforeEach(() => {
  process.env.JWT_SECRET = secret;
});

describe('authorize middleware', () => {
  it('allows an ADMIN on an ADMIN-only route', async () => {
    const app = createProtectedApp('ADMIN', ['ADMIN']);
    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${bearerToken('ADMIN')}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'user-1', role: 'ADMIN' });
  });

  it('returns 403 when STAFF tries to use an ADMIN-only route', async () => {
    const app = createProtectedApp('STAFF', ['ADMIN']);
    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${bearerToken('STAFF')}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { message: 'Insufficient permissions' } });
  });

  it('allows any explicitly listed role and rejects CUSTOMER when omitted', async () => {
    const staffApp = createProtectedApp('STAFF', ['ADMIN', 'STAFF']);
    const staffResponse = await request(staffApp)
      .get('/protected')
      .set('Authorization', `Bearer ${bearerToken('STAFF')}`);
    const customerApp = createProtectedApp('CUSTOMER', ['ADMIN', 'STAFF']);
    const customerResponse = await request(customerApp)
      .get('/protected')
      .set('Authorization', `Bearer ${bearerToken('CUSTOMER')}`);

    expect(staffResponse.status).toBe(200);
    expect(customerResponse.status).toBe(403);
  });

  it('rejects empty or unknown role policies at route setup', () => {
    expect(() => authorize()).toThrow('authorize requires one or more valid roles');
    expect(() => authorize('OWNER')).toThrow('authorize requires one or more valid roles');
  });
});
