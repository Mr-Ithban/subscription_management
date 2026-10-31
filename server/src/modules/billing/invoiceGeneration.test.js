import { jest } from '@jest/globals';
import { BillingError, generateInvoiceForPeriod, nextPeriodStart } from './invoiceGeneration.js';

const subscription = {
  id: 'sub_1',
  customerId: 'customer_1',
  status: 'ACTIVE',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  expiryDate: null,
  paymentTerms: 15,
  plan: { billingPeriod: 'MONTHLY' },
  lines: [{
    productId: 'product_1',
    variantId: null,
    taxId: 'tax_1',
    quantity: 1,
    unitPrice: 2500,
    amount: 2500,
    product: { name: 'Brightloop' },
    variant: null,
    tax: { rate: 18 },
  }],
};

function fakePrisma({ existing = null, discounts = [] } = {}) {
  const tx = {
    invoice: {
      findUnique: jest.fn(async () => existing),
      create: jest.fn(async ({ data }) => ({ id: 'invoice_1', ...data })),
    },
    subscription: { findUnique: jest.fn(async () => subscription) },
    discount: {
      findMany: jest.fn(async () => discounts),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  return {
    tx,
    $transaction: jest.fn(async (callback) => callback(tx)),
    invoice: { findUnique: jest.fn(async () => existing) },
  };
}

describe('invoice generation', () => {
  it('clamps monthly and yearly periods to the final valid day', () => {
    expect(nextPeriodStart(new Date('2026-01-31T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(nextPeriodStart(new Date('2024-02-29T00:00:00Z'), 'YEARLY').toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });

  it('creates invoice totals from integer line amounts, tax, discount, and payment terms', async () => {
    const prisma = fakePrisma({ discounts: [{
      id: 'discount_1', name: 'Ten percent', type: 'PERCENT', value: 10,
      appliesTo: 'SUBSCRIPTION', productId: null, minPurchase: null, minQty: null,
      startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
      usageLimit: 5, usedCount: 0, active: true,
    }] });

    const result = await generateInvoiceForPeriod(prisma, 'sub_1', new Date('2026-01-31T13:00:00Z'), {
      now: new Date('2026-01-31T00:00:00Z'),
    });

    expect(result.created).toBe(true);
    expect(prisma.tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        periodStart: new Date('2026-01-31T00:00:00Z'),
        periodEnd: new Date('2026-02-28T00:00:00Z'),
        dueDate: new Date('2026-02-15T00:00:00Z'),
        subtotal: 2500,
        taxTotal: 405,
        discountTotal: 250,
        total: 2655,
      }),
    }));
    expect(prisma.tx.discount.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'discount_1', usedCount: 0, active: true },
      data: { usedCount: { increment: 1 } },
    }));
  });

  it('returns the existing invoice on repeated generation without consuming discounts again', async () => {
    const existing = { id: 'invoice_existing' };
    const prisma = fakePrisma({ existing, discounts: [{ id: 'discount_1' }] });
    const result = await generateInvoiceForPeriod(prisma, 'sub_1', new Date('2026-01-01'));
    expect(result).toEqual({ invoice: existing, created: false });
    expect(prisma.tx.discount.findMany).not.toHaveBeenCalled();
    expect(prisma.tx.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects inactive subscriptions and periods beyond expiry', async () => {
    const prisma = fakePrisma();
    prisma.tx.subscription.findUnique.mockResolvedValueOnce({ ...subscription, status: 'CONFIRMED' });
    await expect(generateInvoiceForPeriod(prisma, 'sub_1', new Date('2026-01-01')))
      .rejects.toMatchObject({ statusCode: 409 });

    prisma.tx.subscription.findUnique.mockResolvedValueOnce({
      ...subscription, expiryDate: new Date('2026-01-31T00:00:00Z'),
    });
    await expect(generateInvoiceForPeriod(prisma, 'sub_1', new Date('2026-01-01')))
      .rejects.toBeInstanceOf(BillingError);
  });

  it('rejects future periods and totals outside PostgreSQL integer currency range', async () => {
    const prisma = fakePrisma();
    await expect(generateInvoiceForPeriod(prisma, 'sub_1', new Date('2026-02-01'), {
      now: new Date('2026-01-31T23:59:00Z'),
    })).rejects.toMatchObject({ statusCode: 409 });

    const oversized = fakePrisma();
    oversized.tx.subscription.findUnique.mockResolvedValueOnce({
      ...subscription,
      lines: [{ ...subscription.lines[0], amount: 2_147_483_648, unitPrice: 2_147_483_648, tax: null }],
    });
    await expect(generateInvoiceForPeriod(oversized, 'sub_1', new Date('2026-01-01'), {
      now: new Date('2026-01-31T00:00:00Z'),
    })).rejects.toBeInstanceOf(BillingError);
  });
});
