/**
 * 404 handler for unmatched routes.
 */
export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
