import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  CatalogError,
} from './service.js';

export function createProductsController(prisma) {
  return {
    list: async (req, res, next) => {
      try {
        const result = await listProducts(prisma, {
          pagination: req.pagination,
          search: req.query.search,
          type: req.query.type,
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
        const product = await getProductById(prisma, req.params.id);
        return res.status(200).json(product);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    create: async (req, res, next) => {
      try {
        const product = await createProduct(prisma, req.body);
        return res.status(201).json(product);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    update: async (req, res, next) => {
      try {
        const product = await updateProduct(prisma, req.params.id, req.body);
        return res.status(200).json(product);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    delete: async (req, res, next) => {
      try {
        const product = await deleteProduct(prisma, req.params.id);
        return res.status(200).json(product);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    createVariant: async (req, res, next) => {
      try {
        const variant = await createVariant(prisma, req.params.id, req.body);
        return res.status(201).json(variant);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    updateVariant: async (req, res, next) => {
      try {
        const variant = await updateVariant(prisma, req.params.id, req.params.variantId, req.body);
        return res.status(200).json(variant);
      } catch (error) {
        if (error instanceof CatalogError) {
          return res.status(error.statusCode).json({ error: { message: error.message } });
        }
        return next(error);
      }
    },

    deleteVariant: async (req, res, next) => {
      try {
        const result = await deleteVariant(prisma, req.params.id, req.params.variantId);
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
