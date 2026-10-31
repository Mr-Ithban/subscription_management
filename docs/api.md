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

`GET /api/customers?page=1&limit=20&search=...` lists customers for ADMIN and STAFF users; search matches customer names and account emails. `POST /api/staff` and `GET /api/staff?page=1&limit=20` require an ADMIN bearer token.
Create body: `{ "name": "Sam Staff", "email": "sam@example.test", "password": "StrongPass!" }`.
The password must contain at least 9 characters, uppercase and lowercase letters, and a special character.
Staff lists return `{ "data": [], "page": 1, "limit": 20, "total": 0 }` without password hashes.

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
| `prod-thermal-paper` | Thermal Receipt Paper Rolls | `GOODS` | 1200 | 600 | 50-roll pack consumable supplies |
| `prod-priority-support` | 24/7 Priority Support SLA | `SERVICE` | 8000 | 3000 | Enterprise technical support SLA |
| `prod-analytics-dashboard` | Executive Analytics Addon | `SERVICE` | 15000 | 5000 | Real-time BI reporting and analytics |
| `prod-cloud-backup` | Cloud Backup Storage | `SOFTWARE` | 129900 | 52000 | Encrypted scheduled cloud backups |
| `prod-team-workspace` | Team Collaboration Workspace | `SOFTWARE` | 89900 | 34000 | Shared workspace and project tools |
| `prod-secure-mail` | Secure Mail Suite | `SOFTWARE` | 59900 | 21000 | Business email and domain protection |
| `prod-crm-automation` | CRM Automation Pack | `SOFTWARE` | 149900 | 62000 | Sales pipeline and follow-up workflows |
| `prod-analytics-pro` | Data Analytics Pro | `SOFTWARE` | 199900 | 78000 | Advanced dashboards and reporting |
| `prod-managed-database` | Managed Database Service | `SERVICE` | 179900 | 98000 | Managed backups and monitoring |
| `prod-onboarding` | Onboarding and Migration | `SERVICE` | 249900 | 132000 | Guided customer setup and data migration |
| `prod-api-integration` | API Integration Pack | `SERVICE` | 99900 | 46000 | Common third-party integration support |
| `prod-barcode-scanner` | Wireless Barcode Scanner | `GOODS` | 89900 | 54000 | Wireless retail and warehouse scanner |
| `prod-receipt-printer` | Thermal Receipt Printer | `GOODS` | 159900 | 99000 | Compact point-of-sale printer |
| `prod-network-gateway` | Managed Network Gateway | `GOODS` | 259900 | 172000 | Secure monitored branch gateway |
| `prod-success-workshop` | Customer Success Workshop | `SERVICE` | 79900 | 35000 | Remote product training session |

#### Product Variants (`prod-accounting-suite`)
- `var-brand-odoo`: Attribute `Brand`, Value `Odoo`, Extra Price `560` (Total: 10560)
- `var-brand-zoho`: Attribute `Brand`, Value `Zoho`, Extra Price `300` (Total: 10300)

Other demo variants include Premium cloud backup (+25000), a 25-user collaboration tier (+20000), cloud-hosted analytics (+12000), Bluetooth receipt printing (+3000), and an advanced network gateway license (+45000).

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

## Reports API (M4-4)

Accessible by `ADMIN` and `STAFF`.

- `GET /api/reports/summary?from&to`: aggregated finance summary (active subscription count, subscriptions by status, revenue, invoiced total, outstanding total, overdue count and amount, MRR estimate). Cached in-memory for 30 seconds.
- `GET /api/reports/revenue?from&to&groupBy=day|week|month`: revenue grouped by day, week, or month.
- `GET /api/reports/subscriptions?status&planId&customerId&page&limit`: filtered and paginated subscriptions list.
- `GET /api/reports/overdue?page&limit&customerId&asOf`: overdue invoices with days overdue and remaining balance.

---

## Auth API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | public | Register new user. Body: `{ email, password, name, role? }` |
| POST | `/api/auth/login` | public | Login. Body: `{ email, password }`. Returns `{ token, user }` |
| POST | `/api/auth/forgot-password` | public | Send reset email. Body: `{ email }` |
| POST | `/api/auth/reset-password` | public | Reset password. Body: `{ token, password }` |
| GET | `/api/auth/me` | Bearer | Current user info |

---

## Products API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | ADMIN, STAFF | List products. Query: `?page&limit&search` |
| POST | `/api/products` | ADMIN | Create product. Body: `{ name, type, salesPrice, costPrice?, notes? }` |
| GET | `/api/products/:id` | ADMIN, STAFF | Get single product |
| PUT | `/api/products/:id` | ADMIN | Update product |
| DELETE | `/api/products/:id` | ADMIN | Soft-delete product |
| POST | `/api/products/:id/variants` | ADMIN | Add variant. Body: `{ attribute, value, extraPrice }` |

---

## Payments API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/payments` | ADMIN, STAFF | List all payments. Query: `?page&limit&invoiceId` |
| GET | `/api/invoices/:id/payments` | ADMIN, STAFF | List payments for invoice |
| POST | `/api/invoices/:id/payments` | ADMIN, STAFF | Record payment. Body: `{ method, amount, paidAt, note? }` |

### Payment methods
`CARD` `UPI` `BANK_TRANSFER` `CASH` `CHEQUE` `ONLINE`

### Record Payment example
```http
POST /api/invoices/inv_123/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "UPI",
  "amount": 59900,
  "paidAt": "2026-10-31T10:00:00.000Z",
  "note": "UPI ref: 1234567890"
}
```
Response `201`:
```json
{
  "id": "pmt_abc",
  "invoiceId": "inv_123",
  "method": "UPI",
  "amount": 59900,
  "paidAt": "2026-10-31T10:00:00.000Z",
  "note": "UPI ref: 1234567890"
}
```

---

## Portal API (Customer only)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portal/payments` | CUSTOMER | Paginated payments scoped to logged-in customer. Query: `?page&limit` |

---

## Reports API (detailed)

### GET /api/reports/summary

Query params: `from` (ISO date), `to` (ISO date)

Response (200):
```json
{
  "activeSubscriptionCount": 42,
  "subscriptionsByStatus": { "ACTIVE": 42, "CONFIRMED": 8 },
  "revenue": 1250000,
  "invoicedTotal": 1800000,
  "outstandingTotal": 550000,
  "overdueCount": 5,
  "overdueAmount": 125000,
  "mrr": 208333
}
```

### GET /api/reports/revenue

Query params: `groupBy=day|week|month`, `from`, `to`

Response (200):
```json
{
  "groupBy": "month",
  "totalRevenue": 1250000,
  "breakdown": [
    { "period": "2026-09", "revenue": 620000 },
    { "period": "2026-10", "revenue": 630000 }
  ]
}
```

### GET /api/reports/subscriptions

Query params: `status`, `planId`, `customerId`, `page`, `limit`

Response (200): `{ data: [...], page, limit, total }`

### GET /api/reports/overdue

Query params: `page`, `limit`, `customerId`, `asOf` (ISO date, default: today)

Response (200): `{ data: [{ id, number, dueDate, daysOverdue, remainingBalance, status, customer }], page, limit, total }`
