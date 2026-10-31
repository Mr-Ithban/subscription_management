import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { createPaymentsRouter, createInvoicePaymentsRouter } from './routes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

const JWT_SECRET = 'payments-test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

function generateToken(role = 'ADMIN', userId = `${role.toLowerCase()}-1`) {
  return jwt.sign(
    { id: userId, email: `${role.toLowerCase()}@brightloop.test`, role },
    JWT_SECRET
  );
}

function createTestApp(mockPrisma) {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', createPaymentsRouter(mockPrisma));
  app.use('/api/invoices', createInvoicePaymentsRouter(mockPrisma));
  app.use(errorHandler);
  return app;
}

describe('Payments API Endpoints (M4-2)', () => {
  let mockPrisma;
  let app;
  const adminToken = generateToken('ADMIN');
  const staffToken = generateToken('STAFF');
  const customerToken = generateToken('CUSTOMER');

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === 'admin-1') return { id: 'admin-1', role: 'ADMIN' };
          if (where.id === 'staff-1') return { id: 'staff-1', role: 'STAFF' };
          if (where.id === 'customer-1') return { id: 'customer-1', role: 'CUSTOMER' };
          return null;
        }),
      },
      invoice: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    };

    app = createTestApp(mockPrisma);
  });

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated requests to POST /api/invoices/:id/payments with 401', async () => {
      const res = await request(app)
        .post('/api/invoices/inv-1/payments')
        .send({ method: 'UPI', amount: 5000 });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Authentication required/i);
    });

    it('rejects CUSTOMER role on POST /api/invoices/:id/payments with 403', async () => {
      const res = await request(app)
        .post('/api/invoices/inv-1/payments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ method: 'UPI', amount: 5000 });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Insufficient permissions/i);
    });

    it('allows STAFF role on POST /api/invoices/:id/payments', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        number: 'INV-2026-001',
        status: 'CONFIRMED',
        total: 10000,
        amountPaid: 0,
      });
      mockPrisma.invoice.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'pay-1',
        invoiceId: 'inv-1',
        method: 'UPI',
        amount: 5000,
        paidAt: new Date(),
      });

      const res = await request(app)
        .post('/api/invoices/inv-1/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ method: 'UPI', amount: 5000 });

      expect(res.status).toBe(201);
      expect(res.body.payment.amount).toBe(5000);
      expect(res.body.invoice.status).toBe('CONFIRMED');
    });
  });

  describe('POST /api/invoices/:id/payments - Business Rules', () => {
    it('partial payment keeps invoice CONFIRMED and updates amountPaid', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-100',
        number: 'INV-2026-00100',
        status: 'CONFIRMED',
        total: 10000,
        amountPaid: 2000,
      });
      mockPrisma.invoice.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'pay-100',
        invoiceId: 'inv-100',
        method: 'CARD',
        amount: 3000,
        paidAt: new Date(),
      });

      const res = await request(app)
        .post('/api/invoices/inv-100/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'CARD', amount: 3000, note: 'Partial installment' });

      expect(res.status).toBe(201);
      expect(res.body.invoice.status).toBe('CONFIRMED');
      expect(res.body.invoice.amountPaid).toBe(5000);
      expect(res.body.invoice.remainingBalance).toBe(5000);
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'inv-100',
          status: 'CONFIRMED',
          amountPaid: 2000,
          total: { gte: 5000 },
        },
        data: {
          amountPaid: 5000,
          status: 'CONFIRMED',
        },
      });
    });

    it('final payment sets invoice status to PAID when amountPaid equals total', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-200',
        number: 'INV-2026-00200',
        status: 'CONFIRMED',
        total: 10000,
        amountPaid: 6000,
      });
      mockPrisma.invoice.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'pay-200',
        invoiceId: 'inv-200',
        method: 'BANK_TRANSFER',
        amount: 4000,
        paidAt: new Date(),
      });

      const res = await request(app)
        .post('/api/invoices/inv-200/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'BANK_TRANSFER', amount: 4000 });

      expect(res.status).toBe(201);
      expect(res.body.invoice.status).toBe('PAID');
      expect(res.body.invoice.amountPaid).toBe(10000);
      expect(res.body.invoice.remainingBalance).toBe(0);
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'inv-200',
          status: 'CONFIRMED',
          amountPaid: 6000,
          total: { gte: 10000 },
        },
        data: {
          amountPaid: 10000,
          status: 'PAID',
        },
      });
    });

    it('rejects overpayment exceeding remaining balance with 400', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-300',
        status: 'CONFIRMED',
        total: 5000,
        amountPaid: 4000, // remaining balance is 1000
      });

      const res = await request(app)
        .post('/api/invoices/inv-300/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'CASH', amount: 1500 }); // 1500 > 1000

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/cannot exceed remaining balance/i);
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects payment on DRAFT invoice with 409', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-draft',
        status: 'DRAFT',
        total: 5000,
        amountPaid: 0,
      });

      const res = await request(app)
        .post('/api/invoices/inv-draft/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'ONLINE', amount: 2000 });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/only be recorded for CONFIRMED invoices/i);
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects payment on CANCELLED invoice with 409', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-cancelled',
        status: 'CANCELLED',
        total: 5000,
        amountPaid: 0,
      });

      const res = await request(app)
        .post('/api/invoices/inv-cancelled/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'ONLINE', amount: 2000 });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/Cannot record payment for a CANCELLED invoice/i);
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects payment on already PAID invoice with 409', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-paid',
        status: 'PAID',
        total: 5000,
        amountPaid: 5000,
      });

      const res = await request(app)
        .post('/api/invoices/inv-paid/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'ONLINE', amount: 1000 });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already paid in full/i);
    });

    it('returns 404 when invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/invoices/inv-nonexistent/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'ONLINE', amount: 1000 });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/Invoice not found/i);
    });

    it('returns 409 on concurrent payment conflict if conditional update count is 0', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-concurrent',
        status: 'CONFIRMED',
        total: 10000,
        amountPaid: 0,
      });
      // Simulate another transaction modifying the row concurrently
      mockPrisma.invoice.updateMany.mockResolvedValueOnce({ count: 0 });

      const res = await request(app)
        .post('/api/invoices/inv-concurrent/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'UPI', amount: 5000 });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/Concurrent payment conflict/i);
    });
  });

  describe('Zod Validation for Payments', () => {
    it('rejects non-positive amount with 400', async () => {
      const res = await request(app)
        .post('/api/invoices/inv-1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'UPI', amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/positive integer/i);
    });

    it('rejects negative amount with 400', async () => {
      const res = await request(app)
        .post('/api/invoices/inv-1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'UPI', amount: -500 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/positive integer/i);
    });

    it('rejects float amount with 400', async () => {
      const res = await request(app)
        .post('/api/invoices/inv-1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'UPI', amount: 49.99 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/must be an integer/i);
    });

    it('rejects invalid payment method with 400', async () => {
      const res = await request(app)
        .post('/api/invoices/inv-1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ method: 'BITCOIN', amount: 5000 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Invalid payment method/i);
    });
  });

  describe('GET /api/payments', () => {
    it('returns paginated list of payments with filters', async () => {
      const mockPayments = [
        { id: 'p1', invoiceId: 'inv-1', method: 'UPI', amount: 5000, paidAt: new Date() },
      ];
      mockPrisma.payment.count.mockResolvedValueOnce(1);
      mockPrisma.payment.findMany.mockResolvedValueOnce(mockPayments);

      const res = await request(app)
        .get('/api/payments?invoiceId=inv-1&method=UPI&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(res.body.data).toHaveLength(1);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { invoiceId: 'inv-1', method: 'UPI' },
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe('GET /api/invoices/:id/payments', () => {
    it('returns payments for a specific invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({ id: 'inv-1' });
      mockPrisma.payment.count.mockResolvedValueOnce(2);
      mockPrisma.payment.findMany.mockResolvedValueOnce([
        { id: 'p1', amount: 3000 },
        { id: 'p2', amount: 2000 },
      ]);

      const res = await request(app)
        .get('/api/invoices/inv-1/payments?page=1&limit=20')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });

    it('returns 404 if invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/invoices/inv-missing/payments')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/Invoice not found/i);
    });
  });
});

