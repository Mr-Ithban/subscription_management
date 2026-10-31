import jwt from 'jsonwebtoken';

/**
 * Authentication middleware.
 * Verifies JWT from Authorization: Bearer <token> header and attaches payload to req.user.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Authentication required' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_brightloop_dev_only';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
}

/**
 * Role-based authorization guard middleware.
 * Ensures the authenticated user has one of the allowed roles.
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Forbidden: insufficient permissions' } });
    }
    next();
  };
}
