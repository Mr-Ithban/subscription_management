import {
  recordPayment,
  listPayments,
  listInvoicePayments,
  PaymentError,
} from './service.js';
import { getOutstandingInvoices, getOverdueInvoices } from './queries.js';
import { parsePagination } from '../../utils/pagination.js';

export function createPaymentsController(prisma) {
  return {
    recordPayment: async (req, res, next) => {
      try {
        const result = await recordPayment(prisma, {
          invoiceId: req.params.id,
          paymentData: req.body,
          user: req.user,
        });
        return res.status(201).json(result);
      } catch (error) {
        if (error instanceof PaymentError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    listPayments: async (req, res, next) => {
      try {
        const result = await listPayments(prisma, {
          filters: req.query,
          pagination: req.pagination,
        });
        return res.status(200).json(result);
      } catch (error) {
        if (error instanceof PaymentError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    listInvoicePayments: async (req, res, next) => {
      try {
        const result = await listInvoicePayments(prisma, {
          invoiceId: req.params.id,
          pagination: req.pagination,
        });
        return res.status(200).json(result);
      } catch (error) {
        if (error instanceof PaymentError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    getOutstanding: async (req, res, next) => {
      try {
        const pagination = parsePagination(req.query);
        const result = await getOutstandingInvoices(prisma, {
          customerId: req.query.customerId,
          pagination,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getOverdue: async (req, res, next) => {
      try {
        const pagination = parsePagination(req.query);
        const asOf = req.query.asOf ? new Date(req.query.asOf) : undefined;
        const result = await getOverdueInvoices(prisma, {
          asOf,
          customerId: req.query.customerId,
          pagination,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}
