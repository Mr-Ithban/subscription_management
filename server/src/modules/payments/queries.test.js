import { jest } from '@jest/globals';
import {
  buildOutstandingWhere,
  buildOverdueWhere,
  aggregateOutstanding,
  getOutstandingInvoices,
  getOverdueInvoices,
} from './queries.js';

describe('M4-3 Outstanding & Overdue Query Helpers', () => {
  // ============================================================
  // Pure helper: buildOutstandingWhere
  // ============================================================
  describe('buildOutstandingWhere', () => {
    it('returns { status: CONFIRMED } with no options', () => {
      expect(buildOutstandingWhere()).toEqual({ status: 'CONFIRMED' });
    });

    it('adds customerId when provided', () => {
      expect(buildOutstandingWhere({ customerId: 'cust-1' })).toEqual({
        status: 'CONFIRMED',
        customerId: 'cust-1',
      });
    });

    it('omits customerId when undefined', () => {
      const where = buildOutstandingWhere({ customerId: undefined });
      expect(where).not.toHaveProperty('customerId');
    });
  });

  // ============================================================
  // Pure helper: buildOverdueWhere
  // ============================================================
  describe('buildOverdueWhere', () => {
    it('returns CONFIRMED + dueDate lt now with no options', () => {
      const before = new Date();
      const where = buildOverdueWhere();
      const after = new Date();

      expect(where.status).toBe('CONFIRMED');
      expect(where.dueDate.lt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(where.dueDate.lt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('uses the provided asOf date', () => {
      const asOf = new Date('2026-10-01T00:00:00Z');
      const where = buildOverdueWhere({ asOf });
      expect(where.dueDate.lt).toEqual(asOf);
    });

    it('adds customerId when provided', () => {
      const asOf = new Date('2026-10-01T00:00:00Z');
      const where = buildOverdueWhere({ asOf, customerId: 'cust-2' });
      expect(where.customerId).toBe('cust-2');
    });

    it('falls back to new Date() when asOf is not a Date instance', () => {
      const before = new Date();
      const where = buildOverdueWhere({ asOf: 'not-a-date' });
      const after = new Date();
      expect(where.dueDate.lt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(where.dueDate.lt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ============================================================
  // Pure helper: aggregateOutstanding
  // ============================================================
  describe('aggregateOutstanding', () => {
    it('sums remaining balances across invoices', () => {
      const invoices = [
        { total: 10000, amountPaid: 3000 },
        { total: 5000, amountPaid: 0 },
        { total: 2000, amountPaid: 2000 },
      ];
      const { totalOutstanding, invoiceCount } = aggregateOutstanding(invoices);
      expect(totalOutstanding).toBe(12000); // 7000 + 5000 + 0
      expect(invoiceCount).toBe(3);
    });

    it('treats missing amountPaid as 0', () => {
      const invoices = [{ total: 8000 }, { total: 4000, amountPaid: null }];
      const { totalOutstanding } = aggregateOutstanding(invoices);
      expect(totalOutstanding).toBe(12000);
    });

    it('returns 0 for empty array', () => {
      const { totalOutstanding, invoiceCount } = aggregateOutstanding([]);
      expect(totalOutstanding).toBe(0);
      expect(invoiceCount).toBe(0);
    });
  });

  // ============================================================
  // Prisma-dependent: getOutstandingInvoices
  // ============================================================
  describe('getOutstandingInvoices', () => {
    let mockPrisma;

    beforeEach(() => {
      mockPrisma = {
        invoice: {
          count: jest.fn(),
          findMany: jest.fn(),
        },
      };
    });

    it('queries with status CONFIRMED and returns paginated data with summary', async () => {
      const fakeInvoices = [
        { id: 'i1', number: 'INV-001', total: 10000, amountPaid: 2000, dueDate: new Date('2026-12-01'), status: 'CONFIRMED', customerId: 'c1', issueDate: new Date(), subscriptionId: 's1' },
        { id: 'i2', number: 'INV-002', total: 5000, amountPaid: 0, dueDate: new Date('2026-12-15'), status: 'CONFIRMED', customerId: 'c1', issueDate: new Date(), subscriptionId: 's2' },
      ];
      mockPrisma.invoice.count.mockResolvedValueOnce(2);
      mockPrisma.invoice.findMany.mockResolvedValueOnce(fakeInvoices);

      const result = await getOutstandingInvoices(mockPrisma, {
        pagination: { page: 1, limit: 20, skip: 0 },
      });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].remainingBalance).toBe(8000);
      expect(result.data[1].remainingBalance).toBe(5000);
      expect(result.summary.totalOutstanding).toBe(13000);
      expect(result.summary.invoiceCount).toBe(2);

      expect(mockPrisma.invoice.count).toHaveBeenCalledWith({ where: { status: 'CONFIRMED' } });
    });

    it('scopes query by customerId when provided', async () => {
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.invoice.findMany.mockResolvedValueOnce([]);

      await getOutstandingInvoices(mockPrisma, { customerId: 'cust-99' });

      expect(mockPrisma.invoice.count).toHaveBeenCalledWith({
        where: { status: 'CONFIRMED', customerId: 'cust-99' },
      });
    });
  });

  // ============================================================
  // Prisma-dependent: getOverdueInvoices
  // ============================================================
  describe('getOverdueInvoices', () => {
    let mockPrisma;

    beforeEach(() => {
      mockPrisma = {
        invoice: {
          count: jest.fn(),
          findMany: jest.fn(),
        },
      };
    });

    it('queries with status CONFIRMED and dueDate lt asOf', async () => {
      const asOf = new Date('2026-11-01T00:00:00Z');
      const pastDue = new Date('2026-10-15T00:00:00Z');
      const fakeInvoices = [
        { id: 'i3', number: 'INV-003', total: 8000, amountPaid: 0, dueDate: pastDue, status: 'CONFIRMED', customerId: 'c2', issueDate: new Date(), subscriptionId: 's3' },
      ];
      mockPrisma.invoice.count.mockResolvedValueOnce(1);
      mockPrisma.invoice.findMany.mockResolvedValueOnce(fakeInvoices);

      const result = await getOverdueInvoices(mockPrisma, {
        asOf,
        pagination: { page: 1, limit: 20, skip: 0 },
      });

      expect(result.total).toBe(1);
      expect(result.data[0].remainingBalance).toBe(8000);
      expect(result.data[0].daysOverdue).toBe(17); // Nov 1 - Oct 15 = 17 days
      expect(result.summary.totalOutstanding).toBe(8000);

      expect(mockPrisma.invoice.count).toHaveBeenCalledWith({
        where: { status: 'CONFIRMED', dueDate: { lt: asOf } },
      });
    });

    it('computes daysOverdue correctly for multiple invoices', async () => {
      const asOf = new Date('2026-11-10T00:00:00Z');
      const fakeInvoices = [
        { id: 'i4', number: 'INV-004', total: 3000, amountPaid: 0, dueDate: new Date('2026-11-01T00:00:00Z'), status: 'CONFIRMED', customerId: 'c3', issueDate: new Date(), subscriptionId: 's4' },
        { id: 'i5', number: 'INV-005', total: 7000, amountPaid: 1000, dueDate: new Date('2026-10-20T00:00:00Z'), status: 'CONFIRMED', customerId: 'c3', issueDate: new Date(), subscriptionId: 's5' },
      ];
      mockPrisma.invoice.count.mockResolvedValueOnce(2);
      mockPrisma.invoice.findMany.mockResolvedValueOnce(fakeInvoices);

      const result = await getOverdueInvoices(mockPrisma, { asOf, pagination: { page: 1, limit: 20, skip: 0 } });

      expect(result.data[0].daysOverdue).toBe(9);  // Nov 10 - Nov 1 = 9
      expect(result.data[1].daysOverdue).toBe(21); // Nov 10 - Oct 20 = 21
      expect(result.summary.totalOutstanding).toBe(9000); // 3000 + 6000
    });

    it('returns empty data with zero summary when no overdue invoices', async () => {
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.invoice.findMany.mockResolvedValueOnce([]);

      const result = await getOverdueInvoices(mockPrisma, { asOf: new Date() });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
      expect(result.summary.totalOutstanding).toBe(0);
    });
  });
});
