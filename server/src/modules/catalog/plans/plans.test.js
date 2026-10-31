import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { getNextBillingDate } from '../billingPeriod.js';
import { createPlansRouter } from './routes.js';

const JWT_SECRET = 'catalog-plans-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

function generateToken(role = 'ADMIN', userId = `${role.toLowerCase()}-1`) {
  return jwt.sign({ id: userId, email: `${role.toLowerCase()}@brightloop.test`, role }, JWT_SECRET);
}

function createTestApp(mockPrisma) {
  const app = express();
  app.use(express.json());
  app.use('/api/plans', createPlansRouter(mockPrisma));
  return app;
}

describe('Billing Period Helper: getNextBillingDate', () => {
  describe('DAILY cadence', () => {
    it('advances date by exactly 1 day', () => {
      const from = new Date('2024-01-15T00:00:00.000Z');
      const next = getNextBillingDate(from, 'DAILY');
      expect(next.toISOString().slice(0, 10)).toBe('2024-01-16');
    });

    it('advances across leap day on 28 Feb 2024 to 29 Feb 2024', () => {
      const from = new Date('2024-02-28T00:00:00.000Z');
      const next = getNextBillingDate(from, 'DAILY');
      expect(next.toISOString().slice(0, 10)).toBe('2024-02-29');
    });

    it('advances across non-leap 28 Feb 2023 to 01 Mar 2023', () => {
      const from = new Date('2023-02-28T00:00:00.000Z');
      const next = getNextBillingDate(from, 'DAILY');
      expect(next.toISOString().slice(0, 10)).toBe('2023-03-01');
    });
  });

  describe('WEEKLY cadence', () => {
    it('advances date by exactly 7 days', () => {
      const from = new Date('2024-01-01T00:00:00.000Z');
      const next = getNextBillingDate(from, 'WEEKLY');
      expect(next.toISOString().slice(0, 10)).toBe('2024-01-08');
    });
  });

  describe('MONTHLY cadence & month-end clamping', () => {
    it('clamps 31 Jan 2023 to 28 Feb 2023 in non-leap year', () => {
      const from = new Date(2023, 0, 31); // 31 Jan 2023
      const next = getNextBillingDate(from, 'MONTHLY');
      expect(next.getFullYear()).toBe(2023);
      expect(next.getMonth()).toBe(1); // Feb
      expect(next.getDate()).toBe(28);
    });

    it('clamps 31 Jan 2024 to 29 Feb 2024 in leap year', () => {
      const from = new Date(2024, 0, 31); // 31 Jan 2024
      const next = getNextBillingDate(from, 'MONTHLY');
      expect(next.getFullYear()).toBe(2024);
      expect(next.getMonth()).toBe(1); // Feb
      expect(next.getDate()).toBe(29);
    });

    it('clamps 31 Mar to 30 Apr', () => {
      const from = new Date(2024, 2, 31); // 31 Mar
      const next = getNextBillingDate(from, 'MONTHLY');
      expect(next.getMonth()).toBe(3); // Apr
      expect(next.getDate()).toBe(30);
    });

    it('clamps 31 Aug to 30 Sep', () => {
      const from = new Date(2024, 7, 31); // 31 Aug
      const next = getNextBillingDate(from, 'MONTHLY');
      expect(next.getMonth()).toBe(8); // Sep
      expect(next.getDate()).toBe(30);
    });

    it('advances mid-month date normally (15 Jan -> 15 Feb)', () => {
      const from = new Date(2024, 0, 15);
      const next = getNextBillingDate(from, 'MONTHLY');
      expect(next.getMonth()).toBe(1);
      expect(next.getDate()).toBe(15);
    });

    it('handles year boundary (31 Dec 2023 -> 31 Jan 2024)', () => {
      const from = new Date(2023, 11, 31);
      const next = getNextBillingDate(from, 'MONTHLY');
      expect(next.getFullYear()).toBe(2024);
      expect(next.getMonth()).toBe(0);
      expect(next.getDate()).toBe(31);
    });
  });

  describe('YEARLY cadence', () => {
    it('advances date by exactly 1 year', () => {
      const from = new Date(2023, 5, 15);
      const next = getNextBillingDate(from, 'YEARLY');
      expect(next.getFullYear()).toBe(2024);
      expect(next.getMonth()).toBe(5);
      expect(next.getDate()).toBe(15);
    });

    it('clamps leap day 29 Feb 2024 to 28 Feb 2025 in non-leap year', () => {
      const from = new Date(2024, 1, 29); // 29 Feb 2024
      const next = getNextBillingDate(from, 'YEARLY');
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(1);
      expect(next.getDate()).toBe(28);
    });
  });

  describe('Error handling', () => {
    it('throws error for invalid fromDate', () => {
      expect(() => getNextBillingDate('not-a-date', 'MONTHLY')).toThrow('Invalid fromDate');
    });

    it('throws error for unsupported billingPeriod', () => {
      expect(() => getNextBillingDate(new Date(), 'HOURLY')).toThrow('Invalid billingPeriod');
    });
  });
});

describe('Plan API Endpoints & RBAC', () => {
  let mockPrisma;
  let app;
  const adminToken = generateToken('ADMIN');
  const staffToken = generateToken('STAFF');
  const customerToken = generateToken('CUSTOMER');

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => ({
          id: where.id,
          email: `${where.id}@brightloop.test`,
          role: where.id.split('-')[0].toUpperCase(),
          customer: null,
        })),
      },
      plan: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };
    app = createTestApp(mockPrisma);
  });

  describe('Authentication & Roles', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/plans');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { message: 'Authentication required' } });
    });

    it('rejects customer role on GET /api/plans with 403', async () => {
      const res = await request(app)
        .get('/api/plans')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { message: 'Insufficient permissions' } });
    });

    it('allows staff role on GET /api/plans with 200', async () => {
      mockPrisma.plan.count.mockResolvedValue(0);
      mockPrisma.plan.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/plans')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.plans).toEqual([]);
      expect(res.body.pagination).toBeDefined();
    });

    it('rejects staff role on POST /api/plans with 403', async () => {
      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Pro Monthly',
          price: 9900,
          billingPeriod: 'MONTHLY',
          startDate: '2024-01-01',
        });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { message: 'Insufficient permissions' } });
    });

    it('rejects staff role on PUT /api/plans/:id with 403', async () => {
      const res = await request(app)
        .put('/api/plans/plan-1')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('rejects staff role on DELETE /api/plans/:id with 403', async () => {
      const res = await request(app)
        .delete('/api/plans/plan-1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Zod Validation: Dates and Constraints', () => {
    it('rejects plan when endDate is before startDate with 400', async () => {
      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pro Monthly',
          price: 9900,
          billingPeriod: 'MONTHLY',
          startDate: '2024-05-10',
          endDate: '2024-05-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('End date must be after start date');
    });

    it('rejects plan when endDate equals startDate with 400', async () => {
      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pro Monthly',
          price: 9900,
          billingPeriod: 'MONTHLY',
          startDate: '2024-05-10',
          endDate: '2024-05-10',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('End date must be after start date');
    });

    it('rejects negative price with 400', async () => {
      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pro Monthly',
          price: -500,
          billingPeriod: 'MONTHLY',
          startDate: '2024-01-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Price cannot be negative');
    });

    it('rejects invalid billingPeriod with 400', async () => {
      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pro Monthly',
          price: 5000,
          billingPeriod: 'QUARTERLY',
          startDate: '2024-01-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Billing period must be DAILY, WEEKLY, MONTHLY, or YEARLY');
    });
  });

  describe('Plan CRUD & Filtering', () => {
    it('creates a plan with all fields and flags with 201', async () => {
      const createdPlan = {
        id: 'plan-101',
        name: 'Enterprise Annual',
        price: 120000,
        billingPeriod: 'YEARLY',
        minQty: 5,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
        status: 'ACTIVE',
        autoClose: true,
        allowPause: true,
        allowEarlyClose: false,
        allowRenew: true,
        product: null,
      };
      mockPrisma.plan.create.mockResolvedValue(createdPlan);

      const res = await request(app)
        .post('/api/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Enterprise Annual',
          price: 120000,
          billingPeriod: 'YEARLY',
          minQty: 5,
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          autoClose: true,
          allowPause: true,
          allowEarlyClose: false,
          allowRenew: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Enterprise Annual');
      expect(res.body.price).toBe(120000);
      expect(res.body.autoClose).toBe(true);
      expect(res.body.allowEarlyClose).toBe(false);
    });

    it('returns 404 for unknown plan id', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/plans/unknown-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: 'Plan not found' } });
    });

    it('updates plan successfully with 200', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: 'plan-1',
        name: 'Old',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });
      mockPrisma.plan.update.mockResolvedValue({
        id: 'plan-1',
        name: 'Updated Plan Name',
        price: 15000,
      });

      const res = await request(app)
        .put('/api/plans/plan-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Plan Name', price: 15000 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Plan Name');
      expect(res.body.price).toBe(15000);
    });

    it('filters plans by status and availableOn date', async () => {
      mockPrisma.plan.count.mockResolvedValue(1);
      mockPrisma.plan.findMany.mockResolvedValue([
        { id: 'plan-1', name: 'Active Plan', status: 'ACTIVE' },
      ]);

      const res = await request(app)
        .get('/api/plans?status=ACTIVE&availableOn=2024-06-15&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.plans).toHaveLength(1);
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          AND: [
            { startDate: { lte: new Date('2024-06-15') } },
            {
              OR: [
                { endDate: null },
                { endDate: { gte: new Date('2024-06-15') } },
              ],
            },
          ],
        },
        skip: 0,
        take: 10,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('deletes plan successfully with 200', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan-1' });
      mockPrisma.plan.delete.mockResolvedValue({ id: 'plan-1' });

      const res = await request(app)
        .delete('/api/plans/plan-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Plan deleted successfully' });
      expect(mockPrisma.plan.delete).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
    });
  });

  describe('Plan Actions: pause, close, renew', () => {
    describe('POST /api/plans/:id/pause', () => {
      it('pauses an ACTIVE plan when allowPause is true', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'ACTIVE',
          allowPause: true,
        });
        mockPrisma.plan.update.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'PAUSED',
          allowPause: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/pause')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('PAUSED');
        expect(mockPrisma.plan.update).toHaveBeenCalledWith({
          where: { id: 'plan-1' },
          data: { status: 'PAUSED' },
          include: { product: true },
        });
      });

      it('returns 409 when plan has allowPause = false', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'ACTIVE',
          allowPause: false,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/pause')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Plan does not allow pausing' } });
      });

      it('returns 409 when plan is already PAUSED', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'PAUSED',
          allowPause: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/pause')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Plan is already paused' } });
      });

      it('returns 409 when plan is CLOSED', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'CLOSED',
          allowPause: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/pause')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Cannot pause a plan that is not ACTIVE' } });
      });

      it('returns 404 if plan does not exist', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(null);

        const res = await request(app)
          .post('/api/plans/non-existent/pause')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { message: 'Plan not found' } });
      });

      it('rejects staff role with 403', async () => {
        const res = await request(app)
          .post('/api/plans/plan-1/pause')
          .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/plans/:id/close', () => {
      it('closes an ACTIVE plan when allowEarlyClose is true', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'ACTIVE',
          allowEarlyClose: true,
        });
        mockPrisma.plan.update.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'CLOSED',
          allowEarlyClose: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/close')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CLOSED');
        expect(mockPrisma.plan.update).toHaveBeenCalledWith({
          where: { id: 'plan-1' },
          data: { status: 'CLOSED' },
          include: { product: true },
        });
      });

      it('closes a PAUSED plan when allowEarlyClose is true', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'PAUSED',
          allowEarlyClose: true,
        });
        mockPrisma.plan.update.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'CLOSED',
          allowEarlyClose: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/close')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('CLOSED');
      });

      it('returns 409 when allowEarlyClose is false', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'ACTIVE',
          allowEarlyClose: false,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/close')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Plan does not allow early close' } });
      });

      it('returns 409 when plan is already CLOSED', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'CLOSED',
          allowEarlyClose: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/close')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Plan is already closed' } });
      });

      it('returns 404 if plan does not exist', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(null);

        const res = await request(app)
          .post('/api/plans/non-existent/close')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
      });

      it('rejects customer role with 403', async () => {
        const res = await request(app)
          .post('/api/plans/plan-1/close')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe('POST /api/plans/:id/renew', () => {
      it('renews a CLOSED plan by extending endDate by one billing period and setting status ACTIVE', async () => {
        const oldEndDate = new Date('2024-01-31T00:00:00.000Z');
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'CLOSED',
          billingPeriod: 'MONTHLY',
          endDate: oldEndDate,
          allowRenew: true,
        });

        const expectedNewEndDate = getNextBillingDate(oldEndDate, 'MONTHLY');
        mockPrisma.plan.update.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'ACTIVE',
          billingPeriod: 'MONTHLY',
          endDate: expectedNewEndDate,
          allowRenew: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/renew')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ACTIVE');
        expect(mockPrisma.plan.update).toHaveBeenCalledWith({
          where: { id: 'plan-1' },
          data: {
            endDate: expectedNewEndDate,
            status: 'ACTIVE',
          },
          include: { product: true },
        });
      });

      it('renews an ACTIVE plan with YEARLY billing period', async () => {
        const currentEndDate = new Date('2024-02-29T00:00:00.000Z'); // Leap year
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-2',
          name: 'Annual Leap',
          status: 'ACTIVE',
          billingPeriod: 'YEARLY',
          endDate: currentEndDate,
          allowRenew: true,
        });

        const expectedNewEndDate = getNextBillingDate(currentEndDate, 'YEARLY');
        mockPrisma.plan.update.mockResolvedValue({
          id: 'plan-2',
          status: 'ACTIVE',
          endDate: expectedNewEndDate,
        });

        const res = await request(app)
          .post('/api/plans/plan-2/renew')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ACTIVE');
        expect(mockPrisma.plan.update).toHaveBeenCalledWith({
          where: { id: 'plan-2' },
          data: {
            endDate: expectedNewEndDate,
            status: 'ACTIVE',
          },
          include: { product: true },
        });
      });

      it('returns 409 when allowRenew is false', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Pro Monthly',
          status: 'CLOSED',
          billingPeriod: 'MONTHLY',
          endDate: new Date('2024-01-31'),
          allowRenew: false,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/renew')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Plan does not allow renewal' } });
      });

      it('returns 409 when plan has no endDate', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue({
          id: 'plan-1',
          name: 'Open Ended Plan',
          status: 'ACTIVE',
          billingPeriod: 'MONTHLY',
          endDate: null,
          allowRenew: true,
        });

        const res = await request(app)
          .post('/api/plans/plan-1/renew')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Cannot renew a plan with no end date' } });
      });

      it('returns 404 if plan does not exist', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(null);

        const res = await request(app)
          .post('/api/plans/non-existent/renew')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
      });

      it('rejects staff role with 403', async () => {
        const res = await request(app)
          .post('/api/plans/plan-1/renew')
          .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(403);
      });
    });
  });
});

