import cron from 'node-cron';
import { runBilling } from '../modules/billing/billingRun.js';

export function startBillingScheduler({
  prisma,
  cronExpression = process.env.BILLING_CRON,
  schedule = cron.schedule,
  run = runBilling,
  onError = (error) => console.error('Scheduled billing run failed:', error),
} = {}) {
  if (!cronExpression) return null;
  if (!cron.validate(cronExpression)) throw new TypeError('BILLING_CRON must be a valid cron expression');
  if (!prisma) throw new TypeError('A Prisma client is required to start scheduled billing');

  return schedule(cronExpression, async () => {
    try {
      await run(prisma);
    } catch (error) {
      onError(error);
    }
  });
}
