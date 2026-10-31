import express from 'express';
import request from 'supertest';
import { authorize } from '../../middleware/authorize.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createBillingRouter } from './routes.js';

function makeApp() {
  const prisma = {
    billingRun: {
      create: async () => ({ id: 'run_1' }),
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    subscription: { findMany: async () => [] },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/billing', createBillingRouter(prisma, {
    authenticate: (req, _res, next) => {
      req.user = { id: 'user_1', role: req.headers['x-test-role'] };
      next();
    },
    authorize,
  }));
  app.use(errorHandler);
  return app;
}

describe('manual billing run route', () => {
  it('allows ADMIN to start a run', async () => {
    const response = await request(makeApp()).post('/api/billing/run').set('x-test-role', 'ADMIN');
    expect(response.status).toBe(200);
    expect(response.body.billingRun).toMatchObject({ status: 'COMPLETED', invoicesCreated: 0 });
  });

  it('rejects STAFF and other roles', async () => {
    const response = await request(makeApp()).post('/api/billing/run').set('x-test-role', 'STAFF');
    expect(response.status).toBe(403);
  });
});
