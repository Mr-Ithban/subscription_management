import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { pagination } from '../../middleware/pagination.js';
import { createReportsController } from './controller.js';
import {
  summaryQuerySchema,
  revenueQuerySchema,
  subscriptionsQuerySchema,
  overdueQuerySchema,
} from './validation.js';

const defaultPrisma = new PrismaClient();

export function createReportsRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createReportsController(prisma);

  // Authenticate all reports routes
  router.use(createAuthenticate(prisma));

  // GET /api/reports/summary — ADMIN and STAFF read
  router.get(
    '/summary',
    authorize('ADMIN', 'STAFF'),
    validate(summaryQuerySchema, 'query'),
    controller.getSummary
  );

  // GET /api/reports/revenue — ADMIN and STAFF read
  router.get(
    '/revenue',
    authorize('ADMIN', 'STAFF'),
    validate(revenueQuerySchema, 'query'),
    controller.getRevenue
  );

  // GET /api/reports/subscriptions — ADMIN and STAFF read
  router.get(
    '/subscriptions',
    authorize('ADMIN', 'STAFF'),
    validate(subscriptionsQuerySchema, 'query'),
    pagination,
    controller.getSubscriptions
  );

  // GET /api/reports/overdue — ADMIN and STAFF read
  router.get(
    '/overdue',
    authorize('ADMIN', 'STAFF'),
    validate(overdueQuerySchema, 'query'),
    pagination,
    controller.getOverdue
  );

  return router;
}

export default createReportsRouter(defaultPrisma);
