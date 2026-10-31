# Brightloop Subscription Management System

One platform to run products, plans, subscriptions, recurring billing, payments and revenue reporting for a subscription business.

> Hackathon project built by a team of 4 using an AI copilot (Google Antigravity).

---

## 1. Problem Statement

Brightloop Software sells business software on subscription (monthly or yearly), with add-ons and product variants. Today subscriptions live in a spreadsheet, renewals are missed, invoices are typed by hand, payments are matched by scrolling bank statements, and nobody knows the real recurring revenue.

This system replaces all of that with one backend and web app that covers the full subscription lifecycle: **catalog → quotation → subscription → invoice → payment → reporting**.

## 2. Requirements Covered

| Area | Requirement | Status |
|---|---|---|
| Signup | Email is unique per account | ✅ |
| Signup | Password longer than 8 characters, with an uppercase letter, a lowercase letter and a special character | ✅ |
| Auth | Forgot password sends a reset link to the registered email (expiring token) | ✅ |
| RBAC | Admin controls everything; only Admin can add staff | ✅ |
| RBAC | Staff have limited access to day-to-day work | ✅ |
| RBAC | Customers see only their own subscriptions and invoices (portal) | ✅ |
| Catalog | Products with name, type, sales price, cost price, notes | ✅ |
| Catalog | Variants (e.g. Brand = Odoo adds 560 to the price) | ✅ |
| Plans | Price, billing period (daily/weekly/monthly/yearly), minimum quantity, availability dates | ✅ |
| Plans | Per-plan options: auto-close on end, close early, pause, renew | ✅ |
| Templates | Quotation templates with plan and product lines and a validity in days | ✅ |
| Subscriptions | Unique number, customer, plan, start/expiry date, payment terms, lines | ✅ |
| Subscriptions | Lifecycle Draft → Quotation → Confirmed → Active → Closed, visible to the team | ✅ |
| Billing | Invoices generated from subscriptions with customer, lines, taxes, totals prefilled | ✅ |
| Billing | Never billed twice, never skipped (idempotent billing job) | ✅ |
| Taxes | Calculated automatically from admin-defined rules | ✅ |
| Invoices | Confirm, cancel, send, print; Draft → Confirmed → Paid | ✅ |
| Discounts | Admin-only; fixed or percentage; min purchase/quantity; start/end dates; usage limit | ✅ |
| Discounts | Apply to specific products or whole subscriptions; auto-applied on next invoice; stop on expiry or limit | ✅ |
| Payments | Recorded with method, amount, date, note against an invoice | ✅ |
| Payments | Paid vs outstanding visible at any time; overdue invoices flagged | ✅ |
| Reports | Dashboard: active subscriptions, revenue, outstanding, overdue, with filters and summary | ✅ |
| Performance | Every page responds in under 2 seconds with thousands of subscriptions | ✅ |

(Tick the boxes as features are completed.)

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev server, simple SPA |
| Styling | Tailwind CSS | Quick, consistent UI |
| Routing / data | React Router, TanStack Query, Axios | Role-based routes, caching, API calls |
| Backend | Node.js 20 + Express | Simple REST API |
| Database | PostgreSQL 15+ | Relational fit for invoices, lines and statuses |
| ORM | Prisma | Typed schema, migrations, seeding |
| Validation | Zod | Shared, clear validation errors |
| Auth | JWT + bcrypt | Stateless auth, hashed passwords |
| Email | Nodemailer (Mailtrap for dev) | Password reset links |
| Scheduler | node-cron | Daily billing job |
| PDF | PDFKit | Printable invoices |
| Testing | Jest + Supertest | Billing, auth and state-machine tests |
| Tooling | ESLint, Prettier, Husky (optional) | Code quality |
| Deploy | Render/Railway (API + DB), Vercel (frontend) | Free tiers |
| AI copilot | Google Antigravity | Code generation, review, tests |

---

## 4. Architecture

```
React SPA (Vite)  ──HTTP/JSON──►  Express API  ──Prisma──►  PostgreSQL
   │                                 │
   │                                 ├── Auth + RBAC middleware
   │                                 ├── Services (catalog, subscriptions, billing, payments, reports)
   │                                 ├── Billing job (node-cron)
   │                                 └── Mailer, PDF generator
   └── Role-based portals: Admin / Staff / Customer
```

### Roles

| Role | Can do |
|---|---|
| ADMIN | Everything: products, plans, taxes, discounts, staff creation, all customers and invoices, reports |
| STAFF | Customers, quotations, subscriptions, invoices, payments, reports (read). Cannot create discounts or staff |
| CUSTOMER | Portal: own subscriptions, own invoices, own payments only |

Roles are enforced in backend middleware. Hiding buttons in the UI is never relied on.

### State machines

```
Subscription:  DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED
Invoice:       DRAFT → CONFIRMED → PAID          (CANCELLED allowed from DRAFT/CONFIRMED)
```

Invalid transitions return `409 Conflict`.

### Key design decisions

- **Idempotent billing:** unique constraint on `(subscriptionId, periodStart)` so a subscription can never be billed twice for the same period. The job also runs inside a transaction and catches unique-violation errors.
- **Money as integers:** all amounts are stored in the smallest unit (paise/cents) to avoid floating-point errors.
- **Discounts on invoice generation:** applicable, in-date, under-limit discounts are applied automatically and `usedCount` is incremented in the same transaction.
- **Payments drive status:** when the sum of payments reaches the invoice total, the invoice becomes `PAID`.
- **Performance:** server-side pagination, indexes on `status`, `dueDate`, `customerId`, `subscriptionId`, and aggregate queries for the dashboard.

---

## 5. Data Model (summary)

- `User` (email unique, passwordHash, role, resetToken, resetExpiry)
- `Customer` (userId, name, phone, address)
- `Product` (name, type, salesPrice, costPrice, notes) and `ProductVariant` (attribute, value, extraPrice)
- `Plan` (name, price, billingPeriod, minQty, startDate, endDate, autoClose, allowPause, allowEarlyClose, allowRenew)
- `QuotationTemplate` (name, validityDays, planId) and `TemplateLine`
- `Subscription` (number, customerId, planId, startDate, expiryDate, paymentTerms, status, nextBillingDate) and `SubscriptionLine` (productId, variantId, qty, unitPrice, taxId, amount)
- `Tax` (name, rate)
- `Discount` (name, type, value, minPurchase, minQty, startDate, endDate, usageLimit, usedCount, appliesTo, productId?, subscriptionId?)
- `Invoice` (number, subscriptionId, customerId, status, periodStart, periodEnd, issueDate, dueDate, subtotal, taxTotal, discountTotal, total) and `InvoiceLine`
- `Payment` (invoiceId, method, amount, paidAt, note)

The full schema lives in `server/prisma/schema.prisma`.

---

## 6. API Overview

Base path: `/api`

| Module | Routes |
|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me` |
| Staff (admin) | `POST /staff`, `GET /staff` |
| Products | `GET/POST /products`, `GET/PUT/DELETE /products/:id`, `POST /products/:id/variants` |
| Plans | `GET/POST /plans`, `GET/PUT /plans/:id`, `POST /plans/:id/pause`, `/close`, `/renew` |
| Taxes | `GET/POST /taxes`, `PUT /taxes/:id` |
| Discounts (admin) | `GET/POST /discounts`, `PUT/DELETE /discounts/:id` |
| Templates | `GET/POST /quotation-templates`, `POST /quotation-templates/:id/create-subscription` |
| Subscriptions | `GET/POST /subscriptions`, `GET/PUT /subscriptions/:id`, `POST /subscriptions/:id/quote`, `/confirm`, `/activate`, `/close` |
| Invoices | `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/confirm`, `/cancel`, `/send`, `GET /invoices/:id/pdf` |
| Billing | `POST /billing/run` (admin), plus the scheduled daily job |
| Payments | `GET /payments`, `POST /invoices/:id/payments` |
| Reports | `GET /reports/summary`, `/reports/revenue`, `/reports/overdue`, `/reports/subscriptions` |
| Portal | `GET /portal/subscriptions`, `GET /portal/invoices`, `GET /portal/invoices/:id/pdf` |

---

## 7. Project Structure

```
subscription-management-system/
├── README.md
├── .gitignore
├── .env.example
├── docs/
│   ├── api.md
│   └── demo-script.md
├── server/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       ├── middleware/        # auth, role guard, error handler, validate
│       ├── modules/
│       │   ├── auth/
│       │   ├── catalog/       # products, variants, plans, taxes, discounts
│       │   ├── subscriptions/ # templates, subscriptions, state machine
│       │   ├── billing/       # invoice generation, job, PDF
│       │   ├── payments/
│       │   └── reports/
│       ├── jobs/
│       └── utils/
└── client/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        ├── components/
        ├── context/           # auth context
        ├── layouts/           # Admin, Staff, Customer layouts
        ├── pages/
        │   ├── auth/
        │   ├── catalog/
        │   ├── subscriptions/
        │   ├── invoices/
        │   ├── payments/
        │   ├── reports/
        │   └── portal/
        └── routes/            # role-protected routes
```

---

## 8. Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local or hosted)
- Git

### Setup

```bash
# 1. Clone
git clone <repo-url>
cd subscription-management-system

# 2. Environment
cp .env.example server/.env
cp .env.example client/.env   # only the VITE_* values are used by the client

# 3. Backend
cd server
npm install
npx prisma migrate dev
npx prisma db seed          # creates admin + sample data
npm run dev                 # http://localhost:5000

# 4. Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

### Environment variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/brightloop` |
| `JWT_SECRET` | Secret for signing tokens | `change-me` |
| `JWT_EXPIRES_IN` | Token lifetime | `1d` |
| `PORT` | API port | `5000` |
| `CLIENT_URL` | Frontend URL (CORS and reset links) | `http://localhost:5173` |
| `SMTP_HOST` / `SMTP_PORT` | Mail server | `sandbox.smtp.mailtrap.io` / `2525` |
| `SMTP_USER` / `SMTP_PASS` | Mail credentials | |
| `MAIL_FROM` | Sender address | `billing@brightloop.test` |
| `RESET_TOKEN_TTL_MINUTES` | Reset link validity | `30` |
| `BILLING_CRON` | Billing job schedule | `0 2 * * *` |
| `VITE_API_URL` | API base URL for the client | `http://localhost:5000/api` |

### Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm test` | Run Jest tests |
| `npm run lint` | Lint code |
| `npx prisma studio` | Browse the database |
| `npm run seed:large` | Seed 5,000+ subscriptions for performance testing |
| `npm run billing:run` | Run the billing job manually |

### Default seeded accounts (development only)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@brightloop.test` | `Admin@12345` |
| Staff | `staff@brightloop.test` | `Staff@12345` |
| Customer | `customer@brightloop.test` | `Cust@12345` |

---

## 9. Development Process

### Team and ownership

| Member | Module | Responsibilities |
|---|---|---|
| Member 1 | Foundation, Auth, RBAC | Repo setup, auth, password reset, role middleware, layouts, customer portal shell |
| Member 2 | Catalog | Products, variants, plans, taxes, discount rules and applicability |
| Member 3 | Subscriptions and Billing | Templates, subscription state machine, billing job, invoice actions, PDF |
| Member 4 | Payments, Reports, Performance | Payments, dashboard, indexes, seed script, deployment, docs |

### Workflow

1. Read the problem statement together and freeze the schema and API list.
2. Create the repo and make the first commit per member (scaffold, schema slices, CI config).
3. Build modules in parallel on feature branches.
4. Integrate billing, discounts, taxes and payments.
5. Build the frontend screens and customer portal.
6. Harden: seed 5,000+ subscriptions, add indexes, test edge cases.
7. Deploy, finalize docs, record the demo.

### Git conventions

- `main` is protected; merge through pull requests with one reviewer.
- Branch names: `feature/<member>-<module>` (e.g. `feature/m2-discounts`).
- Conventional commits: `feat(auth): add signup validation`, `fix(billing): prevent duplicate invoice`, `docs: update README`.
- Every member commits under their own GitHub identity. Check with `git shortlog -sn`.

### How we used the AI copilot (Google Antigravity)

- Gave the copilot context first: the relevant problem-statement scene plus the Prisma schema.
- Worked one module at a time, never "the whole app" in one prompt.
- Asked for tests with the code (billing idempotency, password rules, state transitions).
- Used the copilot for boilerplate (CRUD, validation, PDF templates, seed data) and for code review ("find ways an invoice could be generated twice").
- Business rules (billing, discounts, taxes) were reviewed by a human before merge.
- Every merged PR was read by at least one teammate other than the author.

---

## 10. Testing

- **Unit:** password validation, tax calculation, discount applicability, state machine transitions.
- **Integration (Supertest):** signup/login/reset flow, RBAC (staff and customer blocked from admin routes, customer blocked from other customers' invoices), billing job run twice creates one invoice, payment marks invoice Paid.
- **Performance:** with the large seed (5,000+ subscriptions, 20,000+ invoices), list and dashboard endpoints respond in under 2 seconds.

## 11. Security notes

- Passwords hashed with bcrypt; never returned by the API.
- JWT verified on every protected route; role guard in middleware.
- Ownership checks on every customer-facing resource.
- Reset tokens are random, stored hashed, single-use and expire.
- Inputs validated with Zod; Prisma prevents SQL injection.
- Rate limiting on auth routes; CORS restricted to `CLIENT_URL`.

## 12. Deployment

- **Database + API:** Render or Railway. Set the environment variables above and run `npx prisma migrate deploy` on release.
- **Frontend:** Vercel. Set `VITE_API_URL` to the deployed API.
- **Live URL:** https://brightloop.vercel.app _(update after deployment)_
- **Demo video:** _add after recording_
- **API base:** https://brightloop-api.onrender.com _(update after deployment)_

## 13. Demo Script (5 minutes)

1. Sign up with a weak password (rejected), then a valid one, then log in.
2. Admin creates a product with the Odoo variant (+560), a plan, a tax and a discount.
3. Staff creates a quotation from a template and moves it Draft → Active.
4. Run the billing job, then run it again and show nothing is duplicated.
5. Show the discount on the invoice, then confirm, send and print it.
6. Record a partial and then a full payment; the status changes to Paid.
7. Customer portal: the customer sees only their own data.
8. Finance dashboard: active subscriptions, revenue, outstanding, overdue, with filters, fast on the large dataset.

## 14. Team

| Name | GitHub | Module |
|---|---|---|
| _Member 1_ | @ | Foundation, Auth, RBAC |
| _Member 2_ | @ | Catalog |
| _Member 3_ | @ | Subscriptions and Billing |
| _Member 4_ | @ | Payments, Reports, Performance |

## 15. License

MIT (or as required by the hackathon).
