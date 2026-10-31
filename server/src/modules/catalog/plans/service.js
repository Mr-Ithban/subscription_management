import { buildPaginationMeta } from '../../../middleware/pagination.js';

export class CatalogError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CatalogError';
    this.statusCode = statusCode;
  }
}

export async function listPlans(prisma, { pagination, status, availableOn, search }) {
  const { page, limit, skip } = pagination;
  const where = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  if (availableOn) {
    const targetDate = new Date(availableOn);
    if (!isNaN(targetDate.getTime())) {
      where.AND = [
        { startDate: { lte: targetDate } },
        {
          OR: [
            { endDate: null },
            { endDate: { gte: targetDate } },
          ],
        },
      ];
    }
  }

  const [total, plans] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.findMany({
      where,
      skip,
      take: limit,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    plans,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function getPlanById(prisma, id) {
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!plan) {
    throw new CatalogError('Plan not found', 404);
  }

  return plan;
}

export async function createPlan(prisma, data) {
  if (data.productId) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      throw new CatalogError('Associated product not found', 404);
    }
  }

  return prisma.plan.create({
    data,
    include: { product: true },
  });
}

export async function updatePlan(prisma, id, data) {
  const existing = await getPlanById(prisma, id);

  // Validate cross-field date logic against merged data
  const effectiveStart = data.startDate ? new Date(data.startDate) : new Date(existing.startDate);
  const effectiveEnd = data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : existing.endDate ? new Date(existing.endDate) : null;

  if (effectiveEnd && effectiveEnd <= effectiveStart) {
    throw new CatalogError('End date must be after start date', 400);
  }

  if (data.productId) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      throw new CatalogError('Associated product not found', 404);
    }
  }

  return prisma.plan.update({
    where: { id },
    data,
    include: { product: true },
  });
}

export async function deletePlan(prisma, id) {
  await getPlanById(prisma, id);

  try {
    await prisma.plan.delete({
      where: { id },
    });
    return { message: 'Plan deleted successfully' };
  } catch (error) {
    if (error.code === 'P2003') {
      throw new CatalogError('Cannot delete plan with existing subscriptions or templates', 409);
    }
    throw error;
  }
}
