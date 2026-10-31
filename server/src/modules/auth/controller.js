import {
  AuthError,
  forgotPassword,
  getPublicUser,
  loginUser,
  resetPassword,
  signupUser,
} from './service.js';

export function createAuthController(prisma, sendMail) {
  return {
    signup: async (req, res, next) => {
      try {
        const user = await signupUser(prisma, {
          ...req.body,
          email: req.body.email.toLowerCase(),
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
      try {
        const resultBody = await loginUser(prisma, {
          ...req.body,
          email: req.body.email.toLowerCase(),
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
      try {
        await forgotPassword(prisma, req.body.email.toLowerCase(), sendMail);
        return res.status(200).json({
          message: 'If an account exists for that email, password reset instructions have been sent.',
        });
      } catch (error) {
        return next(error);
      }
    },
    resetPassword: async (req, res, next) => {
      try {
        await resetPassword(prisma, req.body);
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
