import jwt from 'jsonwebtoken';
import { prisma } from '../modules/auth/prisma.js';

function unauthorized(res) {
  return res.status(401).json({ error: { message: 'Authentication required' } });
}

export function createAuthenticate(prismaClient = prisma) {
  return async (req, res, next) => {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const secret = process.env.JWT_SECRET;

    if (!match || !secret) {
      return unauthorized(res);
    }

    let payload;
    try {
      payload = jwt.verify(match[1], secret);
    } catch {
      return unauthorized(res);
    }

    if (!payload || typeof payload !== 'object' || !payload.id) {
      return unauthorized(res);
    }

    try {
      const user = await prismaClient.user.findUnique({
        where: { id: payload.id },
        include: { customer: true },
      });

      if (!user) {
        return unauthorized(res);
      }

      req.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export default createAuthenticate();
