/**
 * Outstanding and Overdue Query Helpers — Milestone M4-3
 *
 * Definitions:
 *  - Outstanding: any invoice that is CONFIRMED (not yet fully paid)
 *  - Overdue:     a CONFIRMED invoice whose dueDate < now (past due and unpaid)
 */

/**
 * Returns a Prisma `where` clause for all outstanding (unpaid CONFIRMED) invoices.
 * Optionally scoped to a single customer.
 *
 * @param {object} [options]
 * @param {string} [options.customerId]
 * @returns {object} Prisma where clause
 */
export function buildOutstandingWhere({ customerId } = {}) {
  const where = { status: 'CONFIRMED' };
  if (customerId) {
    where.customerId = customerId;
  }
  return where;
}

/**
 * Returns a Prisma `where` clause for all overdue invoices:
 * CONFIRMED invoices whose dueDate is strictly before the reference date.
 *
 * @param {object} [options]
 * @param {Date}   [options.asOf]        - Reference date (defaults to now)
 * @param {string} [options.customerId]  - Scope to one customer
 * @returns {object} Prisma where clause
 */
export function buildOverdueWhere({ asOf, customerId } = {}) {
  const referenceDate = asOf instanceof Date ? asOf : new Date();
  const where = {
    status: 'CONFIRMED',
    dueDate: { lt: referenceDate },
  };
  if (customerId) {
    where.customerId = customerId;
  }
  return where;
}

/**
 * Computes aggregated outstanding summary for a set of invoices.
 * Returns total outstanding amount and count of invoices.
 *
 * @param {{ total: number; amountPaid: number }[]} invoices
 * @returns {{ totalOutstanding: number; invoiceCount: number }}
 */
export function aggregateOutstanding(invoices) {
  let totalOutstanding = 0;
  for (const inv of invoices) {
    totalOutstanding += (inv.total ?? 0) - (inv.amountPaid ?? 0);
  }
  return { totalOutstanding, invoiceCount: invoices.length };
}

/**
 * Fetches paginated outstanding invoices with optional customer filter.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} options
 * @param {string} [options.customerId]
 * @param {{ page: number; limit: number; skip: number }} [options.pagination]
 * @returns {Promise<{ data: object[]; page: number; limit: number; total: number; summary: object }>}
 */
export async function getOutstandingInvoices(prisma, { customerId, pagination = { page: 1, limit: 20, skip: 0 } } = {}) {
  const where = buildOutstandingWhere({ customerId });

  const [total, data] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        number: true,
        customerId: true,
        status: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        issueDate: true,
        subscriptionId: true,
      },
    }),
  ]);

  const summary = aggregateOutstanding(data);

  return {
    data: data.map((inv) => ({
      ...inv,
      remainingBalance: inv.total - (inv.amountPaid ?? 0),
    })),
    page: pagination.page,
    limit: pagination.limit,
    total,
    summary,
  };
}

/**
 * Fetches paginated overdue invoices with optional customer filter and asOf date.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} options
 * @param {Date}   [options.asOf]
 * @param {string} [options.customerId]
 * @param {{ page: number; limit: number; skip: number }} [options.pagination]
 * @returns {Promise<{ data: object[]; page: number; limit: number; total: number; summary: object }>}
 */
export async function getOverdueInvoices(prisma, { asOf, customerId, pagination = { page: 1, limit: 20, skip: 0 } } = {}) {
  const referenceDate = asOf instanceof Date ? asOf : new Date();
  const where = buildOverdueWhere({ asOf: referenceDate, customerId });

  const [total, data] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        number: true,
        customerId: true,
        status: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        issueDate: true,
        subscriptionId: true,
      },
    }),
  ]);

  const summary = aggregateOutstanding(data);

  return {
    data: data.map((inv) => {
      const daysOverdue = Math.floor(
        (referenceDate.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...inv,
        remainingBalance: inv.total - (inv.amountPaid ?? 0),
        daysOverdue,
      };
    }),
    page: pagination.page,
    limit: pagination.limit,
    total,
    summary,
  };
}
