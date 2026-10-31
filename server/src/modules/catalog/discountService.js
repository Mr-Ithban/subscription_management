import { PrismaClient } from '@prisma/client';

const defaultPrisma = new PrismaClient();

export class CatalogError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CatalogError';
    this.statusCode = statusCode;
  }
}

/**
 * Evaluates available discounts against order/subscription lines and returns the applicable discounts.
 *
 * Rules:
 * - Date must be between startDate and endDate (inclusive).
 * - usedCount < usageLimit (or no limit).
 * - Minimum purchase and quantity constraints:
 *   - SUBSCRIPTION discounts apply to the whole order subtotal and totalQty.
 *   - PRODUCT discounts apply only to matching product lines and their subtotal/qty.
 *
 * @param {object} params
 * @param {Array<object>} [params.discounts] - Optional list of discounts (pure evaluation if provided)
 * @param {Array<object>} [params.lines=[]] - Order/invoice lines
 * @param {number} [params.subtotal] - Order subtotal (calculated from lines if omitted)
 * @param {number} [params.totalQty] - Total order quantity (calculated from lines if omitted)
 * @param {Date | string | number} [params.date=new Date()] - Evaluation reference date
 * @param {import('@prisma/client').PrismaClient} [params.prisma=defaultPrisma] - Prisma client instance
 * @returns {Promise<Array<object>>} List of applicable discount objects
 */
export async function getApplicableDiscounts({
  discounts,
  lines = [],
  subtotal,
  totalQty,
  date = new Date(),
  prisma = defaultPrisma,
}) {
  const referenceDate = date instanceof Date ? date : new Date(date);

  const availableDiscounts =
    discounts !== undefined
      ? discounts
      : await prisma.discount.findMany({
          where: { active: true },
          include: { product: true },
        });

  // Calculate order subtotal and total quantity if not explicitly provided
  const orderSubtotal =
    subtotal !== undefined
      ? Number(subtotal)
      : lines.reduce(
          (sum, line) =>
            sum + (line.subtotal ?? Number(line.unitPrice || 0) * Number(line.qty || 1)),
          0
        );

  const orderQty =
    totalQty !== undefined
      ? Number(totalQty)
      : lines.reduce((sum, line) => sum + Number(line.qty || 1), 0);

  return availableDiscounts.filter((discount) => {
    // 1. Must be active
    if (discount.active === false) {
      return false;
    }

    // 2. Date check: date is within startDate and endDate
    const start = new Date(discount.startDate);
    const end = new Date(discount.endDate);
    if (referenceDate < start || referenceDate > end) {
      return false;
    }

    // 3. Usage limit check: usedCount < usageLimit (or no limit)
    if (discount.usageLimit !== null && discount.usageLimit !== undefined) {
      if (discount.usedCount >= discount.usageLimit) {
        return false;
      }
    }

    // 4. Scope & minimum thresholds check
    if (discount.appliesTo === 'SUBSCRIPTION') {
      // SUBSCRIPTION discounts evaluate against whole order subtotal & totalQty
      if (discount.minPurchase !== null && discount.minPurchase !== undefined) {
        if (orderSubtotal < discount.minPurchase) {
          return false;
        }
      }

      if (discount.minQty !== null && discount.minQty !== undefined) {
        if (orderQty < discount.minQty) {
          return false;
        }
      }

      return true;
    }

    if (discount.appliesTo === 'PRODUCT') {
      // PRODUCT discounts apply to matching lines only
      if (!discount.productId) {
        return false;
      }

      const matchingLines = lines.filter((line) => line.productId === discount.productId);
      if (matchingLines.length === 0) {
        return false;
      }

      const matchingSubtotal = matchingLines.reduce(
        (sum, line) =>
          sum + (line.subtotal ?? Number(line.unitPrice || 0) * Number(line.qty || 1)),
        0
      );
      const matchingQty = matchingLines.reduce((sum, line) => sum + Number(line.qty || 1), 0);

      if (discount.minPurchase !== null && discount.minPurchase !== undefined) {
        if (matchingSubtotal < discount.minPurchase) {
          return false;
        }
      }

      if (discount.minQty !== null && discount.minQty !== undefined) {
        if (matchingQty < discount.minQty) {
          return false;
        }
      }

      return true;
    }

    return false;
  });
}

/**
 * Computes the monetary discount amount for a given base amount.
 *
 * Rules:
 * - Result is an integer in the smallest currency unit.
 * - FIXED discounts never exceed the base amount.
 * - PERCENT discounts round half up.
 *
 * @param {object} discount - Discount configuration
 * @param {number} baseAmount - Base monetary amount in smallest unit (integer)
 * @returns {number} Discount amount (integer >= 0)
 */
export function computeDiscountAmount(discount, baseAmount) {
  const base = Number(baseAmount);

  if (!Number.isFinite(base) || base <= 0) {
    return 0;
  }

  if (!discount || typeof discount !== 'object') {
    throw new Error('Valid discount object must be provided to computeDiscountAmount');
  }

  if (discount.type === 'FIXED') {
    const fixedVal = Number(discount.value);
    if (!Number.isFinite(fixedVal) || fixedVal <= 0) {
      return 0;
    }
    // FIXED never exceeds the base amount
    return Math.min(Math.round(fixedVal), Math.round(base));
  }

  if (discount.type === 'PERCENT') {
    const pct = Number(discount.value);
    if (!Number.isFinite(pct) || pct <= 0) {
      return 0;
    }
    // PERCENT rounds half up
    const raw = (base * pct) / 100;
    const computed = Math.round(Number(raw.toFixed(8)));
    return Math.min(computed, Math.round(base));
  }

  throw new Error(`Unsupported discount type: ${discount.type}`);
}

/**
 * Atomically increments usedCount for a discount only while it is still under usageLimit.
 *
 * Uses conditional updateMany so that two invoices cannot both consume the last use.
 *
 * @param {object} tx - Prisma transaction or client
 * @param {string} discountId - ID of the discount to increment
 * @returns {Promise<{ success: boolean, discountId: string, usedCount: number }>}
 */
export async function incrementUsage(tx, discountId) {
  if (!tx) {
    throw new Error('Database transaction client (tx) is required for incrementUsage');
  }

  if (!discountId) {
    throw new Error('discountId is required for incrementUsage');
  }

  // 1. Fetch current discount record to inspect usage limits
  const discount = await tx.discount.findUnique({
    where: { id: discountId },
  });

  if (!discount) {
    throw new CatalogError('Discount not found', 404);
  }

  if (
    discount.usageLimit !== null &&
    discount.usageLimit !== undefined &&
    discount.usedCount >= discount.usageLimit
  ) {
    throw new CatalogError('Discount usage limit has been reached', 409);
  }

  // 2. Atomic conditional update
  const where = {
    id: discountId,
  };

  if (discount.usageLimit !== null && discount.usageLimit !== undefined) {
    where.usedCount = {
      lt: discount.usageLimit,
    };
  }

  const result = await tx.discount.updateMany({
    where,
    data: {
      usedCount: {
        increment: 1,
      },
    },
  });

  if (result.count === 0) {
    throw new CatalogError('Discount usage limit has been reached', 409);
  }

  return {
    success: true,
    discountId,
    usedCount: discount.usedCount + 1,
  };
}

export default {
  getApplicableDiscounts,
  computeDiscountAmount,
  incrementUsage,
};
