import { buildPaginationMeta } from '../../../middleware/pagination.js';

export class CatalogError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CatalogError';
    this.statusCode = statusCode;
  }
}

/**
 * Computes discount status from dates and usedCount:
 * - 'exhausted': if usageLimit is set and usedCount >= usageLimit
 * - 'expired': if endDate has passed
 * - 'active': otherwise
 *
 * @param {object} discount
 * @param {Date | string | number} [now=new Date()]
 * @returns {'active' | 'expired' | 'exhausted'}
 */
export function getDiscountStatus(discount, now = new Date()) {
  const referenceTime = now instanceof Date ? now : new Date(now);

  if (
    discount.usageLimit !== null &&
    discount.usageLimit !== undefined &&
    discount.usedCount >= discount.usageLimit
  ) {
    return 'exhausted';
  }

  if (new Date(discount.endDate) < referenceTime) {
    return 'expired';
  }

  return 'active';
}

export async function listDiscounts(
  prisma,
  { pagination, search, appliesTo, productId, status, now = new Date() }
) {
  const { page, limit, skip } = pagination;
  const where = {};

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  if (appliesTo) {
    where.appliesTo = appliesTo;
  }

  if (productId) {
    where.productId = productId;
  }

  const allDiscounts = await prisma.discount.findMany({
    where,
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });

  const withStatus = allDiscounts.map((discount) => ({
    ...discount,
    status: getDiscountStatus(discount, now),
  }));

  let filtered = withStatus;
  if (status) {
    const normalized = status.toLowerCase();
    if (!['active', 'expired', 'exhausted'].includes(normalized)) {
      throw new CatalogError(
        'Invalid status filter. Allowed values: active, expired, exhausted',
        400
      );
    }
    filtered = withStatus.filter((d) => d.status === normalized);
  }

  const total = filtered.length;
  const paginatedDiscounts = filtered.slice(skip, skip + limit);

  return {
    discounts: paginatedDiscounts,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function getDiscountById(prisma, id, now = new Date()) {
  const discount = await prisma.discount.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!discount) {
    throw new CatalogError('Discount not found', 404);
  }

  return {
    ...discount,
    status: getDiscountStatus(discount, now),
  };
}

export async function createDiscount(prisma, data, now = new Date()) {
  if (data.appliesTo === 'PRODUCT' && data.productId) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) {
      throw new CatalogError('Associated product not found', 404);
    }
  }

  const created = await prisma.discount.create({
    data,
    include: { product: true },
  });

  return {
    ...created,
    status: getDiscountStatus(created, now),
  };
}

export async function updateDiscount(prisma, id, data, now = new Date()) {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) {
    throw new CatalogError('Discount not found', 404);
  }

  // Cross-field validation against merged values
  const effectiveType = data.type || existing.type;
  const effectiveValue = data.value !== undefined ? data.value : existing.value;
  if (effectiveType === 'PERCENT' && (effectiveValue < 1 || effectiveValue > 100)) {
    throw new CatalogError('PERCENT discount value must be between 1 and 100', 400);
  }

  const effectiveStart = data.startDate ? new Date(data.startDate) : new Date(existing.startDate);
  const effectiveEnd = data.endDate ? new Date(data.endDate) : new Date(existing.endDate);
  if (effectiveEnd <= effectiveStart) {
    throw new CatalogError('End date must be after start date', 400);
  }

  const effectiveAppliesTo = data.appliesTo || existing.appliesTo;
  const effectiveProductId = data.productId !== undefined ? data.productId : existing.productId;
  if (effectiveAppliesTo === 'PRODUCT' && !effectiveProductId) {
    throw new CatalogError('Product ID is required when appliesTo is PRODUCT', 400);
  }
  if (effectiveAppliesTo === 'SUBSCRIPTION' && effectiveProductId) {
    throw new CatalogError('Product ID must not be set when appliesTo is SUBSCRIPTION', 400);
  }

  if (data.productId) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) {
      throw new CatalogError('Associated product not found', 404);
    }
  }

  const updated = await prisma.discount.update({
    where: { id },
    data,
    include: { product: true },
  });

  return {
    ...updated,
    status: getDiscountStatus(updated, now),
  };
}

export async function deleteDiscount(prisma, id) {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) {
    throw new CatalogError('Discount not found', 404);
  }

  try {
    await prisma.discount.delete({ where: { id } });
    return { message: 'Discount deleted successfully' };
  } catch (error) {
    if (error.code === 'P2003') {
      throw new CatalogError('Cannot delete discount that is used in invoices', 409);
    }
    throw error;
  }
}
