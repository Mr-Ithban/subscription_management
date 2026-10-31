import { buildPaginationMeta } from '../../../middleware/pagination.js';

export class CatalogError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CatalogError';
    this.statusCode = statusCode;
  }
}

export async function listTaxes(prisma, { pagination, search, active }) {
  const { page, limit, skip } = pagination;
  const where = {};

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  if (active !== undefined && active !== '') {
    where.active = active === 'true' || active === true;
  }

  const [total, taxes] = await Promise.all([
    prisma.tax.count({ where }),
    prisma.tax.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    taxes,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function getTaxById(prisma, id) {
  const tax = await prisma.tax.findUnique({
    where: { id },
  });

  if (!tax) {
    throw new CatalogError('Tax not found', 404);
  }

  return tax;
}

export async function createTax(prisma, data) {
  return prisma.tax.create({
    data,
  });
}

export async function updateTax(prisma, id, data) {
  await getTaxById(prisma, id);

  return prisma.tax.update({
    where: { id },
    data,
  });
}

export async function deleteTax(prisma, id) {
  await getTaxById(prisma, id);

  try {
    await prisma.tax.delete({
      where: { id },
    });
    return { message: 'Tax deleted successfully' };
  } catch (error) {
    if (error.code === 'P2003') {
      throw new CatalogError('Cannot delete tax in use by subscription or invoice lines', 409);
    }
    throw error;
  }
}
