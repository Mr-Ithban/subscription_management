import express from 'express';
import request from 'supertest';
import { authorize } from '../../middleware/authorize.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createInvoicesRouter } from './invoiceRoutes.js';

function makeApp() {
  const prisma = {
    invoice: {
      count: async () => 0,
      findMany: async () => [],
    },
  };
  const app = express();
  app.use('/api/invoices', createInvoicesRouter(prisma, {
    authenticate: (req, _res, next) => {
      req.user = { id: 'user_1', role: req.headers['x-test-role'] };
      next();
    },
    authorize,
  }));
  app.use(errorHandler);
  return app;
}

describe('invoice routes', () => {
  it('allows STAFF to read invoices', async () => {
    const response = await request(makeApp()).get('/api/invoices').set('x-test-role', 'STAFF');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ invoices: [], pagination: { total: 0 } });
  });

  it('blocks CUSTOMER from staff invoice routes', async () => {
    const response = await request(makeApp()).get('/api/invoices').set('x-test-role', 'CUSTOMER');
    expect(response.status).toBe(403);
  });
});
