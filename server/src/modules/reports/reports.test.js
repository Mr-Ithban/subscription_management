import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import {
  getFinanceSummary,
  getRevenueBreakdown,
  getSubscriptionsReport,
  getOverdueReport,
  getMRR,
  clearSummaryCache,
  getISOWeekString,
} from './service.js';
import { createReportsRouter } from './routes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

const JWT_SECRET = 'reports-test-jwt-secret';
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
  app.use('/api/reports', createReportsRouter(mockPrisma));
  app.use(errorHandler);
  return app;
}

// ======================================================================
// M4-4 Finance Reports Unit & Integration Tests
// ======================================================================

describe('M4-4 Finance Reports Service & Endpoints', () => {
  beforeEach(() => {
    clearSummaryCache();
  });

  // ====================================================================
  // 1. getFinanceSummary (Unit)
  // ====================================================================
  describe('getFinanceSummary', () => {
    let mockPrisma;

    beforeEach(() => {
      mockPrisma = {
        subscription: {
          count: jest.fn(),
          groupBy: jest.fn(),
        },
        plan: {
          findMany: jest.fn(),
        },
        payment: {
          aggregate: jest.fn(),
        },
        invoice: {
          aggregate: jest.fn(),
        },
      };
    });

    it('returns all-zero summary when database is empty', async () => {
      mockPrisma.subscription.count.mockResolvedValueOnce(0);
      mockPrisma.subscription.groupBy
        .mockResolvedValueOnce([]) // status group
        .mockResolvedValueOnce([]); // active plan group
      mockPrisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } });
      mockPrisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: null } }) // invoiced
        .mockResolvedValueOnce({ _sum: { total: null, amountPaid: null } }) // confirmed
        .mockResolvedValueOnce({ _count: { _all: 0 }, _sum: { total: null, amountPaid: null } }); // overdue

      const result = await getFinanceSummary(mockPrisma, { skipCache: true });

      expect(result.activeSubscriptionCount).toBe(0);
      expect(result.revenue).toBe(0);
      expect(result.invoicedTotal).toBe(0);
      expect(result.outstandingTotal).toBe(0);
      expect(result.overdueCount).toBe(0);
      expect(result.overdueAmount).toBe(0);
      expect(result.mrr).toBe(0);
      expect(result.subscriptionsByStatus).toEqual({
        DRAFT: 0,
        QUOTATION: 0,
        CONFIRMED: 0,
        ACTIVE: 0,
        CLOSED: 0,
      });
    });

    it('correctly aggregates summary metrics and computes MRR', async () => {
      // 3 active subscriptions
      mockPrisma.subscription.count.mockResolvedValueOnce(3);
      // Status group
      mockPrisma.subscription.groupBy
        .mockResolvedValueOnce([
          { status: 'ACTIVE', _count: { _all: 3 } },
          { status: 'DRAFT', _count: { _all: 1 } },
        ])
        // Active plan group for MRR
        .mockResolvedValueOnce([
          { planId: 'plan-monthly', _count: { _all: 2 } },
          { planId: 'plan-yearly', _count: { _all: 1 } },
        ]);

      mockPrisma.plan.findMany.mockResolvedValueOnce([
        { id: 'plan-monthly', price: 1000, billingPeriod: 'MONTHLY' },
        { id: 'plan-yearly', price: 12000, billingPeriod: 'YEARLY' },
      ]);

      // Revenue: 50000
      mockPrisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: 50000 } });

      // Invoiced total: 80000
      mockPrisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: 80000 } })
        // Confirmed balance: total 40000, paid 15000 => outstanding 25000
        .mockResolvedValueOnce({ _sum: { total: 40000, amountPaid: 15000 } })
        // Overdue: 2 invoices, total 20000, paid 5000 => overdue 15000
        .mockResolvedValueOnce({ _count: { _all: 2 }, _sum: { total: 20000, amountPaid: 5000 } });

      const result = await getFinanceSummary(mockPrisma, { skipCache: true });

      expect(result.activeSubscriptionCount).toBe(3);
      expect(result.subscriptionsByStatus.ACTIVE).toBe(3);
      expect(result.subscriptionsByStatus.DRAFT).toBe(1);
      expect(result.revenue).toBe(50000);
      expect(result.invoicedTotal).toBe(80000);
      expect(result.outstandingTotal).toBe(25000);
      expect(result.overdueCount).toBe(2);
      expect(result.overdueAmount).toBe(15000);
      // MRR = 2 * 1000 (monthly) + 1 * (12000 / 12) (yearly) = 2000 + 1000 = 3000
      expect(result.mrr).toBe(3000);
    });

    it('caches summary in memory for subsequent calls within TTL', async () => {
      mockPrisma.subscription.count.mockResolvedValueOnce(5);
      mockPrisma.subscription.groupBy
        .mockResolvedValueOnce([{ status: 'ACTIVE', _count: { _all: 5 } }])
        .mockResolvedValueOnce([]);
      mockPrisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: 1000 } });
      mockPrisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: 2000 } })
        .mockResolvedValueOnce({ _sum: { total: 2000, amountPaid: 1000 } })
        .mockResolvedValueOnce({ _count: { _all: 0 }, _sum: { total: 0, amountPaid: 0 } });

      const call1 = await getFinanceSummary(mockPrisma, {});
      expect(call1.activeSubscriptionCount).toBe(5);

      // Second call should come from cache without invoking prisma
      const call2 = await getFinanceSummary(mockPrisma, {});
      expect(call2.activeSubscriptionCount).toBe(5);
      expect(mockPrisma.subscription.count).toHaveBeenCalledTimes(1);
    });
  });

  // ====================================================================
  // 2. getRevenueBreakdown (Unit)
  // ====================================================================
  describe('getRevenueBreakdown', () => {
    let mockPrisma;

    beforeEach(() => {
      mockPrisma = {
        payment: { findMany: jest.fn() },
      };
    });

    it('groups payments by month by default', async () => {
      mockPrisma.payment.findMany.mockResolvedValueOnce([
        { amount: 5000, paidAt: new Date('2026-09-10T00:00:00Z') },
        { amount: 3000, paidAt: new Date('2026-09-25T00:00:00Z') },
        { amount: 7000, paidAt: new Date('2026-10-05T00:00:00Z') },
      ]);

      const result = await getRevenueBreakdown(mockPrisma, {});

      expect(result.groupBy).toBe('month');
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0]).toEqual({ period: '2026-09', revenue: 8000, paymentCount: 2 });
      expect(result.breakdown[1]).toEqual({ period: '2026-10', revenue: 7000, paymentCount: 1 });
      expect(result.totalRevenue).toBe(15000);
    });

    it('groups payments by day when groupBy=day', async () => {
      mockPrisma.payment.findMany.mockResolvedValueOnce([
        { amount: 2000, paidAt: new Date('2026-10-01T00:00:00Z') },
        { amount: 3000, paidAt: new Date('2026-10-01T12:00:00Z') },
        { amount: 4000, paidAt: new Date('2026-10-02T00:00:00Z') },
      ]);

      const result = await getRevenueBreakdown(mockPrisma, { groupBy: 'day' });

      expect(result.groupBy).toBe('day');
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0]).toEqual({ period: '2026-10-01', revenue: 5000, paymentCount: 2 });
      expect(result.breakdown[1]).toEqual({ period: '2026-10-02', revenue: 4000, paymentCount: 1 });
    });

    it('groups payments by week when groupBy=week', async () => {
      const d1 = new Date('2026-10-05T00:00:00Z');
      const d2 = new Date('2026-10-06T00:00:00Z');
      const weekStr = getISOWeekString(d1);

      mockPrisma.payment.findMany.mockResolvedValueOnce([
        { amount: 1500, paidAt: d1 },
        { amount: 2500, paidAt: d2 },
      ]);

      const result = await getRevenueBreakdown(mockPrisma, { groupBy: 'week' });

      expect(result.groupBy).toBe('week');
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0]).toEqual({ period: weekStr, revenue: 4000, paymentCount: 2 });
    });

    it('throws 400 on invalid groupBy parameter', async () => {
      await expect(getRevenueBreakdown(mockPrisma, { groupBy: 'quarter' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ====================================================================
  // 3. getSubscriptionsReport & getOverdueReport & getMRR (Unit)
  // ====================================================================
  describe('getSubscriptionsReport, getOverdueReport and getMRR', () => {
    let mockPrisma;

    beforeEach(() => {
      mockPrisma = {
        subscription: {
          count: jest.fn(),
          findMany: jest.fn(),
        },
        invoice: {
          count: jest.fn(),
          findMany: jest.fn(),
        },
      };
    });

    it('returns filtered and paginated subscriptions list', async () => {
      mockPrisma.subscription.count.mockResolvedValueOnce(1);
      mockPrisma.subscription.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          number: 'SUB-2026-00001',
          status: 'ACTIVE',
          customerId: 'cust-1',
          customer: { id: 'cust-1', name: 'Acme Corp' },
          plan: { id: 'plan-1', name: 'Pro', price: 9900, billingPeriod: 'MONTHLY' },
        },
      ]);

      const result = await getSubscriptionsReport(mockPrisma, {
        filters: { status: 'ACTIVE', customerId: 'cust-1' },
        pagination: { page: 1, limit: 10, skip: 0 },
      });

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', customerId: 'cust-1' },
          skip: 0,
          take: 10,
        })
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('returns overdue report using getOverdueReport', async () => {
      mockPrisma.invoice.count.mockResolvedValueOnce(1);
      mockPrisma.invoice.findMany.mockResolvedValueOnce([
        {
          id: 'inv-1',
          number: 'INV-100',
          status: 'CONFIRMED',
          dueDate: new Date('2026-01-01'),
          total: 10000,
          amountPaid: 2000,
        },
      ]);

      const result = await getOverdueReport(mockPrisma, {
        customerId: 'cust-1',
        asOf: new Date('2026-02-01'),
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].remainingBalance).toBe(8000);
      expect(result.data[0].daysOverdue).toBe(31);
    });

    it('calculates MRR breakdown using getMRR', async () => {
      mockPrisma.subscription.findMany.mockResolvedValueOnce([
        {
          id: 's1',
          planId: 'p1',
          plan: { id: 'p1', name: 'Pro', price: 5000, billingPeriod: 'MONTHLY' },
        },
        {
          id: 's2',
          planId: 'p2',
          plan: { id: 'p2', name: 'Annual', price: 12000, billingPeriod: 'YEARLY' },
        },
      ]);

      const result = await getMRR(mockPrisma);
      expect(result.mrr).toBe(6000); // 5000 + 1000
      expect(result.activeSubscriptions).toBe(2);
      expect(result.breakdown).toHaveLength(2);
    });
  });

  // ====================================================================
  // 4. Endpoints via Supertest (Integration)
  // ====================================================================
  describe('HTTP Endpoints & Authorization', () => {
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
        subscription: {
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
          findMany: jest.fn().mockResolvedValue([]),
        },
        plan: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        payment: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        invoice: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn().mockResolvedValue({ _sum: { total: null, amountPaid: null }, _count: { _all: 0 } }),
        },
      };

      app = createTestApp(mockPrisma);
    });

    it('rejects unauthenticated request to /api/reports/summary with 401', async () => {
      const res = await request(app).get('/api/reports/summary');
      expect(res.status).toBe(401);
    });

    it('rejects CUSTOMER role on /api/reports/summary with 403', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('allows ADMIN on /api/reports/summary with 200', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activeSubscriptionCount');
      expect(res.body).toHaveProperty('revenue');
      expect(res.body).toHaveProperty('mrr');
    });

    it('allows STAFF on /api/reports/summary with 200', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/reports/revenue returns 200 with breakdown', async () => {
      const res = await request(app)
        .get('/api/reports/revenue?groupBy=month')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('breakdown');
      expect(res.body.groupBy).toBe('month');
    });

    it('GET /api/reports/revenue rejects invalid groupBy with 400', async () => {
      const res = await request(app)
        .get('/api/reports/revenue?groupBy=invalid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('GET /api/reports/subscriptions returns paginated list', async () => {
      const res = await request(app)
        .get('/api/reports/subscriptions?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
    });

    it('GET /api/reports/overdue returns overdue invoices report', async () => {
      const res = await request(app)
        .get('/api/reports/overdue')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('summary');
    });
  });
});
