import express from 'express';
import request from 'supertest';
import { authorize } from '../../middleware/authorize.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createPortalBillingRouter } from './portalRoutes.js';

function makeApp(role = 'CUSTOMER', customerId = 'customer_1') {
  const prisma = {
    subscription: { findMany: async ({ where }) => [{ id: 'sub_1', customerId: where.customerId }] },
    invoice: {
      findMany: async ({ where }) => [{ id: 'invoice_1', customerId: where.customerId }],
      findFirst: async ({ where }) => where.customerId === 'customer_1' ? {
        id: where.id,
        number: 'INV-1',
        status: 'CONFIRMED',
        issueDate: new Date('2026-01-01'),
        dueDate: new Date('2026-01-15'),
        customer: { name: 'Customer', user: { email: 'customer@example.com' } },
        lines: [], discounts: [], subscription: { number: 'SUB-1' },
        subtotal: 0, taxTotal: 0, discountTotal: 0, total: 0,
      } : null,
    },
  };
  const app = express();
  app.use('/api/portal', createPortalBillingRouter(prisma, {
    authenticate: (req, _res, next) => {
      req.user = { id: 'user_1', role, customer: customerId ? { id: customerId } : null };
      next();
    },
    authorize,
  }));
  app.use(errorHandler);
  return app;
}

describe('customer billing portal routes', () => {
  it('returns only the authenticated customer’s subscriptions and invoices', async () => {
    const app = makeApp();
    const subscriptions = await request(app).get('/api/portal/subscriptions');
    expect(subscriptions.status).toBe(200);
    expect(subscriptions.body.subscriptions[0].customerId).toBe('customer_1');

    const invoices = await request(app).get('/api/portal/invoices');
    expect(invoices.status).toBe(200);
    expect(invoices.body.invoices[0].customerId).toBe('customer_1');
  });

  it('returns 404 when a customer requests another customer’s invoice PDF', async () => {
    const response = await request(makeApp('CUSTOMER', 'customer_2')).get('/api/portal/invoices/invoice_1/pdf');
    expect(response.status).toBe(404);
  });

  it('rejects non-customer accounts from portal endpoints', async () => {
    const response = await request(makeApp('STAFF')).get('/api/portal/invoices');
    expect(response.status).toBe(403);
  });
});
