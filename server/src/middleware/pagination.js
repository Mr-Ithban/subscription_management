/**
 * Pagination middleware for list endpoints (page, limit, max 100).
 */
export function pagination(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitRaw = parseInt(req.query.limit, 10) || 10;
  const limit = Math.min(100, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;

  req.pagination = { page, limit, skip };
  next();
}

/**
 * Builds metadata for paginated responses.
 */
export function buildPaginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}
