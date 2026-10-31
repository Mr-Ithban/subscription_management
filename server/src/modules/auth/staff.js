import bcrypt from 'bcrypt';
import { Router } from 'express';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination.js';
import { prisma } from './prisma.js';
import { staffCreateSchema, staffListSchema } from './validation.js';

export function createStaffRouter(prismaClient = prisma) {
  const router = Router();
  router.use(createAuthenticate(prismaClient), authorize('ADMIN'));

  router.get('/', validate(staffListSchema, 'query'), async (req, res, next) => {
    try {
      const pagination = parsePagination(req.query);
      const where = { role: 'STAFF' };
      const [total, users] = await Promise.all([
        prismaClient.user.count({ where }),
        prismaClient.user.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        }),
      ]);
      return res.json(buildPaginatedResponse(users, { page: pagination.page, limit: pagination.limit, total }));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', validate(staffCreateSchema), async (req, res, next) => {
    try {
      const passwordHash = await bcrypt.hash(req.body.password, 10);
      const user = await prismaClient.user.create({
        data: { name: req.body.name.trim(), email: req.body.email.toLowerCase(), passwordHash, role: 'STAFF' },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      return res.status(201).json(user);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: { message: 'Email already registered' } });
      }
      return next(error);
    }
  });

  return router;
}

export default createStaffRouter();
