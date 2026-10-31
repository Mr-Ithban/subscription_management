import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';

export async function seedAuth(prisma) {
  const passwordHash = await bcrypt.hash('Admin@12345', 10);

  return prisma.user.upsert({
    where: { email: 'admin@brightloop.test' },
    update: { name: 'Brightloop Admin' },
    create: {
      email: 'admin@brightloop.test',
      name: 'Brightloop Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });
}

export async function seedCatalog(prisma) {
  // 1. Taxes: 5%, 12%, 18%
  const taxes = [
    { id: 'tax-5', name: 'GST 5%', rate: 5.0 },
    { id: 'tax-12', name: 'GST 12%', rate: 12.0 },
    { id: 'tax-18', name: 'GST 18%', rate: 18.0 },
  ];

  for (const tax of taxes) {
    await prisma.tax.upsert({
      where: { id: tax.id },
      update: { name: tax.name, rate: tax.rate, active: true },
      create: { id: tax.id, name: tax.name, rate: tax.rate, active: true },
    });
  }

  // 2. Products (6 products)
  const products = [
    {
      id: 'prod-accounting-suite',
      name: 'Accounting Suite',
      type: 'SERVICE',
      salesPrice: 10000,
      costPrice: 6000,
      notes: 'Core accounting integration platform',
    },
    {
      id: 'prod-cloud-hosting',
      name: 'Cloud Hosting Infrastructure',
      type: 'SERVICE',
      salesPrice: 25000,
      costPrice: 15000,
      notes: 'Dedicated cloud server instances',
    },
    {
      id: 'prod-pos-terminal',
      name: 'Smart POS Terminal',
      type: 'GOODS',
      salesPrice: 45000,
      costPrice: 30000,
      notes: 'Hardware terminal device',
    },
    {
      id: 'prod-thermal-paper',
      name: 'Thermal Receipt Paper Rolls',
      type: 'CONSUMABLE',
      salesPrice: 1200,
      costPrice: 600,
      notes: 'Consumable paper rolls pack',
    },
    {
      id: 'prod-priority-support',
      name: '24/7 Priority Support SLA',
      type: 'SERVICE',
      salesPrice: 8000,
      costPrice: 3000,
      notes: 'Dedicated enterprise technical support',
    },
    {
      id: 'prod-analytics-dashboard',
      name: 'Executive Analytics Addon',
      type: 'SERVICE',
      salesPrice: 15000,
      costPrice: 5000,
      notes: 'Advanced reporting and real-time BI analytics',
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        type: prod.type,
        salesPrice: prod.salesPrice,
        costPrice: prod.costPrice,
        notes: prod.notes,
        active: true,
      },
      create: {
        id: prod.id,
        name: prod.name,
        type: prod.type,
        salesPrice: prod.salesPrice,
        costPrice: prod.costPrice,
        notes: prod.notes,
        active: true,
      },
    });
  }

  // 3. Product Variants for Accounting Suite (Brand: Odoo +560, Brand: Zoho +300)
  const variants = [
    {
      id: 'var-brand-odoo',
      productId: 'prod-accounting-suite',
      attribute: 'Brand',
      value: 'Odoo',
      extraPrice: 560,
    },
    {
      id: 'var-brand-zoho',
      productId: 'prod-accounting-suite',
      attribute: 'Brand',
      value: 'Zoho',
      extraPrice: 300,
    },
  ];

  for (const v of variants) {
    await prisma.productVariant.upsert({
      where: {
        productId_attribute_value: {
          productId: v.productId,
          attribute: v.attribute,
          value: v.value,
        },
      },
      update: {
        extraPrice: v.extraPrice,
      },
      create: {
        id: v.id,
        productId: v.productId,
        attribute: v.attribute,
        value: v.value,
        extraPrice: v.extraPrice,
      },
    });
  }

  // 4. Plans (4 plans: daily, weekly, monthly, yearly)
  const plans = [
    {
      id: 'plan-daily-starter',
      name: 'Daily Pass',
      price: 499,
      billingPeriod: 'DAILY',
      minQty: 1,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: null,
      status: 'ACTIVE',
      autoClose: false,
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
      productId: 'prod-accounting-suite',
    },
    {
      id: 'plan-weekly-growth',
      name: 'Weekly Growth',
      price: 1999,
      billingPeriod: 'WEEKLY',
      minQty: 1,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: null,
      status: 'ACTIVE',
      autoClose: false,
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
      productId: 'prod-cloud-hosting',
    },
    {
      id: 'plan-monthly-pro',
      name: 'Pro Monthly',
      price: 4999,
      billingPeriod: 'MONTHLY',
      minQty: 1,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: null,
      status: 'ACTIVE',
      autoClose: false,
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
      productId: 'prod-accounting-suite',
    },
    {
      id: 'plan-yearly-enterprise',
      name: 'Enterprise Annual',
      price: 49999,
      billingPeriod: 'YEARLY',
      minQty: 1,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: null,
      status: 'ACTIVE',
      autoClose: false,
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
      productId: 'prod-cloud-hosting',
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        price: plan.price,
        billingPeriod: plan.billingPeriod,
        minQty: plan.minQty,
        startDate: plan.startDate,
        endDate: plan.endDate,
        status: plan.status,
        autoClose: plan.autoClose,
        allowPause: plan.allowPause,
        allowEarlyClose: plan.allowEarlyClose,
        allowRenew: plan.allowRenew,
        productId: plan.productId,
      },
      create: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        billingPeriod: plan.billingPeriod,
        minQty: plan.minQty,
        startDate: plan.startDate,
        endDate: plan.endDate,
        status: plan.status,
        autoClose: plan.autoClose,
        allowPause: plan.allowPause,
        allowEarlyClose: plan.allowEarlyClose,
        allowRenew: plan.allowRenew,
        productId: plan.productId,
      },
    });
  }

  // 5. Discounts (3 discounts: 10% subscription-wide, fixed 200 on a product, one already expired)
  const discounts = [
    {
      id: 'disc-sub-10',
      name: '10% Sitewide Subscription Discount',
      type: 'PERCENT',
      value: 10,
      appliesTo: 'SUBSCRIPTION',
      productId: null,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2099-12-31T23:59:59.000Z'),
      minPurchase: 1000,
      minQty: 1,
      usageLimit: null,
      usedCount: 0,
      active: true,
    },
    {
      id: 'disc-prod-fixed-200',
      name: 'Fixed 200 Off Accounting Suite',
      type: 'FIXED',
      value: 200,
      appliesTo: 'PRODUCT',
      productId: 'prod-accounting-suite',
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2099-12-31T23:59:59.000Z'),
      minPurchase: 500,
      minQty: 1,
      usageLimit: 500,
      usedCount: 15,
      active: true,
    },
    {
      id: 'disc-expired-blackfriday',
      name: 'Expired Early Bird Promo',
      type: 'PERCENT',
      value: 25,
      appliesTo: 'SUBSCRIPTION',
      productId: null,
      startDate: new Date('2023-01-01T00:00:00.000Z'),
      endDate: new Date('2023-12-31T23:59:59.000Z'),
      minPurchase: 1000,
      minQty: 1,
      usageLimit: 100,
      usedCount: 88,
      active: true,
    },
  ];

  for (const disc of discounts) {
    await prisma.discount.upsert({
      where: { id: disc.id },
      update: {
        name: disc.name,
        type: disc.type,
        value: disc.value,
        appliesTo: disc.appliesTo,
        productId: disc.productId,
        startDate: disc.startDate,
        endDate: disc.endDate,
        minPurchase: disc.minPurchase,
        minQty: disc.minQty,
        usageLimit: disc.usageLimit,
        usedCount: disc.usedCount,
        active: disc.active,
      },
      create: {
        id: disc.id,
        name: disc.name,
        type: disc.type,
        value: disc.value,
        appliesTo: disc.appliesTo,
        productId: disc.productId,
        startDate: disc.startDate,
        endDate: disc.endDate,
        minPurchase: disc.minPurchase,
        minQty: disc.minQty,
        usageLimit: disc.usageLimit,
        usedCount: disc.usedCount,
        active: disc.active,
      },
    });
  }

  return {
    taxes,
    products,
    variants,
    plans,
    discounts,
  };
}

async function main() {
  const prisma = new PrismaClient();

  try {
    await seedAuth(prisma);
    await seedCatalog(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('Database seed error:', error);
    process.exit(1);
  });
}
