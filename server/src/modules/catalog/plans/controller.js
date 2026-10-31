import {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  CatalogError,
} from './service.js';

export function createPlansController(prisma) {
  return {
    list: async (req, res, next) => {
      try {
        const result = await listPlans(prisma, {
          pagination: req.pagination,
          status: req.query.status,
          availableOn: req.query.availableOn,
          search: req.query.search,
        });
        return res.status(200).json(result);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    getById: async (req, res, next) => {
      try {
        const plan = await getPlanById(prisma, req.params.id);
        return res.status(200).json(plan);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    create: async (req, res, next) => {
      try {
        const plan = await createPlan(prisma, req.body);
        return res.status(201).json(plan);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    update: async (req, res, next) => {
      try {
        const plan = await updatePlan(prisma, req.params.id, req.body);
        return res.status(200).json(plan);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    delete: async (req, res, next) => {
      try {
        const result = await deletePlan(prisma, req.params.id);
        return res.status(200).json(result);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },
  };
}
