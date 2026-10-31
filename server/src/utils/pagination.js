function positiveInteger(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

export function parsePagination(query = {}) {
  const page = positiveInteger(query.page, 1);
  const limit = Math.min(positiveInteger(query.limit, 20), 100);

  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginatedResponse(data, { page, limit, total }) {
  return { data, page, limit, total };
}
