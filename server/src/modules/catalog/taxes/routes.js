import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { pagination } from '../../../middleware/pagination.js';
import { createTaxesController } from './controller.js';
import { createTaxSchema, updateTaxSchema } from './validation.js';

const defaultPrisma = new PrismaClient();

export function createTaxesRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createTaxesController(prisma);

  // All tax routes require authentication
  router.use(createAuthenticate(prisma));

  // Tax CRUD (ADMIN writes, ADMIN and STAFF read)
  router.get('/', authorize('ADMIN', 'STAFF'), pagination, controller.list);
  router.post('/', authorize('ADMIN'), validate(createTaxSchema), controller.create);
  router.get('/:id', authorize('ADMIN', 'STAFF'), controller.getById);
  router.put('/:id', authorize('ADMIN'), validate(updateTaxSchema), controller.update);
  router.delete('/:id', authorize('ADMIN'), controller.delete);

  return router;
}

export default createTaxesRouter(defaultPrisma);
