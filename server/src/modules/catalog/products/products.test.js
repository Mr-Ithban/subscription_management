import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { getUnitPrice } from '../pricing.js';
import { createProductsRouter } from './routes.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_brightloop_dev_only';

function generateToken(role = 'ADMIN', userId = 'user-1') {
  return jwt.sign({ id: userId, email: `${role.toLowerCase()}@brightloop.test`, role }, JWT_SECRET);
}

function createTestApp(mockPrisma) {
  const app = express();
  app.use(express.json());
  app.use('/api/products', createProductsRouter(mockPrisma));
  return app;
}

describe('Pricing Helper: getUnitPrice', () => {
  it('Brand=Odoo adds 560 to the base price', () => {
    const product = { id: 'prod-1', name: 'Accounting Suite', salesPrice: 10000 };
    const variant = { id: 'var-1', attribute: 'Brand', value: 'Odoo', extraPrice: 560 };

    const unitPrice = getUnitPrice(product, variant);
    expect(unitPrice).toBe(10560);
  });

  it('no variant uses the base price', () => {
    const product = { id: 'prod-1', name: 'Accounting Suite', salesPrice: 10000 };

    expect(getUnitPrice(product, null)).toBe(10000);
    expect(getUnitPrice(product, undefined)).toBe(10000);
    expect(getUnitPrice(product)).toBe(10000);
  });

  it('variant with zero extraPrice uses base price', () => {
    const product = { id: 'prod-1', name: 'Accounting Suite', salesPrice: 5000 };
    const variant = { id: 'var-2', attribute: 'Edition', value: 'Standard', extraPrice: 0 };

    expect(getUnitPrice(product, variant)).toBe(5000);
  });

  it('throws when product or salesPrice is missing', () => {
    expect(() => getUnitPrice(null)).toThrow('Valid product with salesPrice is required');
    expect(() => getUnitPrice({})).toThrow('Valid product with salesPrice is required');
  });
});

describe('Product and Variant API Endpoints', () => {
  let mockPrisma;
  let app;
  const adminToken = generateToken('ADMIN');
  const staffToken = generateToken('STAFF');
  const customerToken = generateToken('CUSTOMER');

  beforeEach(() => {
    mockPrisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productVariant: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    app = createTestApp(mockPrisma);
  });

  describe('Authentication & RBAC', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { message: 'Authentication required' } });
    });

    it('rejects customer role on GET /api/products with 403', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { message: 'Forbidden: insufficient permissions' } });
    });

    it('allows staff role on GET /api/products with 200', async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.product.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.products).toEqual([]);
      expect(res.body.pagination).toBeDefined();
    });

    it('rejects staff role on POST /api/products with 403', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'CRM Pro',
          type: 'SOFTWARE',
          salesPrice: 2000,
          costPrice: 500,
        });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { message: 'Forbidden: insufficient permissions' } });
    });
  });

  describe('Zod Validation for Prices and Types', () => {
    it('rejects negative salesPrice with 400', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'CRM Pro',
          type: 'SOFTWARE',
          salesPrice: -100,
          costPrice: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Sales price cannot be negative');
    });

    it('rejects non-integer salesPrice with 400', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'CRM Pro',
          type: 'SOFTWARE',
          salesPrice: 99.99,
          costPrice: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Sales price must be an integer');
    });

    it('rejects negative costPrice with 400', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'CRM Pro',
          type: 'SOFTWARE',
          salesPrice: 1000,
          costPrice: -50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cost price cannot be negative');
    });

    it('rejects invalid product type with 400', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'CRM Pro',
          type: 'INVALID_TYPE',
          salesPrice: 1000,
          costPrice: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Product type must be SERVICE, GOODS, or SOFTWARE');
    });
  });

  describe('Product CRUD Operations', () => {
    it('creates product successfully for ADMIN with 201', async () => {
      const createdProduct = {
        id: 'prod-123',
        name: 'Enterprise Cloud',
        type: 'SOFTWARE',
        salesPrice: 50000,
        costPrice: 20000,
        notes: 'Monthly billing',
        active: true,
        variants: [],
      };
      mockPrisma.product.create.mockResolvedValue(createdProduct);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Enterprise Cloud',
          type: 'SOFTWARE',
          salesPrice: 50000,
          costPrice: 20000,
          notes: 'Monthly billing',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(createdProduct);
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Enterprise Cloud',
          type: 'SOFTWARE',
          salesPrice: 50000,
          costPrice: 20000,
          notes: 'Monthly billing',
          active: true,
        },
        include: { variants: true },
      });
    });

    it('returns 404 for unknown product id', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/products/unknown-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: 'Product not found' } });
    });

    it('updates a product successfully with 200', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Old' });
      mockPrisma.product.update.mockResolvedValue({
        id: 'prod-1',
        name: 'New Name',
        salesPrice: 12000,
        variants: [],
      });

      const res = await request(app)
        .put('/api/products/prod-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name', salesPrice: 12000 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.salesPrice).toBe(12000);
    });

    it('soft deletes product via active=false on DELETE /:id', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', active: true });
      mockPrisma.product.update.mockResolvedValue({ id: 'prod-1', active: false, variants: [] });

      const res = await request(app)
        .delete('/api/products/prod-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { active: false },
        include: { variants: true },
      });
    });

    it('paginates list and filters by name search', async () => {
      mockPrisma.product.count.mockResolvedValue(1);
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'BrightERP', type: 'SOFTWARE', salesPrice: 10000, variants: [] },
      ]);

      const res = await request(app)
        .get('/api/products?page=2&limit=5&search=Bright')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toEqual({
        total: 1,
        page: 2,
        limit: 5,
        totalPages: 1,
        hasNext: false,
        hasPrev: true,
      });
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          name: { contains: 'Bright', mode: 'insensitive' },
        },
        skip: 5,
        take: 5,
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('Product Variants Endpoints', () => {
    it('creates variant attribute Brand value Odoo extraPrice 560 with 201', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.productVariant.create.mockResolvedValue({
        id: 'var-1',
        productId: 'prod-1',
        attribute: 'Brand',
        value: 'Odoo',
        extraPrice: 560,
      });

      const res = await request(app)
        .post('/api/products/prod-1/variants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attribute: 'Brand',
          value: 'Odoo',
          extraPrice: 560,
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 'var-1',
        productId: 'prod-1',
        attribute: 'Brand',
        value: 'Odoo',
        extraPrice: 560,
      });
    });

    it('rejects negative variant extraPrice with 400', async () => {
      const res = await request(app)
        .post('/api/products/prod-1/variants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attribute: 'Brand',
          value: 'Odoo',
          extraPrice: -50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Extra price cannot be negative');
    });

    it('returns 409 conflict when variant already exists for product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.productVariant.create.mockRejectedValue({ code: 'P2002' });

      const res = await request(app)
        .post('/api/products/prod-1/variants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attribute: 'Brand',
          value: 'Odoo',
          extraPrice: 560,
        });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: { message: 'Variant with this attribute and value already exists for this product' },
      });
    });

    it('updates a variant with 200', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: 'var-1',
        productId: 'prod-1',
        attribute: 'Brand',
        value: 'Odoo',
        extraPrice: 560,
      });
      mockPrisma.productVariant.update.mockResolvedValue({
        id: 'var-1',
        productId: 'prod-1',
        attribute: 'Brand',
        value: 'Odoo Enterprise',
        extraPrice: 750,
      });

      const res = await request(app)
        .put('/api/products/prod-1/variants/var-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'Odoo Enterprise', extraPrice: 750 });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe('Odoo Enterprise');
      expect(res.body.extraPrice).toBe(750);
    });

    it('deletes a variant with 200', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: 'var-1',
        productId: 'prod-1',
      });
      mockPrisma.productVariant.delete.mockResolvedValue({ id: 'var-1' });

      const res = await request(app)
        .delete('/api/products/prod-1/variants/var-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Variant deleted successfully' });
      expect(mockPrisma.productVariant.delete).toHaveBeenCalledWith({
        where: { id: 'var-1' },
      });
    });

    it('returns 404 when deleting non-existent variant', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/products/prod-1/variants/unknown-var')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: 'Variant not found' } });
    });
  });
});
