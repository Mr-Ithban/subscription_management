import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { renderInvoicePdf } from './invoices.js';
import { invoiceIdSchema } from './invoiceValidation.js';

const defaultPrisma = new PrismaClient();

const invoiceInclude = {
  lines: { orderBy: { createdAt: 'asc' } },
  discounts: { orderBy: { createdAt: 'asc' } },
  subscription: { select: { id: true, number: true } },
};

export function createPortalBillingRouter(prisma = defaultPrisma, middleware = {}) {
  const router = Router();
  router.use(middleware.authenticate ?? createAuthenticate(prisma));
  const customerOnly = (middleware.authorize ?? authorize)('CUSTOMER');

  router.get('/subscriptions', customerOnly, async (req, res, next) => {
    try {
      const customerId = req.user.customer?.id;
      if (!customerId) return res.status(404).json({ error: { message: 'Customer account not found' } });
      const subscriptions = await prisma.subscription.findMany({
        where: { customerId },
        include: {
          plan: true,
          lines: { include: { product: true, variant: true, tax: true }, orderBy: { createdAt: 'asc' } },
          invoices: { select: { id: true, number: true, status: true, periodStart: true, periodEnd: true, total: true, dueDate: true }, orderBy: { issueDate: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ subscriptions });
    } catch (error) { next(error); }
  });

  router.get('/invoices', customerOnly, async (req, res, next) => {
    try {
      const customerId = req.user.customer?.id;
      if (!customerId) return res.status(404).json({ error: { message: 'Customer account not found' } });
      const invoices = await prisma.invoice.findMany({
        where: { customerId },
        include: invoiceInclude,
        orderBy: { issueDate: 'desc' },
      });
      res.json({ invoices });
    } catch (error) { next(error); }
  });

  router.get('/invoices/:id/pdf', customerOnly, validate(invoiceIdSchema, 'params'), async (req, res, next) => {
    try {
      const customerId = req.user.customer?.id;
      if (!customerId) return res.status(404).json({ error: { message: 'Invoice not found' } });
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, customerId },
        include: {
          ...invoiceInclude,
          customer: { include: { user: { select: { email: true } } } },
        },
      });
      if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found' } });
      const pdf = await renderInvoicePdf(invoice);
      const filename = invoice.number.replace(/[^A-Za-z0-9_-]/g, '_');
      res.type('application/pdf').set('Content-Disposition', `inline; filename="${filename}.pdf"`).send(pdf);
    } catch (error) { next(error); }
  });
  return router;
}

export default createPortalBillingRouter();
