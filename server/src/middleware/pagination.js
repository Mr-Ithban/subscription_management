import { parsePagination } from '../utils/pagination.js';

/**
 * Pagination middleware for list endpoints (page, limit, max 100).
 */
export function pagination(req, res, next) {
  req.pagination = parsePagination(req.query);
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
