import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { pagination } from '../../../middleware/pagination.js';
import { createDiscountsController } from './controller.js';
import { createDiscountSchema, updateDiscountSchema } from './validation.js';

const defaultPrisma = new PrismaClient();

export function createDiscountsRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createDiscountsController(prisma);

  // All discount routes require authentication
  router.use(createAuthenticate(prisma));

  // Discounts CRUD - ADMIN ONLY (STAFF and CUSTOMER get 403)
  router.get('/', authorize('ADMIN'), pagination, controller.list);
  router.post('/', authorize('ADMIN'), validate(createDiscountSchema), controller.create);
  router.get('/:id', authorize('ADMIN'), controller.getById);
  router.put('/:id', authorize('ADMIN'), validate(updateDiscountSchema), controller.update);
  router.delete('/:id', authorize('ADMIN'), controller.delete);

  return router;
}

export default createDiscountsRouter(defaultPrisma);
