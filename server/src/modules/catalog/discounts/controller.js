import {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  CatalogError,
} from './service.js';

export function createDiscountsController(prisma) {
  return {
    list: async (req, res, next) => {
      try {
        const result = await listDiscounts(prisma, {
          pagination: req.pagination,
          search: req.query.search,
          appliesTo: req.query.appliesTo,
          productId: req.query.productId,
          status: req.query.status,
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
        const discount = await getDiscountById(prisma, req.params.id);
        return res.status(200).json(discount);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    create: async (req, res, next) => {
      try {
        const discount = await createDiscount(prisma, req.body);
        return res.status(201).json(discount);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    update: async (req, res, next) => {
      try {
        const discount = await updateDiscount(prisma, req.params.id, req.body);
        return res.status(200).json(discount);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    delete: async (req, res, next) => {
      try {
        const result = await deleteDiscount(prisma, req.params.id);
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
