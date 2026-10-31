import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';

export async function seedAuth(prisma) {
  const passwordHash = await bcrypt.hash('Admin@12345', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@brightloop.test' },
    update: { name: 'Brightloop Admin', role: 'ADMIN', passwordHash },
    create: {
      email: 'admin@brightloop.test',
      name: 'Brightloop Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });
  const staffHash = await bcrypt.hash('Staff@12345', 10);
  await prisma.user.upsert({
    where: { email: 'staff@brightloop.test' },
    update: { name: 'Brightloop Staff', role: 'STAFF', passwordHash: staffHash },
    create: {
      email: 'staff@brightloop.test',
      name: 'Brightloop Staff',
      passwordHash: staffHash,
      role: 'STAFF',
    },
  });

  const customerHash = await bcrypt.hash('Customer@12345', 10);
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@brightloop.test' },
    update: { name: 'Brightloop Customer', role: 'CUSTOMER', passwordHash: customerHash },
    create: {
      email: 'customer@brightloop.test',
      name: 'Brightloop Customer',
      passwordHash: customerHash,
      role: 'CUSTOMER',
    },
  });
  await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: { name: 'Brightloop Customer' },
    create: { userId: customerUser.id, name: 'Brightloop Customer' },
  });
  return admin;
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

  // 2. Products: core catalog plus additional demo products
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
      type: 'GOODS',
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
    {
      id: 'prod-cloud-backup',
      name: 'Cloud Backup Storage',
      type: 'SOFTWARE',
      salesPrice: 129900,
      costPrice: 52000,
      notes: 'Encrypted cloud backups with scheduled recovery points',
    },
    {
      id: 'prod-team-workspace',
      name: 'Team Collaboration Workspace',
      type: 'SOFTWARE',
      salesPrice: 89900,
      costPrice: 34000,
      notes: 'Shared workspace, chat, and project collaboration tools',
    },
    {
      id: 'prod-secure-mail',
      name: 'Secure Mail Suite',
      type: 'SOFTWARE',
      salesPrice: 59900,
      costPrice: 21000,
      notes: 'Business email with spam filtering and domain protection',
    },
    {
      id: 'prod-crm-automation',
      name: 'CRM Automation Pack',
      type: 'SOFTWARE',
      salesPrice: 149900,
      costPrice: 62000,
      notes: 'Sales pipeline automation and customer follow-up workflows',
    },
    {
      id: 'prod-analytics-pro',
      name: 'Data Analytics Pro',
      type: 'SOFTWARE',
      salesPrice: 199900,
      costPrice: 78000,
      notes: 'Advanced analytics dashboards and scheduled reporting',
    },
    {
      id: 'prod-managed-database',
      name: 'Managed Database Service',
      type: 'SERVICE',
      salesPrice: 179900,
      costPrice: 98000,
      notes: 'Managed database backups, monitoring, and maintenance',
    },
    {
      id: 'prod-onboarding',
      name: 'Onboarding and Migration',
      type: 'SERVICE',
      salesPrice: 249900,
      costPrice: 132000,
      notes: 'Guided setup and migration of customer business data',
    },
    {
      id: 'prod-api-integration',
      name: 'API Integration Pack',
      type: 'SERVICE',
      salesPrice: 99900,
      costPrice: 46000,
      notes: 'Implementation support for common third-party integrations',
    },
    {
      id: 'prod-barcode-scanner',
      name: 'Wireless Barcode Scanner',
      type: 'GOODS',
      salesPrice: 89900,
      costPrice: 54000,
      notes: 'Wireless scanner for retail and warehouse checkout',
    },
    {
      id: 'prod-receipt-printer',
      name: 'Thermal Receipt Printer',
      type: 'GOODS',
      salesPrice: 159900,
      costPrice: 99000,
      notes: 'Compact receipt printer for point-of-sale terminals',
    },
    {
      id: 'prod-network-gateway',
      name: 'Managed Network Gateway',
      type: 'GOODS',
      salesPrice: 259900,
      costPrice: 172000,
      notes: 'Secure branch gateway with remote monitoring support',
    },
    {
      id: 'prod-success-workshop',
      name: 'Customer Success Workshop',
      type: 'SERVICE',
      salesPrice: 79900,
      costPrice: 35000,
      notes: 'Remote product training and adoption planning session',
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

  // 3. Product variants, including the accounting brand pricing example
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
    { id: 'var-backup-premium', productId: 'prod-cloud-backup', attribute: 'Tier', value: 'Premium', extraPrice: 25000 },
    { id: 'var-workspace-25', productId: 'prod-team-workspace', attribute: 'Seats', value: '25 users', extraPrice: 20000 },
    { id: 'var-analytics-cloud', productId: 'prod-analytics-pro', attribute: 'Hosting', value: 'Cloud', extraPrice: 12000 },
    { id: 'var-printer-bluetooth', productId: 'prod-receipt-printer', attribute: 'Connection', value: 'Bluetooth', extraPrice: 3000 },
    { id: 'var-gateway-advanced', productId: 'prod-network-gateway', attribute: 'License', value: 'Advanced', extraPrice: 45000 },
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
