export function ownership(getResourceCustomerId) {
  if (typeof getResourceCustomerId !== 'function') {
    throw new TypeError('ownership requires a resource customer ID resolver');
  }

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }

    if (req.user.role === 'ADMIN' || req.user.role === 'STAFF') {
      return next();
    }

    if (req.user.role !== 'CUSTOMER' || !req.user.customer?.id) {
      return res.status(404).json({ error: { message: 'Resource not found' } });
    }

    try {
      const resourceCustomerId = await getResourceCustomerId(req);
      if (resourceCustomerId !== req.user.customer.id) {
        return res.status(404).json({ error: { message: 'Resource not found' } });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
