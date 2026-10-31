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

## Staff administration

`POST /api/staff` and `GET /api/staff?page=1&limit=20` require an ADMIN bearer token.
Create body: `{ "name": "Sam Staff", "email": "sam@example.test", "password": "StrongPass!" }`.
The password must contain at least 9 characters, uppercase and lowercase letters, and a special character.
The list returns `{ "data": [], "page": 1, "limit": 20, "total": 0 }`; password hashes are never returned.
