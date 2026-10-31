import { jest } from '@jest/globals';
import { startBillingScheduler } from './billingScheduler.js';

describe('billing scheduler', () => {
  it('does not schedule a job when BILLING_CRON is unset', () => {
    const schedule = jest.fn();
    expect(startBillingScheduler({ prisma: {}, cronExpression: '', schedule })).toBeNull();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules the configured expression and runs billing with the shared client', async () => {
    const prisma = {};
    const run = jest.fn(async () => ({ status: 'COMPLETED' }));
    let scheduledCallback;
    const schedule = jest.fn((expression, callback) => {
      scheduledCallback = callback;
      return { expression };
    });

    const task = startBillingScheduler({ prisma, cronExpression: '0 2 * * *', schedule, run });
    await scheduledCallback();

    expect(task).toEqual({ expression: '0 2 * * *' });
    expect(schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
    expect(run).toHaveBeenCalledWith(prisma);
  });

  it('reports failures without crashing the scheduler callback', async () => {
    const failure = new Error('database unavailable');
    const run = jest.fn(async () => { throw failure; });
    const onError = jest.fn();
    let scheduledCallback;
    startBillingScheduler({
      prisma: {}, cronExpression: '0 2 * * *', run, onError,
      schedule: (_expression, callback) => { scheduledCallback = callback; return {}; },
    });

    await expect(scheduledCallback()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('rejects an invalid cron expression', () => {
    expect(() => startBillingScheduler({ prisma: {}, cronExpression: 'not a cron' }))
      .toThrow('BILLING_CRON must be a valid cron expression');
  });
});
