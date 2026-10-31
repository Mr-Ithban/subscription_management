import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { calculateTax, lineTotals } from '../tax.js';
import { createTaxesRouter } from './routes.js';

const JWT_SECRET = 'catalog-taxes-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

function generateToken(role = 'ADMIN', userId = `${role.toLowerCase()}-1`) {
  return jwt.sign({ id: userId, email: `${role.toLowerCase()}@brightloop.test`, role }, JWT_SECRET);
}

function createTestApp(mockPrisma) {
  const app = express();
  app.use(express.json());
  app.use('/api/taxes', createTaxesRouter(mockPrisma));
  return app;
}

describe('Tax Calculation Helpers (src/modules/catalog/tax.js)', () => {
  describe('calculateTax(amountInt, ratePercent)', () => {
    it('calculates 18 percent on 1000 correctly as 180', () => {
      const tax = calculateTax(1000, 18);
      expect(tax).toBe(180);
      expect(Number.isInteger(tax)).toBe(true);
    });

    it('calculates 0 percent on 1000 as 0', () => {
      const tax = calculateTax(1000, 0);
      expect(tax).toBe(0);
      expect(Number.isInteger(tax)).toBe(true);
    });

    it('returns 0 when base amount is 0', () => {
      const tax = calculateTax(0, 18);
      expect(tax).toBe(0);
    });

    describe('Rounding edge cases (round-half-up)', () => {
      it('rounds 18.5 up to 19 (100 * 18.5%)', () => {
        expect(calculateTax(100, 18.5)).toBe(19);
      });

      it('rounds 18.49 down to 18 (100 * 18.49%)', () => {
        expect(calculateTax(100, 18.49)).toBe(18);
      });

      it('rounds exactly 0.5 up to 1 (1 * 50%)', () => {
        expect(calculateTax(1, 50)).toBe(1);
      });

      it('rounds 0.49 down to 0 (1 * 49%)', () => {
        expect(calculateTax(1, 49)).toBe(0);
      });

      it('rounds 5.5 up to 6 (110 * 5%)', () => {
        expect(calculateTax(110, 5)).toBe(6);
      });

      it('rounds 5.25 down to 5 (105 * 5%)', () => {
        expect(calculateTax(105, 5)).toBe(5);
      });

      it('rounds 59.94 to 60 (333 * 18%)', () => {
        expect(calculateTax(333, 18)).toBe(60);
      });

      it('rounds 23.31 to 23 (333 * 7%)', () => {
        expect(calculateTax(333, 7)).toBe(23);
      });
    });

    describe('Validation & Errors', () => {
      it('throws when amountInt is not an integer (enforcing no floats for money)', () => {
        expect(() => calculateTax(100.5, 18)).toThrow('amountInt must be an integer');
      });

      it('throws when amountInt is negative', () => {
        expect(() => calculateTax(-100, 18)).toThrow('must be non-negative');
      });

      it('throws when ratePercent is negative', () => {
        expect(() => calculateTax(100, -5)).toThrow('must be non-negative');
      });

      it('throws when inputs are non-numeric or NaN', () => {
        expect(() => calculateTax('abc', 18)).toThrow('Invalid amountInt or ratePercent');
      });
    });
  });

  describe('lineTotals({ unitPrice, qty, ratePercent })', () => {
    it('calculates totals for unitPrice 1000, qty 1, rate 18%', () => {
      const result = lineTotals({ unitPrice: 1000, qty: 1, ratePercent: 18 });
      expect(result).toEqual({
        subtotal: 1000,
        tax: 180,
        total: 1180,
      });
      expect(Number.isInteger(result.subtotal)).toBe(true);
      expect(Number.isInteger(result.tax)).toBe(true);
      expect(Number.isInteger(result.total)).toBe(true);
    });

    it('calculates totals for unitPrice 1000, qty 2, rate 0%', () => {
      const result = lineTotals({ unitPrice: 1000, qty: 2, ratePercent: 0 });
      expect(result).toEqual({
        subtotal: 2000,
        tax: 0,
        total: 2000,
      });
    });

    it('calculates totals with rounding: unitPrice 499, qty 3, rate 18%', () => {
      // subtotal = 1497, raw tax = 269.46 -> 269, total = 1766
      const result = lineTotals({ unitPrice: 499, qty: 3, ratePercent: 18 });
      expect(result).toEqual({
        subtotal: 1497,
        tax: 269,
        total: 1766,
      });
    });

    it('defaults qty to 1 and ratePercent to 0 if omitted', () => {
      const result = lineTotals({ unitPrice: 5000 });
      expect(result).toEqual({
        subtotal: 5000,
        tax: 0,
        total: 5000,
      });
    });

    it('throws if unitPrice is negative or not an integer', () => {
      expect(() => lineTotals({ unitPrice: -50, qty: 1 })).toThrow('unitPrice must be a non-negative integer');
      expect(() => lineTotals({ unitPrice: 50.5, qty: 1 })).toThrow('unitPrice must be a non-negative integer');
    });

    it('throws if qty is negative or not an integer', () => {
      expect(() => lineTotals({ unitPrice: 100, qty: -1 })).toThrow('qty must be a non-negative integer');
      expect(() => lineTotals({ unitPrice: 100, qty: 1.5 })).toThrow('qty must be a non-negative integer');
    });

    it('throws if ratePercent is negative', () => {
      expect(() => lineTotals({ unitPrice: 100, qty: 1, ratePercent: -10 })).toThrow('ratePercent must be a non-negative number');
    });
  });
});

describe('Tax API Endpoints & RBAC (/api/taxes)', () => {
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
      tax: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    app = createTestApp(mockPrisma);
  });

  describe('Authentication & Roles', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/taxes');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { message: 'Authentication required' } });
    });

    it('rejects CUSTOMER role on GET /api/taxes with 403', async () => {
      const res = await request(app)
        .get('/api/taxes')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { message: 'Insufficient permissions' } });
    });

    it('allows STAFF role on GET /api/taxes with 200', async () => {
      mockPrisma.tax.count.mockResolvedValue(0);
      mockPrisma.tax.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/taxes')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.taxes).toEqual([]);
      expect(res.body.pagination).toBeDefined();
    });

    it('rejects STAFF role on POST /api/taxes with 403', async () => {
      const res = await request(app)
        .post('/api/taxes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'GST 18%', rate: 18 });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { message: 'Insufficient permissions' } });
    });

    it('rejects STAFF role on PUT /api/taxes/:id with 403', async () => {
      const res = await request(app)
        .put('/api/taxes/tax-1')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Updated Tax' });

      expect(res.status).toBe(403);
    });

    it('rejects STAFF role on DELETE /api/taxes/:id with 403', async () => {
      const res = await request(app)
        .delete('/api/taxes/tax-1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Zod Validation', () => {
    it('rejects tax without name with 400', async () => {
      const res = await request(app)
        .post('/api/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rate: 18 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Tax name is required');
    });

    it('rejects tax with empty name with 400', async () => {
      const res = await request(app)
        .post('/api/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '   ', rate: 18 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Tax name is required');
    });

    it('rejects tax without rate with 400', async () => {
      const res = await request(app)
        .post('/api/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'GST 18%' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Tax rate is required');
    });

    it('rejects tax with negative rate with 400', async () => {
      const res = await request(app)
        .post('/api/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Negative Tax', rate: -5 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Tax rate cannot be negative');
    });

    it('rejects tax with rate exceeding 100 with 400', async () => {
      const res = await request(app)
        .post('/api/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Super Tax', rate: 105 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Tax rate cannot exceed 100');
    });
  });

  describe('CRUD Operations', () => {
    it('creates tax successfully with 201', async () => {
      const createdTax = {
        id: 'tax-1',
        name: 'GST 18%',
        rate: 18,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.tax.create.mockResolvedValue(createdTax);

      const res = await request(app)
        .post('/api/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'GST 18%', rate: 18, active: true });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('GST 18%');
      expect(res.body.rate).toBe(18);
      expect(mockPrisma.tax.create).toHaveBeenCalledWith({
        data: { name: 'GST 18%', rate: 18, active: true },
      });
    });

    it('lists taxes with pagination and search/active filters', async () => {
      mockPrisma.tax.count.mockResolvedValue(1);
      mockPrisma.tax.findMany.mockResolvedValue([
        { id: 'tax-1', name: 'GST 18%', rate: 18, active: true },
      ]);

      const res = await request(app)
        .get('/api/taxes?search=GST&active=true&page=1&limit=10')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.taxes).toHaveLength(1);
      expect(mockPrisma.tax.findMany).toHaveBeenCalledWith({
        where: {
          name: { contains: 'GST', mode: 'insensitive' },
          active: true,
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('retrieves a single tax by ID with 200', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue({
        id: 'tax-1',
        name: 'GST 18%',
        rate: 18,
        active: true,
      });

      const res = await request(app)
        .get('/api/taxes/tax-1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('GST 18%');
    });

    it('returns 404 when tax is not found', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/taxes/non-existent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: 'Tax not found' } });
    });

    it('updates tax successfully with 200', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue({
        id: 'tax-1',
        name: 'Old Name',
        rate: 12,
        active: true,
      });
      mockPrisma.tax.update.mockResolvedValue({
        id: 'tax-1',
        name: 'Updated VAT',
        rate: 15,
        active: false,
      });

      const res = await request(app)
        .put('/api/taxes/tax-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated VAT', rate: 15, active: false });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated VAT');
      expect(res.body.rate).toBe(15);
      expect(mockPrisma.tax.update).toHaveBeenCalledWith({
        where: { id: 'tax-1' },
        data: { name: 'Updated VAT', rate: 15, active: false },
      });
    });

    it('deletes tax successfully with 200', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue({ id: 'tax-1' });
      mockPrisma.tax.delete.mockResolvedValue({ id: 'tax-1' });

      const res = await request(app)
        .delete('/api/taxes/tax-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Tax deleted successfully' });
      expect(mockPrisma.tax.delete).toHaveBeenCalledWith({
        where: { id: 'tax-1' },
      });
    });

    it('returns 409 conflict when tax deletion violates foreign key constraints', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue({ id: 'tax-1' });
      const fkError = new Error('Foreign key violation');
      fkError.code = 'P2003';
      mockPrisma.tax.delete.mockRejectedValue(fkError);

      const res = await request(app)
        .delete('/api/taxes/tax-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Cannot delete tax in use');
    });
  });
});
