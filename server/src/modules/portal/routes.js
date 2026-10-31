/**
 * Customer Portal Routes — Milestone M4-7
 * Provides authenticated customer access to their own billing resources.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { pagination } from '../../middleware/pagination.js';
import { buildPaginatedResponse } from '../../utils/pagination.js';

const defaultPrisma = new PrismaClient();

export function createPortalRouter(prisma = defaultPrisma) {
  const router = Router();

  router.use(createAuthenticate(prisma));

  // GET /api/portal/payments — Role CUSTOMER only, scoped to logged-in customer
  router.get('/payments', authorize('CUSTOMER'), pagination, async (req, res, next) => {
    try {
      const customerId = req.user?.customer?.id;
      if (!customerId) {
        return res.status(200).json(
          buildPaginatedResponse([], {
            page: req.pagination.page,
            limit: req.pagination.limit,
            total: 0,
          })
        );
      }

      const where = {
        invoice: { customerId },
      };

      const [total, data] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          skip: req.pagination.skip,
          take: req.pagination.limit,
          orderBy: { paidAt: 'desc' },
          select: {
            id: true,
            invoiceId: true,
            method: true,
            amount: true,
            paidAt: true,
            note: true,
            createdAt: true,
            invoice: {
              select: {
                id: true,
                number: true,
                total: true,
                status: true,
              },
            },
          },
        }),
      ]);

      return res.status(200).json(
        buildPaginatedResponse(data, {
          page: req.pagination.page,
          limit: req.pagination.limit,
          total,
        })
      );
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default createPortalRouter(defaultPrisma);

