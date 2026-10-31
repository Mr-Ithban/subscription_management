import { randomBytes } from 'node:crypto';

export class BillingError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'BillingError';
    this.statusCode = statusCode;
  }
}

const invoiceInclude = { lines: true, discounts: true, subscription: true };
const MAX_CURRENCY_INT = 2_147_483_647;

function atUtcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function nextPeriodStart(startDate, billingPeriod) {
  const next = new Date(startDate);
  switch (billingPeriod) {
    case 'DAILY': next.setUTCDate(next.getUTCDate() + 1); break;
    case 'WEEKLY': next.setUTCDate(next.getUTCDate() + 7); break;
    case 'MONTHLY': {
      const day = next.getUTCDate();
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
      break;
    }
    case 'YEARLY': {
      const month = next.getUTCMonth();
      const day = next.getUTCDate();
      next.setUTCDate(1);
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      next.setUTCMonth(month);
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), month + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
      break;
    }
    default: throw new BillingError(`Unsupported billing period: ${billingPeriod}`);
  }
  return next;
}

function roundHalfUp(numerator, denominator) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

function calculateDiscount(discount, baseAmount) {
  if (discount.type === 'FIXED') return Math.min(baseAmount, discount.value);
  if (discount.type === 'PERCENT') return Math.min(baseAmount, roundHalfUp(baseAmount * discount.value, 100));
  return 0;
}

function invoiceLineData(lines, taxableAmounts) {
  return lines.map((line, index) => {
    const amount = line.amount;
    const rate = line.tax ? Number(line.tax.rate) : 0;
    const taxAmount = roundHalfUp(taxableAmounts[index] * Math.round(rate * 100), 10000);
    if (![amount, taxAmount].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_CURRENCY_INT)) {
      throw new BillingError('Invoice line amount exceeds the supported currency range');
    }
    return {
      productId: line.productId,
      variantId: line.variantId,
      taxId: line.taxId,
      description: [line.product.name, line.variant?.attribute, line.variant?.value].filter(Boolean).join(' - '),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount,
      taxAmount,
    };
  });
}

function createInvoiceNumber(now) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `INV-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

async function findExistingInvoice(tx, subscriptionId, periodStart) {
  return tx.invoice.findUnique({ where: { subscriptionId_periodStart: { subscriptionId, periodStart } }, include: invoiceInclude });
}

async function applyDiscounts(tx, subscriptionId, lines, totalQty, issueDate) {
  const candidates = await tx.discount.findMany({
    where: {
      active: true,
      startDate: { lte: issueDate },
      endDate: { gte: issueDate },
    },
    orderBy: { createdAt: 'asc' },
  });
  const applied = [];
  const taxableAmounts = lines.map((line) => line.amount);
  let discountTotal = 0;
  for (const discount of candidates) {
    if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) continue;

    let eligibleIndexes = lines.map((_, index) => index);
    let eligibleQty = totalQty;
    if (discount.appliesTo === 'PRODUCT') {
      eligibleIndexes = lines.flatMap((line, index) => line.productId === discount.productId ? [index] : []);
      const matchedLines = eligibleIndexes.map((index) => lines[index]);
      eligibleQty = matchedLines.reduce((sum, line) => sum + line.quantity, 0);
    }
    const eligibleBase = eligibleIndexes.reduce((sum, index) => sum + taxableAmounts[index], 0);
    if (discount.minPurchase !== null && eligibleBase < discount.minPurchase) continue;
    if (discount.minQty !== null && eligibleQty < discount.minQty) continue;
    const amount = calculateDiscount(discount, Math.max(0, eligibleBase - discountTotal));
    if (amount <= 0) continue;

    const usage = await tx.discount.updateMany({
      where: { id: discount.id, usedCount: discount.usedCount, active: true },
      data: { usedCount: { increment: 1 } },
    });
    if (usage.count !== 1) continue;

    let allocationLeft = amount;
    const applicableIndexes = eligibleIndexes.filter((index) => taxableAmounts[index] > 0);
    applicableIndexes.forEach((index, position) => {
      const allocation = position === applicableIndexes.length - 1
        ? allocationLeft
        : Math.floor((amount * taxableAmounts[index]) / eligibleBase);
      taxableAmounts[index] -= allocation;
      allocationLeft -= allocation;
    });

    applied.push({
      discountId: discount.id,
      subscriptionId,
      name: discount.name,
      type: discount.type,
      value: discount.value,
      amount,
    });
    discountTotal += amount;
  }
  return { applied, discountTotal, taxableAmounts };
}

/** Generate one invoice for one subscription billing period. Repeated calls return the existing invoice. */
export async function generateInvoiceForPeriod(prisma, subscriptionId, periodStartInput, { now = new Date() } = {}) {
  const periodStart = atUtcDayStart(new Date(periodStartInput));
  if (Number.isNaN(periodStart.getTime())) throw new BillingError('Valid billing period start is required');

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await findExistingInvoice(tx, subscriptionId, periodStart);
      if (existing) return { invoice: existing, created: false };

      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          lines: { include: { product: true, variant: true, tax: true }, orderBy: { createdAt: 'asc' } },
          plan: true,
        },
      });
      if (!subscription) throw new BillingError('Subscription not found', 404);
      if (subscription.status !== 'ACTIVE') throw new BillingError('Only active subscriptions can be billed', 409);

      const periodEnd = nextPeriodStart(periodStart, subscription.plan.billingPeriod);
      if (periodStart < atUtcDayStart(subscription.startDate)) throw new BillingError('Billing period starts before the subscription', 409);
      if (subscription.expiryDate && periodEnd > atUtcDayStart(subscription.expiryDate)) {
        throw new BillingError('Billing period extends beyond the subscription expiry date', 409);
      }
      if (!subscription.lines.length) throw new BillingError('Cannot invoice a subscription without line items', 400);

      const issueDate = new Date(now);
      if (periodStart > atUtcDayStart(issueDate)) throw new BillingError('Cannot generate an invoice for a future billing period', 409);
      const dueDate = new Date(issueDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + subscription.paymentTerms);
      const lineItems = subscription.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        taxId: line.taxId,
        description: [line.product.name, line.variant?.attribute, line.variant?.value].filter(Boolean).join(' - '),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
      }));
      const subtotal = lineItems.reduce((sum, line) => sum + line.amount, 0);
      const totalQty = subscription.lines.reduce((sum, line) => sum + line.quantity, 0);
      const { applied, discountTotal, taxableAmounts } = await applyDiscounts(tx, subscription.id, subscription.lines, totalQty, issueDate);
      const taxedLines = invoiceLineData(subscription.lines, taxableAmounts);
      const taxTotal = taxedLines.reduce((sum, line) => sum + line.taxAmount, 0);
      const total = Math.max(0, subtotal - discountTotal) + taxTotal;
      if (![subtotal, taxTotal, discountTotal, total].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_CURRENCY_INT)) {
        throw new BillingError('Invoice total exceeds the supported integer range');
      }

      const invoice = await tx.invoice.create({
        data: {
          number: createInvoiceNumber(issueDate),
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          periodStart,
          periodEnd,
          issueDate,
          dueDate,
          subtotal,
          taxTotal,
          discountTotal,
          total,
          lines: { create: taxedLines },
          discounts: { create: applied },
        },
        include: invoiceInclude,
      });
      return { invoice, created: true };
    });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const existing = await prisma.invoice.findUnique({
      where: { subscriptionId_periodStart: { subscriptionId, periodStart } },
      include: invoiceInclude,
    });
    if (existing) return { invoice: existing, created: false };
    throw error;
  }
}
