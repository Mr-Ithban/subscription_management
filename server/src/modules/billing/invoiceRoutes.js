import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { cancelInvoice, confirmInvoice, getInvoice, listInvoices, renderInvoicePdf, sendInvoice } from './invoices.js';
import { invoiceIdSchema, invoiceListSchema } from './invoiceValidation.js';

const defaultPrisma = new PrismaClient();

export function createInvoicesRouter(prisma = defaultPrisma, middleware = {}, mailer) {
  const router = Router();
  router.use(middleware.authenticate ?? createAuthenticate(prisma));
  const authorizeRequest = middleware.authorize ?? authorize;

  router.get('/', authorizeRequest('ADMIN', 'STAFF'), validate(invoiceListSchema, 'query'), async (req, res, next) => {
    try { res.json(await listInvoices(prisma, req.query)); } catch (error) { next(error); }
  });
  router.get('/:id', authorizeRequest('ADMIN', 'STAFF'), validate(invoiceIdSchema, 'params'), async (req, res, next) => {
    try { res.json({ invoice: await getInvoice(prisma, req.params.id) }); } catch (error) { next(error); }
  });
  router.post('/:id/confirm', authorizeRequest('ADMIN', 'STAFF'), validate(invoiceIdSchema, 'params'), async (req, res, next) => {
    try { res.json({ invoice: await confirmInvoice(prisma, req.params.id) }); } catch (error) { next(error); }
  });
  router.post('/:id/cancel', authorizeRequest('ADMIN', 'STAFF'), validate(invoiceIdSchema, 'params'), async (req, res, next) => {
    try { res.json({ invoice: await cancelInvoice(prisma, req.params.id) }); } catch (error) { next(error); }
  });
  router.post('/:id/send', authorizeRequest('ADMIN', 'STAFF'), validate(invoiceIdSchema, 'params'), async (req, res, next) => {
    try { res.json(await sendInvoice(prisma, req.params.id, mailer)); } catch (error) { next(error); }
  });
  router.get('/:id/pdf', authorizeRequest('ADMIN', 'STAFF'), validate(invoiceIdSchema, 'params'), async (req, res, next) => {
    try {
      const invoice = await getInvoice(prisma, req.params.id);
      const pdf = await renderInvoicePdf(invoice);
      const filename = invoice.number.replace(/[^A-Za-z0-9_-]/g, '_');
      res.type('application/pdf').set('Content-Disposition', `inline; filename="${filename}.pdf"`).send(pdf);
    } catch (error) { next(error); }
  });
  return router;
}

export default createInvoicesRouter();
