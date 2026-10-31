import {
  getFinanceSummary,
  getRevenueBreakdown,
  getSubscriptionsReport,
  getOverdueReport,
} from './service.js';

export function createReportsController(prisma) {
  return {
    getSummary: async (req, res, next) => {
      try {
        const result = await getFinanceSummary(prisma, {
          from: req.query.from,
          to: req.query.to,
          skipCache: req.query.skipCache,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getRevenue: async (req, res, next) => {
      try {
        const result = await getRevenueBreakdown(prisma, {
          from: req.query.from,
          to: req.query.to,
          groupBy: req.query.groupBy,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getSubscriptions: async (req, res, next) => {
      try {
        const result = await getSubscriptionsReport(prisma, {
          filters: req.query,
          pagination: req.pagination,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getOverdue: async (req, res, next) => {
      try {
        const result = await getOverdueReport(prisma, {
          customerId: req.query.customerId,
          asOf: req.query.asOf,
          pagination: req.pagination,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}
