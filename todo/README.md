# Brightloop — Member 2 (Catalog) Task Tracker

> Scope: Products, Plans, Taxes, Discounts (Backend & Frontend)
> Configured Author: `shibil-ek <shibilerakkingal10@gmail.com>`

---

## Workflow Per Task
1. Switch to base / integration branch, pull latest:
   ```powershell
   git checkout feature/m1-scaffold
   git pull origin feature/m1-scaffold
   ```
2. Create and checkout the feature branch:
   ```powershell
   git checkout -b <task-branch>
   ```
3. Implement the feature and write business rule Jest tests in `server/`.
4. Run tests and linting:
   ```powershell
   npm test
   npm run lint
   ```
5. Review `git status` and `git diff` before committing.
6. Commit with the **exact** message specified under your git identity.
7. Push the branch from your terminal and open a PR:
   ```powershell
   git push -u origin <task-branch>
   ```

---

## Tasks Overview

| Task | Title | Branch | Status | Commit Message |
|---|---|---|:---:|---|
| **M2-1** | Catalog schema | `feature/m2-catalog-schema` | ✅ Done | `feat(catalog): add catalog, plan and discount prisma models` |
| **M2-2** | Products & variants | `feature/m2-products` | ✅ Done | `feat(catalog): add product and variant endpoints with pricing helper` |
| **M2-3** | Plans & billing period helper | `feature/m2-plans` | ✅ Done | `feat(catalog): add plan endpoints and billing period helper` |
| **M2-4** | Plan actions & auto-close job | `feature/m2-plan-actions` | ⏳ Pending | `feat(catalog): add plan pause, close and renew actions with auto-close job` |
| **M2-5** | Taxes & calculation helpers | `feature/m2-taxes` | ⏳ Pending | `feat(catalog): add tax rules and tax calculation helpers` |
| **M2-6** | Discount rules (Admin only) | `feature/m2-discounts` | ⏳ Pending | `feat(catalog): add admin-only discount rules` |
| **M2-7** | Discount applicability service | `feature/m2-discount-logic` | ⏳ Pending | `feat(catalog): add discount applicability and usage tracking service` |
| **M2-8** | Catalog UI screens | `feature/m2-catalog-ui` | ⏳ Pending | `feat(client): add product, plan, tax and discount screens` |
| **M2-9** | Catalog seed data | `feature/m2-catalog-seed` | ⏳ Pending | `feat(catalog): add catalog seed data` |

---

## Member Dependencies
- **Member 3 (Subscriptions & Billing)** depends on:
  - `M2-2`: `getUnitPrice(product, variant)` from `src/modules/catalog/pricing.js`
  - `M2-3`: `getNextBillingDate(fromDate, billingPeriod)` from `src/modules/catalog/billingPeriod.js`
  - `M2-5`: `calculateTax` and `lineTotals` from `src/modules/catalog/tax.js`
  - `M2-7`: `discountService.js` (`getApplicableDiscounts`, `computeDiscountAmount`, `incrementUsage`)
  - `M2-9`: Seeded names in `docs/api.md`
