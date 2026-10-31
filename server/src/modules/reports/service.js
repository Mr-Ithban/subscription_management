/**
 * Finance Reports Service — Milestone M4-4
 *
 * Provides aggregated finance reports:
 *  1. Summary       — active subscriptions, status counts, revenue, invoiced total,
 *                     outstanding total, overdue count/amount, and MRR. Cached for 30s.
 *  2. Revenue       — breakdown of payments grouped by day, week, or month.
 *  3. Subscriptions — filtered, paginated list of subscriptions.
 *  4. Overdue       — filtered, paginated list of overdue invoices with days overdue.
 *
 * All monetary values are integers (smallest unit, e.g. paise / cents).
 * Uses DB aggregation (count, sum, groupBy) to avoid loading all records into memory.
 */

import { getOverdueInvoices } from '../payments/queries.js';
import { buildPaginatedResponse } from '../../utils/pagination.js';

// ---------------------------------------------------------------------------
// 30-Second In-Memory Summary Cache
// ---------------------------------------------------------------------------
const SUMMARY_CACHE_TTL_MS = 30 * 1000;
const summaryCache = new Map();

export function clearSummaryCache() {
  summaryCache.clear();
}

function getCacheKey({ from, to }) {
  const f = from instanceof Date ? from.toISOString() : (from ?? '');
  const t = to instanceof Date ? to.toISOString() : (to ?? '');
  return `${f}:${t}`;
}

/**
 * Validates and parses an optional date.
 *
 * @param {string | Date | undefined} value
 * @param {string} fieldName
 * @returns {Date | undefined}
 */
function parseDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    throw Object.assign(new Error(`Invalid ${fieldName} date`), { statusCode: 400 });
  }
  return d;
}

/**
 * Normalisation multiplier for plan billing period to monthly MRR equivalent.
 */
export const PERIOD_MULTIPLIER = {
  DAILY: 30,
  WEEKLY: 4.33,
  MONTHLY: 1,
  YEARLY: 1 / 12,
};

/**
 * 1. Finance Summary Report
 * Aggregates:
 *  - activeSubscriptionCount: count of ACTIVE subscriptions
 *  - subscriptionsByStatus: counts grouped by status (DRAFT, QUOTATION, CONFIRMED, ACTIVE, CLOSED)
 *  - revenue: sum of payments with paidAt in range
 *  - invoicedTotal: sum of invoice totals in range
 *  - outstandingTotal: sum of (total - amountPaid) on CONFIRMED invoices
 *  - overdueCount & overdueAmount: count and sum of balance on CONFIRMED invoices past dueDate
 *  - mrr: estimated Monthly Recurring Revenue from ACTIVE subscriptions
 *
 * Cached in memory for 30 seconds.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} [options]
 * @param {string | Date} [options.from]
 * @param {string | Date} [options.to]
 * @param {boolean} [options.skipCache]
 * @returns {Promise<object>}
 */
export async function getFinanceSummary(prisma, { from, to, skipCache = false } = {}) {
  const fromDate = parseDate(from, 'from');
  const toDate = parseDate(to, 'to');

  const cacheKey = getCacheKey({ from: fromDate, to: toDate });
  if (!skipCache) {
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SUMMARY_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const now = new Date();

  // Date filters
  const dateFilter = {};
  if (fromDate) dateFilter.gte = fromDate;
  if (toDate) dateFilter.lte = toDate;
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const paymentDateWhere = hasDateFilter ? { paidAt: dateFilter } : {};
  const invoiceDateWhere = hasDateFilter ? { issueDate: dateFilter } : {};

  // Check if aggregate & groupBy methods exist on mock / prisma
  const canAggregate =
    typeof prisma.subscription?.count === 'function' &&
    typeof prisma.subscription?.groupBy === 'function' &&
    typeof prisma.payment?.aggregate === 'function' &&
    typeof prisma.invoice?.aggregate === 'function';

  let activeSubscriptionCount = 0;
  let subscriptionsByStatus = {
    DRAFT: 0,
    QUOTATION: 0,
    CONFIRMED: 0,
    ACTIVE: 0,
    CLOSED: 0,
  };
  let revenue = 0;
  let invoicedTotal = 0;
  let outstandingTotal = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let mrr = 0;

  if (canAggregate) {
    // 1. Subscription active count & status breakdown via DB grouping
    const [activeCount, statusGroups, activePlanGroups] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);

    activeSubscriptionCount = activeCount;
    for (const group of statusGroups) {
      const count = group._count?._all ?? group._count ?? 0;
      subscriptionsByStatus[group.status] = count;
    }

    // Compute MRR from active plan counts without loading subscriptions
    if (activePlanGroups.length > 0 && typeof prisma.plan?.findMany === 'function') {
      const planIds = activePlanGroups.map((g) => g.planId).filter(Boolean);
      const plans = await prisma.plan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, price: true, billingPeriod: true },
      });
      const planLookup = new Map(plans.map((p) => [p.id, p]));

      for (const group of activePlanGroups) {
        const plan = planLookup.get(group.planId);
        if (plan) {
          const mult = PERIOD_MULTIPLIER[plan.billingPeriod] ?? 1;
          const monthly = Math.round(plan.price * mult);
          const count = group._count?._all ?? group._count ?? 0;
          mrr += monthly * count;
        }
      }
    }

    // 2. Revenue aggregation
    const paymentAgg = await prisma.payment.aggregate({
      where: paymentDateWhere,
      _sum: { amount: true },
    });
    revenue = paymentAgg._sum?.amount ?? 0;

    // 3. Invoiced total aggregation
    const invoiceAgg = await prisma.invoice.aggregate({
      where: invoiceDateWhere,
      _sum: { total: true },
    });
    invoicedTotal = invoiceAgg._sum?.total ?? 0;

    // 4. Outstanding & overdue on CONFIRMED invoices
    const [confirmedAgg, overdueAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { total: true, amountPaid: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: 'CONFIRMED',
          dueDate: { lt: now },
        },
        _count: { _all: true },
        _sum: { total: true, amountPaid: true },
      }),
    ]);

    const confTotal = confirmedAgg._sum?.total ?? 0;
    const confPaid = confirmedAgg._sum?.amountPaid ?? 0;
    outstandingTotal = Math.max(0, confTotal - confPaid);

    overdueCount = overdueAgg._count?._all ?? overdueAgg._count ?? 0;
    const overTotal = overdueAgg._sum?.total ?? 0;
    const overPaid = overdueAgg._sum?.amountPaid ?? 0;
    overdueAmount = Math.max(0, overTotal - overPaid);
  } else {
    // Fallback in case of simplified mocks in legacy unit tests
    if (typeof prisma.invoice?.findMany === 'function') {
      const invoices = await prisma.invoice.findMany({
        where: invoiceDateWhere,
        select: { status: true, total: true, amountPaid: true, dueDate: true },
      });
      for (const inv of invoices) {
        invoicedTotal += inv.total ?? 0;
        if (inv.status === 'CONFIRMED') {
          const remaining = (inv.total ?? 0) - (inv.amountPaid ?? 0);
          outstandingTotal += remaining;
          if (new Date(inv.dueDate) < now) {
            overdueCount += 1;
            overdueAmount += remaining;
          }
        }
      }
    }

    if (typeof prisma.subscription?.findMany === 'function') {
      const subs = await prisma.subscription.findMany({
        select: { status: true, plan: { select: { price: true, billingPeriod: true } } },
      });
      for (const sub of subs) {
        subscriptionsByStatus[sub.status] = (subscriptionsByStatus[sub.status] ?? 0) + 1;
        if (sub.status === 'ACTIVE') {
          activeSubscriptionCount += 1;
          if (sub.plan) {
            const mult = PERIOD_MULTIPLIER[sub.plan.billingPeriod] ?? 1;
            mrr += Math.round(sub.plan.price * mult);
          }
        }
      }
    }

    if (typeof prisma.payment?.findMany === 'function') {
      const payments = await prisma.payment.findMany({
        where: paymentDateWhere,
        select: { amount: true },
      });
      revenue = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    }
  }

  const result = {
    period: {
      from: fromDate?.toISOString() ?? null,
      to: toDate?.toISOString() ?? null,
    },
    activeSubscriptionCount,
    subscriptionsByStatus,
    revenue,
    invoicedTotal,
    outstandingTotal,
    overdueCount,
    overdueAmount,
    mrr,
    // Backwards-compatible aliases
    totalInvoiced: invoicedTotal,
    totalCollected: revenue,
    totalOutstanding: outstandingTotal,
    totalOverdue: overdueAmount,
    invoiceCounts: subscriptionsByStatus,
  };

  summaryCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}

/**
 * Helper to compute ISO week string (e.g. '2026-W44')
 *
 * @param {Date} date
 * @returns {string}
 */
export function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * 2. Revenue Breakdown Report
 * Groups payments by period: day (YYYY-MM-DD), week (YYYY-Www), or month (YYYY-MM).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} [options]
 * @param {string | Date} [options.from]
 * @param {string | Date} [options.to]
 * @param {'day' | 'week' | 'month'} [options.groupBy='month']
 * @returns {Promise<object>}
 */
export async function getRevenueBreakdown(prisma, { from, to, groupBy = 'month' } = {}) {
  const fromDate = parseDate(from, 'from');
  const toDate = parseDate(to, 'to');

  if (groupBy !== 'day' && groupBy !== 'week' && groupBy !== 'month') {
    throw Object.assign(new Error("groupBy must be 'day', 'week', or 'month'"), { statusCode: 400 });
  }

  const paidAtFilter = {};
  if (fromDate) paidAtFilter.gte = fromDate;
  if (toDate) paidAtFilter.lte = toDate;

  const payments = await prisma.payment.findMany({
    where: Object.keys(paidAtFilter).length ? { paidAt: paidAtFilter } : {},
    select: { amount: true, paidAt: true },
    orderBy: { paidAt: 'asc' },
  });

  const grouped = {};
  for (const payment of payments) {
    const d = new Date(payment.paidAt);
    let key;
    if (groupBy === 'day') {
      key = d.toISOString().slice(0, 10);
    } else if (groupBy === 'week') {
      key = getISOWeekString(d);
    } else {
      key = d.toISOString().slice(0, 7);
    }

    if (!grouped[key]) {
      grouped[key] = { period: key, revenue: 0, paymentCount: 0 };
    }
    grouped[key].revenue += payment.amount ?? 0;
    grouped[key].paymentCount += 1;
  }

  const breakdown = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
  const totalRevenue = breakdown.reduce((sum, row) => sum + row.revenue, 0);

  return {
    groupBy,
    period: {
      from: fromDate?.toISOString() ?? null,
      to: toDate?.toISOString() ?? null,
    },
    totalRevenue,
    breakdown,
  };
}

/**
 * 3. Subscriptions Report
 * Filtered, paginated list of subscriptions.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} options
 * @param {object} [options.filters]
 * @param {string} [options.filters.status]
 * @param {string} [options.filters.planId]
 * @param {string} [options.filters.customerId]
 * @param {string} [options.filters.search]
 * @param {{ page: number; limit: number; skip: number }} [options.pagination]
 * @returns {Promise<object>}
 */
export async function getSubscriptionsReport(
  prisma,
  { filters = {}, pagination = { page: 1, limit: 20, skip: 0 } } = {}
) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.planId) where.planId = filters.planId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.search) {
    where.OR = [
      { number: { contains: filters.search, mode: 'insensitive' } },
      { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
      { plan: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        startDate: true,
        expiryDate: true,
        nextBillingDate: true,
        customerId: true,
        planId: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            billingPeriod: true,
          },
        },
      },
    }),
  ]);

  return buildPaginatedResponse(data, {
    page: pagination.page,
    limit: pagination.limit,
    total,
  });
}

/**
 * 4. Overdue Invoices Report
 * Filtered, paginated overdue invoices with days overdue and balance.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} options
 * @param {string} [options.customerId]
 * @param {string | Date} [options.asOf]
 * @param {{ page: number; limit: number; skip: number }} [options.pagination]
 * @returns {Promise<object>}
 */
export async function getOverdueReport(
  prisma,
  { customerId, asOf, pagination = { page: 1, limit: 20, skip: 0 } } = {}
) {
  const referenceDate = asOf ? parseDate(asOf, 'asOf') : new Date();
  return getOverdueInvoices(prisma, {
    customerId,
    asOf: referenceDate,
    pagination,
  });
}

/**
 * 5. Backwards-compatible getMRR helper
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<{ mrr: number; activeSubscriptions: number; breakdown: object[] }>}
 */
export async function getMRR(prisma) {
  const activeSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      planId: true,
      plan: {
        select: {
          id: true,
          name: true,
          price: true,
          billingPeriod: true,
        },
      },
    },
  });

  const planMap = {};
  let mrr = 0;

  for (const sub of activeSubs) {
    const plan = sub.plan;
    if (!plan) continue;

    const multiplier = PERIOD_MULTIPLIER[plan.billingPeriod] ?? 1;
    const monthlyValue = Math.round(plan.price * multiplier);
    mrr += monthlyValue;

    if (!planMap[plan.id]) {
      planMap[plan.id] = {
        planId: plan.id,
        planName: plan.name,
        billingPeriod: plan.billingPeriod,
        pricePerPeriod: plan.price,
        monthlyEquivalent: monthlyValue,
        subscriptionCount: 0,
        planMrr: 0,
      };
    }
    planMap[plan.id].subscriptionCount += 1;
    planMap[plan.id].planMrr += monthlyValue;
  }

  const breakdown = Object.values(planMap).sort((a, b) => b.planMrr - a.planMrr);

  return {
    mrr,
    activeSubscriptions: activeSubs.length,
    breakdown,
  };
}
