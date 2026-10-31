/**
 * 404 handler for unmatched routes.
 */
export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
};
