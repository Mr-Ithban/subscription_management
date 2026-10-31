import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { runBilling } from './billingRun.js';

const defaultPrisma = new PrismaClient();

export function createBillingRouter(prisma = defaultPrisma, middleware = {}) {
  const router = Router();
  router.use(middleware.authenticate ?? createAuthenticate(prisma));
  router.post('/run', (middleware.authorize ?? authorize)('ADMIN'), async (_req, res, next) => {
    try {
      const billingRun = await runBilling(prisma);
      res.json({ billingRun });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export default createBillingRouter();
