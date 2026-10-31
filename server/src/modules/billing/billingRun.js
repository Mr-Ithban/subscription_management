import { generateInvoiceForPeriod, nextPeriodStart } from './invoiceGeneration.js';

const DEFAULT_MAX_PERIODS_PER_SUBSCRIPTION = 120;

function utcDayStart(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Runs all currently due periods for active subscriptions, preserving catch-up and retry safety. */
export async function runBilling(prisma, {
  now = new Date(),
  maxPeriodsPerSubscription = DEFAULT_MAX_PERIODS_PER_SUBSCRIPTION,
  invoiceGenerator = generateInvoiceForPeriod,
} = {}) {
  const run = await prisma.billingRun.create({ data: { status: 'RUNNING' } });
  const today = utcDayStart(now);
  let subscriptionsSeen = 0;
  let invoicesCreated = 0;
  let invoicesSkipped = 0;
  let errorCount = 0;
  const errors = [];

  try {
    const dueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { nextBillingDate: { lte: today } },
          { nextBillingDate: null, startDate: { lte: today } },
        ],
      },
      select: { id: true, startDate: true, nextBillingDate: true, plan: { select: { billingPeriod: true } } },
      orderBy: [{ nextBillingDate: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
    });
    subscriptionsSeen = dueSubscriptions.length;

    for (const subscription of dueSubscriptions) {
      let periodStart = utcDayStart(subscription.nextBillingDate ?? subscription.startDate);
      let expectedStoredNextDate = subscription.nextBillingDate;
      let processed = 0;

      while (periodStart <= today && processed < maxPeriodsPerSubscription) {
        try {
          const result = await invoiceGenerator(prisma, subscription.id, periodStart, { now });
          const nextDate = nextPeriodStart(periodStart, subscription.plan.billingPeriod);
          const advanced = await prisma.subscription.updateMany({
            where: { id: subscription.id, status: 'ACTIVE', nextBillingDate: expectedStoredNextDate },
            data: { nextBillingDate: nextDate },
          });
          if (advanced.count !== 1) break;

          if (result.created) invoicesCreated += 1;
          else invoicesSkipped += 1;
          expectedStoredNextDate = nextDate;
          periodStart = nextDate;
          processed += 1;
        } catch (error) {
          errorCount += 1;
          errors.push(`${subscription.id}: ${error.message}`);
          break;
        }
      }

      if (periodStart <= today && processed >= maxPeriodsPerSubscription) {
        errorCount += 1;
        errors.push(`${subscription.id}: catch-up limit reached (${maxPeriodsPerSubscription} periods)`);
      }
    }

    return await prisma.billingRun.update({
      where: { id: run.id },
      data: {
        status: errorCount ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(now),
        subscriptionsSeen,
        invoicesCreated,
        invoicesSkipped,
        errorCount,
        errorMessage: errors.length ? errors.slice(0, 10).join('; ').slice(0, 2000) : null,
      },
    });
  } catch (error) {
    await prisma.billingRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(now),
        subscriptionsSeen,
        invoicesCreated,
        invoicesSkipped,
        errorCount: errorCount + 1,
        errorMessage: String(error.message).slice(0, 2000),
      },
    });
    throw error;
  }
}

