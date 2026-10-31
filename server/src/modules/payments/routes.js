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
  outstandingQuerySchema,
  overdueQuerySchema,
} from './validation.js';

const defaultPrisma = new PrismaClient();

export function createPaymentsRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createPaymentsController(prisma);

  // Authentication required for all payments routes
  router.use(createAuthenticate(prisma));

  // GET /api/payments — paginated list; filters: invoiceId, method, dateFrom, dateTo
  router.get(
    '/',
    authorize('ADMIN', 'STAFF'),
    validate(listPaymentsQuerySchema, 'query'),
    pagination,
    controller.listPayments
  );

  // GET /api/payments/outstanding — all CONFIRMED (unpaid) invoices with summary
  router.get(
    '/outstanding',
    authorize('ADMIN', 'STAFF'),
    validate(outstandingQuerySchema, 'query'),
    controller.getOutstanding
  );

  // GET /api/payments/overdue — CONFIRMED invoices past their dueDate
  router.get(
    '/overdue',
    authorize('ADMIN', 'STAFF'),
    validate(overdueQuerySchema, 'query'),
    controller.getOverdue
  );

  return router;
}

export function createInvoicePaymentsRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createPaymentsController(prisma);

  // Authentication required for invoice payment operations
  router.use(createAuthenticate(prisma));

  // GET /api/invoices/:id/payments — list payments for a specific invoice
  router.get(
    '/:id/payments',
    authorize('ADMIN', 'STAFF'),
    validate(invoiceParamSchema, 'params'),
    pagination,
    controller.listInvoicePayments
  );

  // POST /api/invoices/:id/payments — record a payment against an invoice
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
