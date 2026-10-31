import { jest } from '@jest/globals';
import { createSubscription, getSubscription, SubscriptionError, updateSubscription, listSubscriptions } from './service.js';

function fakePrisma() {
  const plan = { id: 'plan_1', status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: null, minQty: 1 };
  const product = { id: 'product_1', active: true, salesPrice: 1000 };
  const variant = { id: 'variant_1', productId: 'product_1', extraPrice: 250 };
  const tax = { id: 'tax_1', active: true, rate: 18 };
  const subscription = { id: 'sub_1', customerId: 'customer_1', planId: 'plan_1', startDate: new Date('2026-02-01') };
  const tx = {
    subscriptionLine: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    subscription: { update: jest.fn(async ({ data }) => ({ ...subscription, ...data })) },
  };
  return {
    plan: { findUnique: jest.fn(async () => plan) },
    customer: { findUnique: jest.fn(async () => ({ id: 'customer_1' })) },
    product: { findUnique: jest.fn(async () => product) },
    productVariant: { findUnique: jest.fn(async () => variant) },
    tax: { findUnique: jest.fn(async () => tax) },
    subscription: {
      count: jest.fn(async () => 1),
      findMany: jest.fn(async () => [subscription]),
      findUnique: jest.fn(async () => subscription),
      create: jest.fn(async ({ data }) => ({ ...data, id: 'sub_new' })),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
    tx,
  };
}

describe('subscription service', () => {
  it('creates a draft and calculates line prices from product and variant catalog prices', async () => {
    const prisma = fakePrisma();
    const result = await createSubscription(prisma, {
      customerId: 'customer_1', planId: 'plan_1', startDate: new Date('2026-02-01'), paymentTerms: 15,
      lines: [{ productId: 'product_1', variantId: 'variant_1', taxId: 'tax_1', quantity: 2 }],
    });

    expect(result.id).toBe('sub_new');
    expect(result.status).toBeUndefined();
    expect(result.lines.create[0]).toMatchObject({ unitPrice: 1250, amount: 2500, quantity: 2, taxId: 'tax_1' });
    expect(result.number).toMatch(/^SUB-/);
  });

  it('rejects an invalid customer, inactive plan, or mismatched variant', async () => {
    const prisma = fakePrisma();
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(createSubscription(prisma, {
      customerId: 'missing', planId: 'plan_1', startDate: new Date('2026-02-01'), lines: [],
    })).rejects.toMatchObject({ statusCode: 404 });

    prisma.customer.findUnique.mockResolvedValue({ id: 'customer_1' });
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'variant_1', productId: 'other', extraPrice: 1 });
    await expect(createSubscription(prisma, {
      customerId: 'customer_1', planId: 'plan_1', startDate: new Date('2026-02-01'),
      lines: [{ productId: 'product_1', variantId: 'variant_1', quantity: 1 }],
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('replaces line items transactionally on update', async () => {
    const prisma = fakePrisma();
    const result = await updateSubscription(prisma, 'sub_1', {
      lines: [{ productId: 'product_1', quantity: 3 }],
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tx.subscriptionLine.deleteMany).toHaveBeenCalledWith({ where: { subscriptionId: 'sub_1' } });
    expect(result.lines.create[0]).toMatchObject({ quantity: 3, unitPrice: 1000, amount: 3000 });
  });

  it('returns 404 for missing subscriptions and paginates lists', async () => {
    const prisma = fakePrisma();
    prisma.subscription.findUnique.mockResolvedValue(null);
    await expect(getSubscription(prisma, 'missing')).rejects.toBeInstanceOf(SubscriptionError);
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub_1' });
    const result = await listSubscriptions(prisma, { page: 2, limit: 10, status: 'ACTIVE' });
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: { status: 'ACTIVE' } }));
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, pages: 1 });
  });
});
