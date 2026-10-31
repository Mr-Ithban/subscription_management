# Brightloop Demo Script (5-minute walkthrough)

> **Goal:** Show the full subscription lifecycle — catalog → quotation → invoice → payment → reporting — using seeded data.

---

## Pre-flight (before the demo)

1. Ensure the server is running: `cd server && npm run dev`
2. Ensure the client is running: `cd client && npm run dev`
3. Seed baseline accounts and catalog (if first run): `cd server && npx prisma db seed`
4. Add performance demo data (optional): `cd server && npm run seed:large`

### Seeded accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@brightloop.test` | `Admin@12345` |
| Staff | `staff@brightloop.test` | `Staff@12345` |
| Customer | `customer_1@brightloop.test` | `Customer@12345` |

---

## Step 1 — Login as Admin (30 s)

1. Open `http://localhost:5173/login`
2. Enter **admin@brightloop.test** / **Admin@12345** → click **Sign In**
3. App redirects to **Finance & Revenue Dashboard**

**What to show:** 4 summary cards (active subs, revenue collected, outstanding balance, overdue invoices), revenue bar chart, overdue invoices table at the bottom.

---

## Step 2 — Finance Dashboard (45 s)

1. Toggle the chart between **Day / Week / Month** groupBy
2. Apply a date range filter (e.g. last month) and show how cards update
3. Click **Subscriptions** in the sidebar

**What to show:** Server-side cached summary, real-time revenue breakdown from `groupBy` aggregation.

---

## Step 3 — Subscription Analytics (45 s)

1. On the Subscriptions report page, filter by **Status = ACTIVE**
2. Type a customer name into the search box to narrow down
3. Show pagination controls at the bottom

**What to show:** Indexed, paginated listing of subscriptions with plan, billing period, next billing date.

---

## Step 4 — Record a Payment (90 s)

1. Navigate to **Invoices** → pick a `CONFIRMED` invoice
2. Note: total due, amount paid, remaining balance shown in header
3. Click **Record Payment**
4. Choose method **UPI**, set amount, date, add a note → **Save**
5. Show the payment appears instantly in the payment list
6. If balance reaches zero the invoice auto-flips to **PAID**

**What to show:** Payment form modal, TanStack Query invalidation refreshes the list without a page reload.

---

## Step 5 — Customer Portal (60 s)

1. Open a new tab → `http://localhost:5173/login`
2. Login as **customer_1@brightloop.test** / **Customer@12345**
3. App redirects to **My Payment History** portal
4. Show only this customer's payments (scoped to their account from JWT)

**What to show:** Role-based routing; portal sidebar distinct from admin sidebar; data scoped by customer ID from JWT — never readable by other customers.

---

## Step 6 — Performance Proof (30 s, optional)

In a terminal:
```bash
cd server
npm run benchmark
```

Show all 7 endpoint SLA checks completing in under 2 s with 5 000 customers / 8 000 subscriptions / 20 000 invoices in the database.

---

## Key talking points

- **Money as integers** — no floating-point rounding errors in financial totals
- **Idempotent billing** — unique constraint on `(subscriptionId, periodStart)` prevents double-billing
- **DB indexes** on `status`, `dueDate`, `customerId` make reports fast even at scale
- **In-memory cache** on the summary endpoint (30 s TTL) — prevents hammering the DB on dashboard loads
- **RBAC enforced server-side** — UI hiding is cosmetic only; every route checks the JWT role
- **Customer portal scoped by JWT** — customers can never see another customer's payments, even with direct API access
