import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { pagination } from '../../../middleware/pagination.js';
import { createPlansController } from './controller.js';
import { createPlanSchema, updatePlanSchema } from './validation.js';

const defaultPrisma = new PrismaClient();

export function createPlansRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createPlansController(prisma);

  // All plan routes require authentication
  router.use(createAuthenticate(prisma));

  // Plan CRUD
  router.get('/', authorize('ADMIN', 'STAFF'), pagination, controller.list);
  router.post('/', authorize('ADMIN'), validate(createPlanSchema), controller.create);
  router.get('/:id', authorize('ADMIN', 'STAFF'), controller.getById);
  router.put('/:id', authorize('ADMIN'), validate(updatePlanSchema), controller.update);
  router.delete('/:id', authorize('ADMIN'), controller.delete);

  return router;
}

export default createPlansRouter(defaultPrisma);
