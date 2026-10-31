import { signupSchema } from './validation.js';
import { signupUser, SignupError } from './service.js';

export function createAuthController(prisma) {
  return {
    signup: async (req, res, next) => {
      const result = signupSchema.safeParse(req.body);

      if (!result.success) {
        const message = [...new Set(result.error.issues.map((issue) => issue.message))].join('; ');
        return res.status(400).json({ error: { message } });
      }

      try {
        const user = await signupUser(prisma, {
          ...result.data,
          email: result.data.email.toLowerCase(),
        });
        return res.status(201).json(user);
      } catch (error) {
        if (error instanceof SignupError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }

        return next(error);
      }
    },
  };
}
