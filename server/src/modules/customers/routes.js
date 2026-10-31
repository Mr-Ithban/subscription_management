import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination.js';

const defaultPrisma = new PrismaClient();
const customerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
});

export function createCustomersRouter(prisma = defaultPrisma) {
  const router = Router();
  router.use(createAuthenticate(prisma), authorize('ADMIN', 'STAFF'));
  router.get('/', validate(customerQuerySchema, 'query'), async (req, res, next) => {
    try {
      const pagination = parsePagination(req.query);
      const search = req.query.search?.trim();
      const where = search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      } : {};
      const [total, customers] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { name: 'asc' },
          select: { id: true, name: true, phone: true, user: { select: { email: true } } },
        }),
      ]);
      return res.json(buildPaginatedResponse(customers, { page: pagination.page, limit: pagination.limit, total }));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

export default createCustomersRouter();
