import { jest } from '@jest/globals';
import { autoClosePlans } from './autoClosePlans.js';
import { autoCloseJob, stopJobs, startJobs } from './index.js';

describe('Job: autoClosePlans', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = {
      plan: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
  });

  afterAll(() => {
    // Ensure cron task is stopped so Jest exits cleanly
    stopJobs();
  });

  it('updates ACTIVE plans with autoClose=true whose endDate has passed to CLOSED', async () => {
    const testDate = new Date('2024-06-15T12:00:00.000Z');
    const result = await autoClosePlans(testDate, mockPrisma);

    expect(result).toEqual({ count: 2 });
    expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        autoClose: true,
        endDate: {
          not: null,
          lt: testDate,
        },
      },
      data: {
        status: 'CLOSED',
      },
    });
  });

  it('accepts date string format for today', async () => {
    await autoClosePlans('2024-12-31', mockPrisma);

    expect(mockPrisma.plan.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        autoClose: true,
        endDate: {
          not: null,
          lt: new Date('2024-12-31'),
        },
      },
      data: {
        status: 'CLOSED',
      },
    });
  });

  it('uses current date as default when today is omitted', async () => {
    const beforeCall = new Date();
    await autoClosePlans(undefined, mockPrisma);
    const afterCall = new Date();

    const callArgs = mockPrisma.plan.updateMany.mock.calls[0][0];
    const queriedDate = callArgs.where.endDate.lt;

    expect(queriedDate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(queriedDate.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });

  it('throws error when invalid date is provided', async () => {
    await expect(autoClosePlans('invalid-date', mockPrisma)).rejects.toThrow(
      'Invalid today date provided to autoClosePlans'
    );
  });
});

describe('Jobs Registration in src/jobs/index.js', () => {
  afterAll(() => {
    stopJobs();
  });

  it('registers autoCloseJob with node-cron schedule', () => {
    expect(autoCloseJob).toBeDefined();
    expect(typeof autoCloseJob.stop).toBe('function');
    expect(typeof autoCloseJob.start).toBe('function');
  });

  it('allows startJobs and stopJobs to be called safely', () => {
    expect(() => startJobs()).not.toThrow();
    expect(() => stopJobs()).not.toThrow();
  });
});
