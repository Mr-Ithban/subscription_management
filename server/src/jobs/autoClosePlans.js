import { PrismaClient } from '@prisma/client';

const defaultPrisma = new PrismaClient();

/**
 * Closes ACTIVE plans with autoClose=true whose endDate has passed.
 *
 * @param {Date | string | number} [today=new Date()] Reference date for checking expired plans
 * @param {import('@prisma/client').PrismaClient} [prisma=defaultPrisma] Prisma client instance
 * @returns {Promise<{ count: number }>} Result object containing the count of closed plans
 */
export async function autoClosePlans(today = new Date(), prisma = defaultPrisma) {
  const targetDate = today instanceof Date ? today : new Date(today);

  if (isNaN(targetDate.getTime())) {
    throw new Error('Invalid today date provided to autoClosePlans');
  }

  const result = await prisma.plan.updateMany({
    where: {
      status: 'ACTIVE',
      autoClose: true,
      endDate: {
        not: null,
        lt: targetDate,
      },
    },
    data: {
      status: 'CLOSED',
    },
  });

  return result;
}

export default autoClosePlans;
