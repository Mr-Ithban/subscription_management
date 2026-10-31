import { jest } from '@jest/globals';
import { runBilling } from './billingRun.js';

function makePrisma(initialSubscriptions) {
  const subscriptions = new Map(initialSubscriptions.map((subscription) => [subscription.id, { ...subscription }]));
  let runNumber = 0;
  const prisma = {
    subscriptions,
    billingRun: {
      create: jest.fn(async () => ({ id: `run_${++runNumber}` })),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
    },
    subscription: {
      findMany: jest.fn(async ({ where }) => [...subscriptions.values()].filter((subscription) => {
        if (subscription.status !== where.status) return false;
        const dueDate = subscription.nextBillingDate ?? subscription.startDate;
        return new Date(dueDate) <= new Date('2026-01-02T00:00:00Z');
      }).map(({ id, startDate, nextBillingDate, plan }) => ({ id, startDate, nextBillingDate, plan }))),
      updateMany: jest.fn(async ({ where, data }) => {
        const current = subscriptions.get(where.id);
        const sameDate = current.nextBillingDate === where.nextBillingDate
          || (current.nextBillingDate && where.nextBillingDate && new Date(current.nextBillingDate).getTime() === new Date(where.nextBillingDate).getTime());
        if (!current || current.status !== where.status || !sameDate) return { count: 0 };
        current.nextBillingDate = data.nextBillingDate;
        return { count: 1 };
      }),
    },
  };
  return prisma;
}

const dueSubscription = {
  id: 'sub_1',
  status: 'ACTIVE',
  startDate: new Date('2026-01-01T00:00:00Z'),
  nextBillingDate: new Date('2026-01-01T00:00:00Z'),
  plan: { billingPeriod: 'DAILY' },
};

describe('billing run', () => {
  it('catches up every due period, advances nextBillingDate, and is safe to repeat', async () => {
    const prisma = makePrisma([dueSubscription]);
    const invoiceGenerator = jest.fn(async (_db, _subscriptionId, periodStart) => ({
      invoice: { periodStart }, created: true,
    }));
    const firstRun = await runBilling(prisma, { now: new Date('2026-01-02T00:00:00Z'), invoiceGenerator });

    expect(invoiceGenerator).toHaveBeenCalledTimes(2);
    expect(invoiceGenerator.mock.calls.map((call) => call[2].toISOString())).toEqual([
      '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z',
    ]);
    expect(prisma.subscriptions.get('sub_1').nextBillingDate.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(firstRun).toMatchObject({ status: 'COMPLETED', subscriptionsSeen: 1, invoicesCreated: 2, invoicesSkipped: 0, errorCount: 0 });

    const secondRun = await runBilling(prisma, { now: new Date('2026-01-02T00:00:00Z'), invoiceGenerator });
    expect(invoiceGenerator).toHaveBeenCalledTimes(2);
    expect(secondRun).toMatchObject({ status: 'COMPLETED', subscriptionsSeen: 0, invoicesCreated: 0 });
  });

  it('continues other subscriptions after a failure and records a failed partial run', async () => {
    const prisma = makePrisma([
      dueSubscription,
      { ...dueSubscription, id: 'sub_2', nextBillingDate: new Date('2026-01-02T00:00:00Z') },
    ]);
    const invoiceGenerator = jest.fn(async (_db, subscriptionId, periodStart) => {
      if (subscriptionId === 'sub_1') throw new Error('Invalid subscription period');
      return { invoice: { periodStart }, created: false };
    });

    const result = await runBilling(prisma, { now: new Date('2026-01-02T00:00:00Z'), invoiceGenerator });
    expect(result).toMatchObject({ status: 'FAILED', subscriptionsSeen: 2, invoicesSkipped: 1, errorCount: 1 });
    expect(result.errorMessage).toContain('sub_1: Invalid subscription period');
    expect(prisma.subscriptions.get('sub_2').nextBillingDate.toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('records a catch-up limit instead of looping without bound', async () => {
    const prisma = makePrisma([dueSubscription]);
    const invoiceGenerator = jest.fn(async (_db, _subscriptionId, periodStart) => ({ invoice: { periodStart }, created: true }));
    const result = await runBilling(prisma, {
      now: new Date('2026-01-02T00:00:00Z'),
      maxPeriodsPerSubscription: 1,
      invoiceGenerator,
    });
    expect(invoiceGenerator).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'FAILED', invoicesCreated: 1, errorCount: 1 });
    expect(result.errorMessage).toContain('catch-up limit reached');
  });
});
