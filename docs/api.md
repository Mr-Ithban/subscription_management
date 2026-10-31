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

## Seeded Catalog Entities (Member 2)

The database seed (`npm run seed` or `node prisma/seed.js`) populates baseline catalog data using deterministic IDs and idempotent upserts. Other modules (Member 3: Subscriptions/Billing, Member 4: Payments/Invoices) can safely reference these seeded entities:

### 1. Taxes

| ID | Name | Rate (%) | Active | Usage |
|---|---|---:|:---:|---|
| `tax-5` | GST 5% | 5.0 | Yes | Low-tier goods & services |
| `tax-12` | GST 12% | 12.0 | Yes | Standard rate consumables |
| `tax-18` | GST 18% | 18.0 | Yes | Software, cloud services, and subscriptions |

### 2. Products and Variants

Prices are stored as integers in smallest currency units (e.g., 10000 = 100.00).

| ID | Name | Type | Sales Price | Cost Price | Variants / Notes |
|---|---|---|---:|---:|---|
| `prod-accounting-suite` | Accounting Suite | `SERVICE` | 10000 | 6000 | Brand variants: `Odoo` (+560 -> 10560), `Zoho` (+300 -> 10300) |
| `prod-cloud-hosting` | Cloud Hosting Infrastructure | `SERVICE` | 25000 | 15000 | Dedicated compute/storage server instances |
| `prod-pos-terminal` | Smart POS Terminal | `GOODS` | 45000 | 30000 | Hardware terminal device |
| `prod-thermal-paper` | Thermal Receipt Paper Rolls | `CONSUMABLE` | 1200 | 600 | 50-roll pack consumable supplies |
| `prod-priority-support` | 24/7 Priority Support SLA | `SERVICE` | 8000 | 3000 | Enterprise technical support SLA |
| `prod-analytics-dashboard` | Executive Analytics Addon | `SERVICE` | 15000 | 5000 | Real-time BI reporting and analytics |

#### Product Variants (`prod-accounting-suite`)
- `var-brand-odoo`: Attribute `Brand`, Value `Odoo`, Extra Price `560` (Total: 10560)
- `var-brand-zoho`: Attribute `Brand`, Value `Zoho`, Extra Price `300` (Total: 10300)

### 3. Plans

All seeded plans are initialized with `status: ACTIVE`, `minQty: 1`, `allowPause: true`, `allowEarlyClose: true`, `allowRenew: true`, and `autoClose: false`.

| ID | Name | Billing Period | Price | Linked Product |
|---|---|---|---:|---|
| `plan-daily-starter` | Daily Pass | `DAILY` | 499 | `prod-accounting-suite` |
| `plan-weekly-growth` | Weekly Growth | `WEEKLY` | 1999 | `prod-cloud-hosting` |
| `plan-monthly-pro` | Pro Monthly | `MONTHLY` | 4999 | `prod-accounting-suite` |
| `plan-yearly-enterprise` | Enterprise Annual | `YEARLY` | 49999 | `prod-cloud-hosting` |

### 4. Discounts

| ID | Name | Type | Value | Scope | Product ID | Status / Condition |
|---|---|---|---:|---|---|---|
| `disc-sub-10` | 10% Sitewide Subscription Discount | `PERCENT` | 10 | `SUBSCRIPTION` | — | Active (min purchase 1000) |
| `disc-prod-fixed-200` | Fixed 200 Off Accounting Suite | `FIXED` | 200 | `PRODUCT` | `prod-accounting-suite` | Active (min purchase 500, limit 500) |
| `disc-expired-blackfriday` | Expired Early Bird Promo | `PERCENT` | 25 | `SUBSCRIPTION` | — | Expired (ended 2023-12-31) |

