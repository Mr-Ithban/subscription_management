import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createPortalRouter } from './routes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

const JWT_SECRET = 'portal-test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

function generateToken(role = 'CUSTOMER', userId = `${role.toLowerCase()}-1`) {
  return jwt.sign(
    { id: userId, email: `${role.toLowerCase()}@brightloop.test`, role },
    JWT_SECRET
  );
}

function createTestApp(mockPrisma) {
  const app = express();
  app.use(express.json());
  app.use('/api/portal', createPortalRouter(mockPrisma));
  app.use(errorHandler);
  return app;
}

describe('Portal API Endpoints (M4-7)', () => {
  let mockPrisma;
  let app;
  const customerToken = generateToken('CUSTOMER', 'cust-user-1');
  const staffToken = generateToken('STAFF', 'staff-user-1');

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === 'cust-user-1') {
            return {
              id: 'cust-user-1',
              role: 'CUSTOMER',
              customer: { id: 'cust-record-1' },
            };
          }
          if (where.id === 'staff-user-1') {
            return {
              id: 'staff-user-1',
              role: 'STAFF',
            };
          }
          return null;
        }),
      },
      payment: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pay-1',
            invoiceId: 'inv-1',
            method: 'CARD',
            amount: 5000,
            paidAt: new Date('2026-10-01'),
            invoice: { id: 'inv-1', number: 'INV-001', total: 5000, status: 'PAID' },
          },
        ]),
      },
    };

    app = createTestApp(mockPrisma);
  });

  it('rejects unauthenticated requests to GET /api/portal/payments with 401', async () => {
    const res = await request(app).get('/api/portal/payments');
    expect(res.status).toBe(401);
  });

  it('rejects non-CUSTOMER roles on GET /api/portal/payments with 403', async () => {
    const res = await request(app)
      .get('/api/portal/payments')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('allows CUSTOMER and scopes payments to logged-in customer id', async () => {
    const res = await request(app)
      .get('/api/portal/payments')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveLength(1);
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoice: { customerId: 'cust-record-1' } },
      })
    );
  });
});

