import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { pagination } from '../../../middleware/pagination.js';
import { createProductsController } from './controller.js';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
} from './validation.js';

const defaultPrisma = new PrismaClient();

export function createProductsRouter(prisma = defaultPrisma) {
  const router = Router();
  const controller = createProductsController(prisma);

  // All product routes require authentication
  router.use(createAuthenticate(prisma));

  // Product CRUD
  router.get('/', authorize('ADMIN', 'STAFF'), pagination, controller.list);
  router.post('/', authorize('ADMIN'), validate(createProductSchema), controller.create);
  router.get('/:id', authorize('ADMIN', 'STAFF'), controller.getById);
  router.put('/:id', authorize('ADMIN'), validate(updateProductSchema), controller.update);
  router.delete('/:id', authorize('ADMIN'), controller.delete);

  // Variant routes (Admin only)
  router.post('/:id/variants', authorize('ADMIN'), validate(createVariantSchema), controller.createVariant);
  router.put(
    '/:id/variants/:variantId',
    authorize('ADMIN'),
    validate(updateVariantSchema),
    controller.updateVariant
  );
  router.delete('/:id/variants/:variantId', authorize('ADMIN'), controller.deleteVariant);

  return router;
}

export default createProductsRouter(defaultPrisma);
