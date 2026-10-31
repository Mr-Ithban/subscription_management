# Member 2: Catalog Task Specifications

## [x] M2-1: Catalog Schema
- **Branch**: `feature/m2-catalog-schema`
- **Scope**: `server/prisma/schema.prisma` under `// ===== CATALOG =====`
- **Models**: `Tax`, `Product`, `ProductVariant`, `Plan`, `Discount`
- **Indexes**: `Plan.status`, `Discount.endDate`
- **Commit**: `feat(catalog): add catalog, plan and discount prisma models`

---

## [x] M2-2: Products and Variants
- **Branch**: `feature/m2-products`
- **Scope**: `server/src/modules/catalog/products`, `server/src/modules/catalog/pricing.js`
- **Endpoints**:
  - `GET /api/products` (paginated, search by name, filter by type) — ADMIN, STAFF
  - `GET /api/products/:id` — ADMIN, STAFF
  - `POST /api/products` — ADMIN only
  - `PUT /api/products/:id` — ADMIN only
  - `DELETE /api/products/:id` (soft delete via active=false) — ADMIN only
  - `POST /api/products/:id/variants` (`attribute`, `value`, `extraPrice`) — ADMIN only
  - `PUT /api/products/:id/variants/:variantId` — ADMIN only
  - `DELETE /api/products/:id/variants/:variantId` — ADMIN only
- **Exports**: `getUnitPrice(product, variant)` from `src/modules/catalog/pricing.js`
- **Commit**: `feat(catalog): add product and variant endpoints with pricing helper`

---

## [x] M2-3: Plans and Billing Period Helper
- **Branch**: `feature/m2-plans`
- **Scope**: `server/src/modules/catalog/plans`, `server/src/modules/catalog/billingPeriod.js`
- **Requirements**:
  - CRUD for plans: `name`, `price`, `billingPeriod` (`DAILY|WEEKLY|MONTHLY|YEARLY`), `minQty`, `startDate`, `endDate`, and flags `autoClose`, `allowPause`, `allowEarlyClose`, `allowRenew`.
  - Validate: `endDate` must be after `startDate`.
  - Permissions: ADMIN writes; ADMIN and STAFF read.
  - `GET /api/plans` supports filters: `status` and `availableOn=YYYY-MM-DD`.
  - Export `getNextBillingDate(fromDate, billingPeriod)` from `src/modules/catalog/billingPeriod.js`:
    - `DAILY`: +1 day
    - `WEEKLY`: +7 days
    - `MONTHLY`: +1 calendar month clamped to month end
    - `YEARLY`: +1 year
  - Tests: Thorough edge cases (31 Jan to 28 Feb, leap years).
- **Commit**: `feat(catalog): add plan endpoints and billing period helper`

---

## [x] M2-4: Plan Pause, Close, Renew and Auto-Close
- **Branch**: `feature/m2-plan-actions`
- **Scope**: `server/src/modules/catalog/plans`, `server/src/jobs/`
- **Requirements**:
  - `POST /api/plans/:id/pause` (only if `allowPause`)
  - `POST /api/plans/:id/close` (only if `allowEarlyClose`)
  - `POST /api/plans/:id/renew` (only if `allowRenew`; extends `endDate` by one billing period, sets status `ACTIVE`)
  - Return `409 Conflict` when plan disallowed or transition invalid.
  - Function `autoClosePlans(today)` in `src/jobs/autoClosePlans.js`: closes `ACTIVE` plans with `autoClose=true` whose `endDate` has passed.
  - Register daily with `node-cron` in `src/jobs/index.js` without altering other jobs.
- **Commit**: `feat(catalog): add plan pause, close and renew actions with auto-close job`

---

## [x] M2-5: Taxes
- **Branch**: `feature/m2-taxes`
- **Scope**: `server/src/modules/catalog/taxes`, `server/src/modules/catalog/tax.js`
- **Requirements**:
  - Tax CRUD: `name`, `rate` (percentage 0 to 100), `active` (ADMIN writes, ADMIN/STAFF read).
  - Helpers in `src/modules/catalog/tax.js`:
    - `calculateTax(amountInt, ratePercent)` returning integer with round-half-up.
    - `lineTotals({ unitPrice, qty, ratePercent })` returning `{ subtotal, tax, total }`.
  - Tests: 18% on 1000, rounding edge cases, 0%.
- **Commit**: `feat(catalog): add tax rules and tax calculation helpers`

---

## [x] M2-6: Discount Rules (Admin Only)
- **Branch**: `feature/m2-discounts`
- **Scope**: `server/src/modules/catalog/discounts`
- **Requirements**:
  - CRUD at `/api/discounts` (ADMIN only; STAFF/CUSTOMER get 403).
  - Fields: `name`, `type` (`FIXED|PERCENT`), `value`, `minPurchase`, `minQty`, `startDate`, `endDate`, `usageLimit`, `appliesTo` (`PRODUCT|SUBSCRIPTION`), `productId` (required if `appliesTo=PRODUCT`).
  - Validate: `PERCENT` value 1 to 100, `endDate` after `startDate`, `productId` presence.
  - List filter: `status=active|expired|exhausted` computed from dates and `usedCount`.
- **Commit**: `feat(catalog): add admin-only discount rules`

---

## [ ] M2-7: Discount Applicability Service
- **Branch**: `feature/m2-discount-logic`
- **Scope**: `src/modules/catalog/discountService.js`
- **Exports**:
  - `getApplicableDiscounts({ lines, subtotal, totalQty, date })`
  - `computeDiscountAmount(discount, baseAmount)`
  - `incrementUsage(tx, discountId)` (atomic conditional update)
- **Commit**: `feat(catalog): add discount applicability and usage tracking service`

---

## [ ] M2-8: Catalog UI
- **Branch**: `feature/m2-catalog-ui`
- **Scope**: `client/src/pages/catalog/`
- **Screens**: Products (with variant editor), Plans (with action buttons), Taxes, Discounts.
- **Commit**: `feat(client): add product, plan, tax and discount screens`

---

## [ ] M2-9: Catalog Seed Data
- **Branch**: `feature/m2-catalog-seed`
- **Scope**: `server/prisma/seed.js`, `docs/api.md`
- **Entities**: 3 taxes, 6 products (including Odoo +560, Zoho +300), 4 plans, 3 discounts. Use upserts.
- **Commit**: `feat(catalog): add catalog seed data`
