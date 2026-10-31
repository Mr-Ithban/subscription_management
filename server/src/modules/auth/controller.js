import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from './validation.js';
import {
  AuthError,
  forgotPassword,
  getPublicUser,
  loginUser,
  resetPassword,
  signupUser,
} from './service.js';

function validationMessage(result) {
  return [...new Set(result.error.issues.map((issue) => issue.message))].join('; ');
}

export function createAuthController(prisma, sendMail) {
  return {
    signup: async (req, res, next) => {
      const result = signupSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: { message: validationMessage(result) } });
      }

      try {
        const user = await signupUser(prisma, {
          ...result.data,
          email: result.data.email.toLowerCase(),
        });
        return res.status(201).json(user);
      } catch (error) {
        if (error instanceof AuthError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }

        return next(error);
      }
    },
    login: async (req, res, next) => {
      const result = loginSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: { message: validationMessage(result) } });
      }

      try {
        const resultBody = await loginUser(prisma, {
          ...result.data,
          email: result.data.email.toLowerCase(),
        });
        return res.status(200).json(resultBody);
      } catch (error) {
        if (error instanceof AuthError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }

        return next(error);
      }
    },
    me: (req, res) =>
      res.status(200).json({
        user: getPublicUser(req.user),
        customer: req.user.customer ?? null,
      }),
    forgotPassword: async (req, res, next) => {
      const result = forgotPasswordSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: { message: validationMessage(result) } });
      }

      try {
        await forgotPassword(prisma, result.data.email.toLowerCase(), sendMail);
        return res.status(200).json({
          message: 'If an account exists for that email, password reset instructions have been sent.',
        });
      } catch (error) {
        return next(error);
      }
    },
    resetPassword: async (req, res, next) => {
      const result = resetPasswordSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: { message: validationMessage(result) } });
      }

      try {
        await resetPassword(prisma, result.data);
        return res.status(200).json({ message: 'Password has been reset.' });
      } catch (error) {
        if (error instanceof AuthError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }

        return next(error);
      }
    },
  };
}
