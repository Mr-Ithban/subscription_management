import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { getDiscountStatus } from './service.js';
import { createDiscountsRouter } from './routes.js';

const JWT_SECRET = 'catalog-discounts-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

function generateToken(role = 'ADMIN', userId = `${role.toLowerCase()}-1`) {
  return jwt.sign({ id: userId, email: `${role.toLowerCase()}@brightloop.test`, role }, JWT_SECRET);
}

function createTestApp(mockPrisma) {
  const app = express();
  app.use(express.json());
  app.use('/api/discounts', createDiscountsRouter(mockPrisma));
  return app;
}

describe('Discount Status Computation Helper: getDiscountStatus', () => {
  const baseDiscount = {
    id: 'disc-1',
    name: 'Promo',
    startDate: new Date('2024-01-01T00:00:00.000Z'),
    endDate: new Date('2024-12-31T23:59:59.000Z'),
    usageLimit: 100,
    usedCount: 5,
    active: true,
  };

  it('returns "active" when within dates and under usage limit', () => {
    const status = getDiscountStatus(baseDiscount, new Date('2024-06-01T00:00:00.000Z'));
    expect(status).toBe('active');
  });

  it('returns "exhausted" when usedCount equals usageLimit', () => {
    const exhaustedDiscount = { ...baseDiscount, usedCount: 100, usageLimit: 100 };
    const status = getDiscountStatus(exhaustedDiscount, new Date('2024-06-01T00:00:00.000Z'));
    expect(status).toBe('exhausted');
  });

  it('returns "exhausted" when usedCount exceeds usageLimit', () => {
    const exhaustedDiscount = { ...baseDiscount, usedCount: 105, usageLimit: 100 };
    const status = getDiscountStatus(exhaustedDiscount, new Date('2024-06-01T00:00:00.000Z'));
    expect(status).toBe('exhausted');
  });

  it('returns "expired" when reference date is past endDate', () => {
    const status = getDiscountStatus(baseDiscount, new Date('2025-01-01T00:00:00.000Z'));
    expect(status).toBe('expired');
  });

  it('prioritizes "exhausted" if limit reached before or after endDate', () => {
    const exhaustedAndExpired = {
      ...baseDiscount,
      usedCount: 100,
      usageLimit: 100,
    };
    const status = getDiscountStatus(exhaustedAndExpired, new Date('2025-05-01T00:00:00.000Z'));
    expect(status).toBe('exhausted');
  });

  it('returns "active" when usageLimit is null and current date is before endDate', () => {
    const unlimitedDiscount = { ...baseDiscount, usageLimit: null, usedCount: 500 };
    const status = getDiscountStatus(unlimitedDiscount, new Date('2024-06-01T00:00:00.000Z'));
    expect(status).toBe('active');
  });
});

describe('Discounts API Endpoints & RBAC (/api/discounts)', () => {
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
      discount: {
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

  describe('RBAC: Admin Only (403 for Staff and Customer across all methods)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/discounts');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { message: 'Authentication required' } });
    });

    describe('STAFF role is rejected with 403 on EVERY method', () => {
      it('GET /api/discounts returns 403', async () => {
        const res = await request(app)
          .get('/api/discounts')
          .set('Authorization', `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: { message: 'Insufficient permissions' } });
      });

      it('POST /api/discounts returns 403', async () => {
        const res = await request(app)
          .post('/api/discounts')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            name: 'Holiday Sale',
            type: 'PERCENT',
            value: 20,
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            appliesTo: 'SUBSCRIPTION',
          });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: { message: 'Insufficient permissions' } });
      });

      it('GET /api/discounts/:id returns 403', async () => {
        const res = await request(app)
          .get('/api/discounts/disc-1')
          .set('Authorization', `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
      });

      it('PUT /api/discounts/:id returns 403', async () => {
        const res = await request(app)
          .put('/api/discounts/disc-1')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ name: 'New Name' });
        expect(res.status).toBe(403);
      });

      it('DELETE /api/discounts/:id returns 403', async () => {
        const res = await request(app)
          .delete('/api/discounts/disc-1')
          .set('Authorization', `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
      });
    });

    describe('CUSTOMER role is rejected with 403 on EVERY method', () => {
      it('GET /api/discounts returns 403', async () => {
        const res = await request(app)
          .get('/api/discounts')
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      });

      it('POST /api/discounts returns 403', async () => {
        const res = await request(app)
          .post('/api/discounts')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({});
        expect(res.status).toBe(403);
      });

      it('GET /api/discounts/:id returns 403', async () => {
        const res = await request(app)
          .get('/api/discounts/disc-1')
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      });

      it('PUT /api/discounts/:id returns 403', async () => {
        const res = await request(app)
          .put('/api/discounts/disc-1')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({});
        expect(res.status).toBe(403);
      });

      it('DELETE /api/discounts/:id returns 403', async () => {
        const res = await request(app)
          .delete('/api/discounts/disc-1')
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
      });
    });
  });

  describe('Zod Validation: Business Rules', () => {
    const validDiscount = {
      name: 'Black Friday',
      type: 'PERCENT',
      value: 20,
      startDate: '2024-11-01T00:00:00.000Z',
      endDate: '2024-11-30T23:59:59.000Z',
      appliesTo: 'SUBSCRIPTION',
    };

    it('rejects missing name with 400', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validDiscount, name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Discount name is required');
    });

    it('rejects PERCENT value 0 with 400', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validDiscount, type: 'PERCENT', value: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('PERCENT discount value must be between 1 and 100');
    });

    it('rejects PERCENT value exceeding 100 with 400', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validDiscount, type: 'PERCENT', value: 105 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('PERCENT discount value must be between 1 and 100');
    });

    it('accepts PERCENT value 1 and 100 with 201', async () => {
      mockPrisma.discount.create.mockResolvedValue({
        id: 'disc-pct',
        ...validDiscount,
        value: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validDiscount, type: 'PERCENT', value: 100 });

      expect(res.status).toBe(201);
      expect(res.body.value).toBe(100);
    });

    it('rejects endDate equal to startDate with 400', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validDiscount,
          startDate: '2024-05-10T10:00:00.000Z',
          endDate: '2024-05-10T10:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('End date must be after start date');
    });

    it('rejects endDate before startDate with 400', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validDiscount,
          startDate: '2024-05-10T10:00:00.000Z',
          endDate: '2024-05-01T10:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('End date must be after start date');
    });

    it('requires productId when appliesTo is PRODUCT', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validDiscount,
          appliesTo: 'PRODUCT',
          productId: undefined,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Product ID is required when appliesTo is PRODUCT');
    });

    it('rejects productId when appliesTo is SUBSCRIPTION', async () => {
      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validDiscount,
          appliesTo: 'SUBSCRIPTION',
          productId: 'some-prod-id',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Product ID must not be set when appliesTo is SUBSCRIPTION');
    });

    it('returns 404 if associated product does not exist in DB', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validDiscount,
          appliesTo: 'PRODUCT',
          productId: 'non-existent-product',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Associated product not found');
    });
  });

  describe('CRUD Operations & Computed Status', () => {
    it('creates a FIXED discount with 201 and computed status', async () => {
      const createdRecord = {
        id: 'disc-fixed',
        name: 'Rs 500 Off',
        type: 'FIXED',
        value: 50000,
        minPurchase: 200000,
        minQty: 2,
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        endDate: new Date('2099-12-31T23:59:59.000Z'),
        usageLimit: 50,
        usedCount: 0,
        appliesTo: 'SUBSCRIPTION',
        productId: null,
        active: true,
        product: null,
      };
      mockPrisma.discount.create.mockResolvedValue(createdRecord);

      const res = await request(app)
        .post('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rs 500 Off',
          type: 'FIXED',
          value: 50000,
          minPurchase: 200000,
          minQty: 2,
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2099-12-31T23:59:59.000Z',
          usageLimit: 50,
          appliesTo: 'SUBSCRIPTION',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Rs 500 Off');
      expect(res.body.value).toBe(50000);
      expect(res.body.status).toBe('active');
    });

    it('gets discount by ID with 200 and computed status', async () => {
      mockPrisma.discount.findUnique.mockResolvedValue({
        id: 'disc-1',
        name: 'Active Promo',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2099-01-01'),
        usageLimit: 10,
        usedCount: 2,
        product: null,
      });

      const res = await request(app)
        .get('/api/discounts/disc-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Active Promo');
      expect(res.body.status).toBe('active');
    });

    it('returns 404 for unknown discount ID', async () => {
      mockPrisma.discount.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/discounts/unknown-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: 'Discount not found' } });
    });

    it('updates discount with 200 and validates cross-field updates', async () => {
      mockPrisma.discount.findUnique.mockResolvedValue({
        id: 'disc-1',
        name: 'Old Promo',
        type: 'PERCENT',
        value: 15,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        appliesTo: 'SUBSCRIPTION',
        productId: null,
      });
      mockPrisma.discount.update.mockResolvedValue({
        id: 'disc-1',
        name: 'Updated Promo',
        type: 'PERCENT',
        value: 25,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        appliesTo: 'SUBSCRIPTION',
        productId: null,
        usageLimit: 200,
        usedCount: 0,
      });

      const res = await request(app)
        .put('/api/discounts/disc-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Promo', value: 25 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Promo');
      expect(res.body.value).toBe(25);
    });

    it('deletes discount with 200', async () => {
      mockPrisma.discount.findUnique.mockResolvedValue({ id: 'disc-1' });
      mockPrisma.discount.delete.mockResolvedValue({ id: 'disc-1' });

      const res = await request(app)
        .delete('/api/discounts/disc-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Discount deleted successfully' });
    });

    it('returns 409 conflict when deleting a discount used in invoices (P2003)', async () => {
      mockPrisma.discount.findUnique.mockResolvedValue({ id: 'disc-1' });
      const p2003Error = new Error('Foreign key violation');
      p2003Error.code = 'P2003';
      mockPrisma.discount.delete.mockRejectedValue(p2003Error);

      const res = await request(app)
        .delete('/api/discounts/disc-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Cannot delete discount that is used in invoices');
    });
  });

  describe('List Filtering by computed status (active | expired | exhausted)', () => {
    const pastDate = new Date('2020-01-01T00:00:00.000Z');
    const futureDate = new Date('2099-01-01T00:00:00.000Z');

    const sampleDiscounts = [
      {
        id: 'disc-active',
        name: 'Active Discount',
        startDate: new Date('2024-01-01'),
        endDate: futureDate,
        usageLimit: 50,
        usedCount: 10,
      },
      {
        id: 'disc-expired',
        name: 'Expired Discount',
        startDate: new Date('2020-01-01'),
        endDate: pastDate,
        usageLimit: 100,
        usedCount: 5,
      },
      {
        id: 'disc-exhausted',
        name: 'Exhausted Discount',
        startDate: new Date('2024-01-01'),
        endDate: futureDate,
        usageLimit: 20,
        usedCount: 20,
      },
    ];

    it('lists all discounts with computed status when no status filter is applied', async () => {
      mockPrisma.discount.findMany.mockResolvedValue(sampleDiscounts);

      const res = await request(app)
        .get('/api/discounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.discounts).toHaveLength(3);
      expect(res.body.discounts[0].status).toBe('active');
      expect(res.body.discounts[1].status).toBe('expired');
      expect(res.body.discounts[2].status).toBe('exhausted');
      expect(res.body.pagination.total).toBe(3);
    });

    it('filters by status=active', async () => {
      mockPrisma.discount.findMany.mockResolvedValue(sampleDiscounts);

      const res = await request(app)
        .get('/api/discounts?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.discounts).toHaveLength(1);
      expect(res.body.discounts[0].id).toBe('disc-active');
      expect(res.body.discounts[0].status).toBe('active');
      expect(res.body.pagination.total).toBe(1);
    });

    it('filters by status=expired', async () => {
      mockPrisma.discount.findMany.mockResolvedValue(sampleDiscounts);

      const res = await request(app)
        .get('/api/discounts?status=expired')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.discounts).toHaveLength(1);
      expect(res.body.discounts[0].id).toBe('disc-expired');
      expect(res.body.discounts[0].status).toBe('expired');
      expect(res.body.pagination.total).toBe(1);
    });

    it('filters by status=exhausted', async () => {
      mockPrisma.discount.findMany.mockResolvedValue(sampleDiscounts);

      const res = await request(app)
        .get('/api/discounts?status=exhausted')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.discounts).toHaveLength(1);
      expect(res.body.discounts[0].id).toBe('disc-exhausted');
      expect(res.body.discounts[0].status).toBe('exhausted');
      expect(res.body.pagination.total).toBe(1);
    });

    it('returns 400 for invalid status query parameter', async () => {
      mockPrisma.discount.findMany.mockResolvedValue(sampleDiscounts);

      const res = await request(app)
        .get('/api/discounts?status=invalid_status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid status filter');
    });
  });
});
