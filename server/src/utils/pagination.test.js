import { buildPaginatedResponse, parsePagination } from './pagination.js';

describe('pagination helpers', () => {
  it('parses page and limit and caps limit at 100', () => {
    expect(parsePagination({ page: '3', limit: '150' })).toEqual({
      page: 3,
      limit: 100,
      skip: 200,
    });
  });

  it('falls back to the first page and default limit for invalid values', () => {
    expect(parsePagination({ page: '-2', limit: 'NaN' })).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it('builds the shared paged response shape', () => {
    expect(buildPaginatedResponse(['item'], { page: 2, limit: 10, total: 11 })).toEqual({
      data: ['item'],
      page: 2,
      limit: 10,
      total: 11,
    });
  });
});
