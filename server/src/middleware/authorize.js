const roles = new Set(['ADMIN', 'STAFF', 'CUSTOMER']);

export function authorizeRoles(...allowedRoles) {
  if (allowedRoles.length === 0 || allowedRoles.some((role) => !roles.has(role))) {
    throw new TypeError('authorizeRoles requires one or more valid roles');
  }

  const allowed = new Set(allowedRoles);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }

    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ error: { message: 'Insufficient permissions' } });
    }

    return next();
  };
}
