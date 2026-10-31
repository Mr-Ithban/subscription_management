import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { createAuthController } from './controller.js';

const prisma = new PrismaClient();

export function createAuthRouter(prismaClient) {
  const router = Router();
  const controller = createAuthController(prismaClient);

  router.post('/signup', controller.signup);
  return router;
}

export default createAuthRouter(prisma);
