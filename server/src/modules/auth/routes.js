import { Router } from 'express';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { createAuthController } from './controller.js';
import { prisma } from './prisma.js';

export function createAuthRouter(prismaClient = prisma) {
  const router = Router();
  const controller = createAuthController(prismaClient);

  router.post('/signup', controller.signup);
  router.post('/login', controller.login);
  router.get('/me', createAuthenticate(prismaClient), controller.me);
  return router;
}

export default createAuthRouter();
