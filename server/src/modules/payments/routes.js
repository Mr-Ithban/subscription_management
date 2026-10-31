import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { pagination } from '../../middleware/pagination.js';
import { createPaymentsController } from './controller.js';
import {
  recordPaymentSchema,
  listPaymentsQuerySchema,
  invoiceParamSchema,
} from './validation.js';

const defaultPrisma = new PrismaClient();

export function createPaymentsRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createPaymentsController(prisma);

  // Authentication required for payments
  router.use(createAuthenticate(prisma));

  // GET /api/payments (paginated; filters invoiceId, method, dateFrom, dateTo)
  router.get(
    '/',
    authorize('ADMIN', 'STAFF'),
    validate(listPaymentsQuerySchema, 'query'),
    pagination,
    controller.listPayments
  );

  return router;
}

export function createInvoicePaymentsRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createPaymentsController(prisma);

  // Authentication required for invoice payment operations
  router.use(createAuthenticate(prisma));

  // GET /api/invoices/:id/payments (ADMIN and STAFF)
  router.get(
    '/:id/payments',
    authorize('ADMIN', 'STAFF'),
    validate(invoiceParamSchema, 'params'),
    pagination,
    controller.listInvoicePayments
  );

  // POST /api/invoices/:id/payments (ADMIN and STAFF)
  router.post(
    '/:id/payments',
    authorize('ADMIN', 'STAFF'),
    validate(invoiceParamSchema, 'params'),
    validate(recordPaymentSchema, 'body'),
    controller.recordPayment
  );

  return router;
}

export default createPaymentsRouter(defaultPrisma);

