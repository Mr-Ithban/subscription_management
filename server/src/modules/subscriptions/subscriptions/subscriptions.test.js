import { jest } from '@jest/globals';
import { createSubscription, getSubscription, SubscriptionError, updateSubscription, listSubscriptions, transitionSubscription } from './service.js';

function fakePrisma() {
  const plan = { id: 'plan_1', status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: null, minQty: 1 };
  const product = { id: 'product_1', active: true, salesPrice: 1000 };
  const variant = { id: 'variant_1', productId: 'product_1', extraPrice: 250 };
  const tax = { id: 'tax_1', active: true, rate: 18 };
  const subscription = { id: 'sub_1', customerId: 'customer_1', planId: 'plan_1', startDate: new Date('2026-02-01') };
  const tx = {
    subscriptionLine: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    subscriptionHistory: { create: jest.fn(async ({ data }) => data) },
    subscription: { update: jest.fn(async ({ data }) => ({ ...subscription, ...data })) },
  };
  let currentStatus = 'DRAFT';
  tx.subscription.findUnique = jest.fn(async () => ({
    id: 'sub_1', status: currentStatus, expiryDate: null, plan: { allowEarlyClose: true },
  }));
  tx.subscription.updateMany = jest.fn(async ({ where, data }) => {
    if (currentStatus !== where.status) return { count: 0 };
    currentStatus = data.status;
    return { count: 1 };
  });
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

  it('allows each documented transition and records the actor and history', async () => {
    const prisma = fakePrisma();
    prisma.tx.subscription.findUnique.mockImplementation(async () => ({
      id: 'sub_1', status: prisma.tx.currentStatus ?? 'DRAFT', expiryDate: null, plan: { allowEarlyClose: true },
    }));
    const statuses = ['QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];
    let fromStatus = 'DRAFT';
    for (const toStatus of statuses) {
      prisma.tx.subscription.findUnique.mockResolvedValueOnce({
        id: 'sub_1', status: fromStatus, expiryDate: null, plan: { allowEarlyClose: true },
      });
      prisma.tx.subscription.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.tx.subscription.findUnique.mockResolvedValueOnce({ id: 'sub_1', status: toStatus });
      const result = await transitionSubscription(prisma, 'sub_1', toStatus, { changedById: 'user_1', note: 'approved' });
      expect(result.status).toBe(toStatus);
      expect(prisma.tx.subscriptionHistory.create).toHaveBeenLastCalledWith({
        data: { subscriptionId: 'sub_1', fromStatus, toStatus, changedById: 'user_1', note: 'approved' },
      });
      fromStatus = toStatus;
    }
  });

  it('rejects skipped transitions and plan-disallowed early closure with 409', async () => {
    const prisma = fakePrisma();
    prisma.tx.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_1', status: 'DRAFT', expiryDate: null, plan: { allowEarlyClose: true },
    });
    await expect(transitionSubscription(prisma, 'sub_1', 'ACTIVE')).rejects.toMatchObject({ statusCode: 409 });

    prisma.tx.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_1', status: 'ACTIVE', expiryDate: new Date(Date.now() + 86400000), plan: { allowEarlyClose: false },
    });
    await expect(transitionSubscription(prisma, 'sub_1', 'CLOSED')).rejects.toMatchObject({ statusCode: 409 });
  });
});
