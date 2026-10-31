import { Router } from 'express';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { createAuthController } from './controller.js';
import { prisma } from './prisma.js';
import { sendMail } from '../../utils/mailer.js';

export function createAuthRouter(prismaClient = prisma, mailer = sendMail) {
  const router = Router();
  const controller = createAuthController(prismaClient, mailer);

  router.post('/signup', controller.signup);
  router.post('/login', controller.login);
  router.post('/forgot-password', controller.forgotPassword);
  router.post('/reset-password', controller.resetPassword);
  router.get('/me', createAuthenticate(prismaClient), controller.me);
  return router;
}

export default createAuthRouter();
