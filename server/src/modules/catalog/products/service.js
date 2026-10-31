import { buildPaginationMeta } from '../../../middleware/pagination.js';

export class CatalogError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CatalogError';
    this.statusCode = statusCode;
  }
}

export async function listProducts(prisma, { pagination, search, type, active }) {
  const { page, limit, skip } = pagination;
  const where = {};

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  if (type) {
    where.type = type;
  }

  if (active !== undefined && active !== null && active !== '') {
    if (active !== 'all') {
      where.active = active === 'true' || active === true;
    }
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    products,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function getProductById(prisma, id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  });

  if (!product) {
    throw new CatalogError('Product not found', 404);
  }

  return product;
}

export async function createProduct(prisma, data) {
  return prisma.product.create({
    data,
    include: { variants: true },
  });
}

export async function updateProduct(prisma, id, data) {
  // Ensure product exists
  await getProductById(prisma, id);

  return prisma.product.update({
    where: { id },
    data,
    include: { variants: true },
  });
}

export async function deleteProduct(prisma, id) {
  // Soft delete via active = false
  await getProductById(prisma, id);

  return prisma.product.update({
    where: { id },
    data: { active: false },
    include: { variants: true },
  });
}

export async function createVariant(prisma, productId, data) {
  // Verify parent product exists
  await getProductById(prisma, productId);

  try {
    return await prisma.productVariant.create({
      data: {
        productId,
        ...data,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new CatalogError('Variant with this attribute and value already exists for this product', 409);
    }
    throw error;
  }
}

export async function updateVariant(prisma, productId, variantId, data) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });

  if (!variant) {
    throw new CatalogError('Variant not found', 404);
  }

  try {
    return await prisma.productVariant.update({
      where: { id: variantId },
      data,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new CatalogError('Variant with this attribute and value already exists for this product', 409);
    }
    throw error;
  }
}

export async function deleteVariant(prisma, productId, variantId) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });

  if (!variant) {
    throw new CatalogError('Variant not found', 404);
  }

  await prisma.productVariant.delete({
    where: { id: variantId },
  });

  return { message: 'Variant deleted successfully' };
}
