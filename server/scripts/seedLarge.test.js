import { jest } from '@jest/globals';
import {
  createRng,
  chunk,
  randomInt,
  pick,
  dateBetween,
  makeId,
  seedLarge,
} from '../prisma/seedLarge.js';
import { runBenchmark, SLA_THRESHOLD_MS } from './benchmark.js';

describe('Milestone M4-6 Large Seed & Benchmark Utilities', () => {
  describe('Deterministic PRNG & Array Helpers', () => {
    it('produces repeatable sequences with fixed seed', () => {
      const rng1 = createRng(100);
      const rng2 = createRng(100);

      const seq1 = [rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it('chunks arrays into specified batch sizes', () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const batches = chunk(items, 10);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(10);
      expect(batches[1]).toHaveLength(10);
      expect(batches[2]).toHaveLength(5);
    });

    it('generates integer within range', () => {
      const rng = createRng(42);
      for (let i = 0; i < 50; i++) {
        const val = randomInt(5, 15, rng);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(15);
      }
    });

    it('generates date within bounds', () => {
      const rng = createRng(42);
      const start = new Date('2026-01-01');
      const end = new Date('2026-02-01');
      const d = dateBetween(start, end, rng);

      expect(d.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(end.getTime());
    });

    it('picks element from array', () => {
      const rng = createRng(42);
      const arr = ['A', 'B', 'C'];
      const chosen = pick(arr, rng);
      expect(arr).toContain(chosen);
    });

    it('generates structured IDs with makeId', () => {
      expect(makeId('usr', 1)).toBe('usr_00000001');
      expect(makeId('cust', 42)).toBe('cust_00000042');
    });
  });

  describe('seedLarge execution with mock Prisma', () => {
    let mockPrisma;

    beforeEach(() => {
      mockPrisma = {
        tax: {
          findFirst: jest.fn().mockResolvedValue({ id: 'tax-1', rate: 18 }),
          create: jest.fn(),
        },
        product: {
          findFirst: jest.fn().mockResolvedValue({ id: 'prod-1', salesPrice: 5000 }),
          create: jest.fn(),
        },
        plan: {
          findFirst: jest.fn().mockResolvedValue({ id: 'plan-1', price: 5000, billingPeriod: 'MONTHLY' }),
          create: jest.fn(),
        },
        user: { createMany: jest.fn().mockResolvedValue({ count: 10 }) },
        customer: { createMany: jest.fn().mockResolvedValue({ count: 10 }) },
        subscription: { createMany: jest.fn().mockResolvedValue({ count: 15 }) },
        subscriptionLine: { createMany: jest.fn().mockResolvedValue({ count: 20 }) },
        invoice: { createMany: jest.fn().mockResolvedValue({ count: 25 }) },
        invoiceLine: { createMany: jest.fn().mockResolvedValue({ count: 25 }) },
        payment: { createMany: jest.fn().mockResolvedValue({ count: 15 }) },
      };
    });

    it('successfully generates and batch-inserts small test counts', async () => {
      const summary = await seedLarge(mockPrisma, {
        customers: 10,
        subscriptions: 15,
        invoices: 25,
        payments: 15,
        seed: 999,
      });

      expect(summary.customersCount).toBe(10);
      expect(summary.subscriptionsCount).toBe(15);
      expect(summary.invoicesCount).toBe(25);
      expect(mockPrisma.customer.createMany).toHaveBeenCalled();
      expect(mockPrisma.subscription.createMany).toHaveBeenCalled();
      expect(mockPrisma.invoice.createMany).toHaveBeenCalled();
    });
  });

  describe('runBenchmark SLA verification', () => {
    it('executes benchmark and verifies responses under 2000ms', async () => {
      const requestFn = jest.fn().mockResolvedValue({ status: 200 });
      const result = await runBenchmark({ slaMs: SLA_THRESHOLD_MS, token: 'test-token', requestFn });
      expect(result.results.length).toBeGreaterThan(0);
      for (const r of result.results) {
        expect(r.durationMs).toBeLessThan(SLA_THRESHOLD_MS);
        expect(r.status).toBe(200);
        expect(r.passed).toBe(true);
      }
      expect(requestFn).toHaveBeenCalledTimes(result.results.length);
    });

    it('fails when an endpoint rejects the benchmark token', async () => {
      const requestFn = jest.fn().mockResolvedValue({ status: 401 });
      const result = await runBenchmark({ token: 'invalid-token', requestFn });
      expect(result.passed).toBe(false);
      expect(result.results.every((r) => r.error === 'HTTP 401' && !r.passed)).toBe(true);
    });
  });
});
