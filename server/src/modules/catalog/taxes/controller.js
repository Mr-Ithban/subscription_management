import {
  listTaxes,
  getTaxById,
  createTax,
  updateTax,
  deleteTax,
  CatalogError,
} from './service.js';

export function createTaxesController(prisma) {
  return {
    list: async (req, res, next) => {
      try {
        const result = await listTaxes(prisma, {
          pagination: req.pagination,
          search: req.query.search,
          active: req.query.active,
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
        const tax = await getTaxById(prisma, req.params.id);
        return res.status(200).json(tax);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    create: async (req, res, next) => {
      try {
        const tax = await createTax(prisma, req.body);
        return res.status(201).json(tax);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    update: async (req, res, next) => {
      try {
        const tax = await updateTax(prisma, req.params.id, req.body);
        return res.status(200).json(tax);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    delete: async (req, res, next) => {
      try {
        const result = await deleteTax(prisma, req.params.id);
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
