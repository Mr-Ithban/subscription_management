# API conventions

## Authentication and roles

Authentication middleware validates the Bearer token and loads the current user into
`req.user`. Put it before authorization middleware on protected routes:

```js
router.delete('/users/:id', authenticate, authorize('ADMIN'), controller.removeUser);
router.get('/invoices/:id', authenticate, ownership(loadInvoiceCustomerId), controller.getInvoice);
```

`authorize('ADMIN', 'STAFF')` permits only the listed roles. `ownership(resolveCustomerId)` lets
ADMIN and STAFF through; CUSTOMER requests continue only when the resource belongs to the
customer record attached to `req.user`. Ownership failures return 404 so resource existence is
not disclosed.

## Request validation

Use `validate(schema)` for a request body, or specify `body`, `query`, or `params`:

```js
router.get('/invoices', validate(invoiceQuerySchema, 'query'), controller.listInvoices);
```

Invalid input returns status 400 with field details:

```json
{
  "error": {
    "message": "Expected number, received nan",
    "details": [{ "field": "page", "message": "Expected number, received nan" }]
  }
}
```

## Lists and errors

Use `parsePagination(req.query)` for list endpoints. It returns `page`, `limit`, and `skip`; the
default limit is 20 and the maximum is 100. Build the response with
`buildPaginatedResponse(data, { page, limit, total })`:

```json
{ "data": [], "page": 1, "limit": 20, "total": 0 }
```

Errors use `{ "error": { "message": "...", "details": {} } }`. The `details` property is
omitted when there are no additional details. Prisma unique-constraint errors return 409.
Authentication endpoints are limited to 20 requests per 15 minutes per client.


## Reports API (M4-4)

Accessible by `ADMIN` and `STAFF`.

- `GET /api/reports/summary?from&to`: aggregated finance summary (active subscription count, subscriptions by status, revenue, invoiced total, outstanding total, overdue count and amount, MRR estimate). Cached in-memory for 30 seconds.
- `GET /api/reports/revenue?from&to&groupBy=day|week|month`: revenue grouped by day, week, or month.
- `GET /api/reports/subscriptions?status&planId&customerId&page&limit`: filtered and paginated subscriptions list.
- `GET /api/reports/overdue?page&limit&customerId&asOf`: overdue invoices with days overdue and remaining balance.
