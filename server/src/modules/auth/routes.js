import { Router } from 'express';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createAuthController } from './controller.js';
import { prisma } from './prisma.js';
import { sendMail } from '../../utils/mailer.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from './validation.js';

export function createAuthRouter(prismaClient = prisma, mailer = sendMail) {
  const router = Router();
  const controller = createAuthController(prismaClient, mailer);

  router.post('/signup', validate(signupSchema), controller.signup);
  router.post('/login', validate(loginSchema), controller.login);
  router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
  router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
  router.get('/me', createAuthenticate(prismaClient), controller.me);
  return router;
}

export default createAuthRouter();
