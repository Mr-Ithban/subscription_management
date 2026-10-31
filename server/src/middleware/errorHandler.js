export const errorHandler = (err, req, res, _next) => {
  const isUniqueConstraint = err.code === 'P2002';
  const statusCode = isUniqueConstraint ? 409 : err.statusCode || err.status || 500;
  const message = isUniqueConstraint
    ? 'A record with these values already exists'
    : statusCode >= 500
      ? 'Internal Server Error'
      : err.message || 'Request failed';
  const details = isUniqueConstraint
    ? err.meta?.target
      ? { fields: err.meta.target }
      : undefined
    : err.details;

  return res.status(statusCode).json({
    error: {
      message,
      ...(details === undefined ? {} : { details }),
    },
  });
};
