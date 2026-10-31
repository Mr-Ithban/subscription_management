/**
 * High-Volume Database Seed Script — Milestone M4-6
 *
 * Generates and batch-inserts a realistic large dataset:
 *  - 5,000 Customers with linked Users (reusing a single pre-computed bcrypt hash)
 *  - 8,000 Subscriptions across statuses (mostly ACTIVE) with 1–3 lines each
 *  - 20,000 Invoices with realistic distribution:
 *      * ~55% PAID
 *      * ~25% CONFIRMED (open / current)
 *      * ~10% Overdue (CONFIRMED past dueDate)
 *      * ~10% DRAFT or CANCELLED
 *  - Payments matching PAID (full) and partially paid invoices
 *
 * All operations use createMany in batches of 1,000.
 * Includes a deterministic PRNG for reproducible runs, prints timings and row counts,
 * and supports the --reset flag to truncate seeded entities before generation.
 *
 * Usage:
 *   node prisma/seedLarge.js [--reset]
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'node:url';

/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Ensures repeatable, deterministic datasets.
 */
export function createRng(seed = 42) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Splits an array into chunks of a given maximum size.
 *
 * @template T
 * @param {T[]} array
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(array, size = 1000) {
  if (!Array.isArray(array) || size <= 0) return [];
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Returns a random integer between min and max (inclusive) using the provided RNG.
 */
export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Picks a random item from an array using the provided RNG.
 */
export function pick(array, rng = Math.random) {
  if (!Array.isArray(array) || array.length === 0) return undefined;
  return array[Math.floor(rng() * array.length)];
}

/**
 * Returns a random Date between startDate and endDate using the provided RNG.
 */
export function dateBetween(startDate, endDate, rng = Math.random) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const randomTime = start + rng() * (end - start);
  return new Date(randomTime);
}

/**
 * Generates a cuid-like or deterministic unique ID.
 */
export function makeId(prefix, index) {
  return `${prefix}_${String(index).padStart(8, '0')}`;
}

/**
 * Clears previously seeded data.
 */
export async function resetDatabase(prisma) {
  console.log('[Reset] Clearing seeded records...');
  const t0 = Date.now();

  await prisma.payment.deleteMany();
  await prisma.invoiceDiscount.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscriptionHistory.deleteMany();
  await prisma.subscriptionLine.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany({ where: { role: 'CUSTOMER' } });

  console.log(`[Reset] Completed in ${Date.now() - t0}ms.\n`);
}

/**
 * Ensures baseline catalog records (Tax, Product, Plan) exist for relations.
 */
export async function ensureBaselineCatalog(prisma) {
  let tax = await prisma.tax.findFirst();
  if (!tax) {
    tax = await prisma.tax.create({
      data: {
        id: 'tax_std_18',
        name: 'GST 18%',
        rate: 18.0,
        active: true,
      },
    });
  }

  let product = await prisma.product.findFirst();
  if (!product) {
    product = await prisma.product.create({
      data: {
        id: 'prod_standard_cloud',
        name: 'Cloud Workspace Subscription',
        type: 'SOFTWARE',
        salesPrice: 5000,
        costPrice: 2000,
        active: true,
      },
    });
  }

  let plan = await prisma.plan.findFirst();
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        id: 'plan_pro_monthly',
        name: 'Professional Monthly',
        price: 5000,
        billingPeriod: 'MONTHLY',
        startDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        productId: product.id,
      },
    });
  }

  return { tax, product, plan };
}

/**
 * Main seeding execution function.
 */
export async function seedLarge(prisma, options = {}) {
  const counts = {
    customers: options.customers ?? parseInt(process.env.SEED_CUSTOMERS || '5000', 10),
    subscriptions: options.subscriptions ?? parseInt(process.env.SEED_SUBSCRIPTIONS || '8000', 10),
    invoices: options.invoices ?? parseInt(process.env.SEED_INVOICES || '20000', 10),
    payments: options.payments ?? parseInt(process.env.SEED_PAYMENTS || '15000', 10),
  };

  const isReset = options.reset ?? process.argv.includes('--reset');
  const rng = createRng(options.seed || 2026);
  const BATCH_SIZE = 1000;

  console.log('='.repeat(70));
  console.log('Brightloop High-Volume Database Seed (Milestone M4-6)');
  console.log('='.repeat(70));
  console.log('Target entity counts:');
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  const globalStart = Date.now();

  if (isReset) {
    await resetDatabase(prisma);
  }

  const { tax, product, plan } = await ensureBaselineCatalog(prisma);

  // -------------------------------------------------------------------------
  // 1. Customers & Users (Pre-compute one bcrypt hash for all 5,000 users)
  // -------------------------------------------------------------------------
  console.log(`[Phase 1] Generating ${counts.customers} Users and Customers...`);
  const t1 = Date.now();
  const passwordHash = await bcrypt.hash('Customer@12345', 10);

  const users = [];
  const customers = [];
  const firstNames = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Cameron', 'Dakota'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'];
  const cities = ['New York', 'London', 'Berlin', 'Tokyo', 'San Francisco', 'Bengaluru', 'Toronto', 'Sydney'];

  for (let i = 1; i <= counts.customers; i++) {
    const userId = makeId('usr', i);
    const customerId = makeId('cust', i);
    const fn = pick(firstNames, rng);
    const ln = pick(lastNames, rng);
    const email = `customer_${i}@brightloop.test`;

    users.push({
      id: userId,
      email,
      passwordHash,
      role: 'CUSTOMER',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    customers.push({
      id: customerId,
      userId,
      name: `${fn} ${ln}`,
      phone: `+1-555-${String(randomInt(1000, 9999, rng))}`,
      address: `${randomInt(10, 999, rng)} Tech Blvd, ${pick(cities, rng)}`,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
  }

  for (const b of chunk(users, BATCH_SIZE)) {
    await prisma.user.createMany({ data: b, skipDuplicates: true });
  }
  for (const b of chunk(customers, BATCH_SIZE)) {
    await prisma.customer.createMany({ data: b, skipDuplicates: true });
  }
  console.log(`[Phase 1] Created ${customers.length} Customers in ${Date.now() - t1}ms.\n`);

  // -------------------------------------------------------------------------
  // 2. Subscriptions & Lines (8,000 subscriptions, mostly ACTIVE)
  // -------------------------------------------------------------------------
  console.log(`[Phase 2] Generating ${counts.subscriptions} Subscriptions & Lines...`);
  const t2 = Date.now();

  const subscriptions = [];
  const subscriptionLines = [];
  const subStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'CONFIRMED', 'QUOTATION', 'CLOSED'];

  for (let i = 1; i <= counts.subscriptions; i++) {
    const subId = makeId('sub', i);
    const custIndex = ((i - 1) % counts.customers) + 1;
    const customerId = makeId('cust', custIndex);
    const status = pick(subStatuses, rng);
    const startDate = dateBetween('2026-01-01', '2026-06-01', rng);
    const nextBillingDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    subscriptions.push({
      id: subId,
      number: `SUB-2026-${String(i).padStart(5, '0')}`,
      customerId,
      planId: plan.id,
      startDate,
      nextBillingDate,
      status,
      paymentTerms: 15,
      createdAt: startDate,
      updatedAt: startDate,
    });

    const numLines = randomInt(1, 3, rng);
    for (let l = 1; l <= numLines; l++) {
      const qty = randomInt(1, 5, rng);
      const unitPrice = product.salesPrice;
      const amount = qty * unitPrice;

      subscriptionLines.push({
        id: `${subId}_line_${l}`,
        subscriptionId: subId,
        productId: product.id,
        taxId: tax.id,
        quantity: qty,
        unitPrice,
        amount,
        createdAt: startDate,
        updatedAt: startDate,
      });
    }
  }

  for (const b of chunk(subscriptions, BATCH_SIZE)) {
    await prisma.subscription.createMany({ data: b, skipDuplicates: true });
  }
  for (const b of chunk(subscriptionLines, BATCH_SIZE)) {
    await prisma.subscriptionLine.createMany({ data: b, skipDuplicates: true });
  }
  console.log(
    `[Phase 2] Created ${subscriptions.length} Subscriptions & ${subscriptionLines.length} Lines in ${Date.now() - t2}ms.\n`
  );

  // -------------------------------------------------------------------------
  // 3. Invoices & Lines (20,000 invoices: ~55% PAID, ~25% CONFIRMED, ~10% Overdue, ~10% DRAFT/CANCELLED)
  // -------------------------------------------------------------------------
  console.log(`[Phase 3] Generating ${counts.invoices} Invoices & Payments...`);
  const t3 = Date.now();

  const invoices = [];
  const invoiceLines = [];
  const payments = [];
  const today = new Date('2026-10-31T00:00:00Z');

  for (let i = 1; i <= counts.invoices; i++) {
    const invId = makeId('inv', i);
    const subIndex = ((i - 1) % counts.subscriptions) + 1;
    const subscriptionId = makeId('sub', subIndex);
    const custIndex = ((i - 1) % counts.customers) + 1;
    const customerId = makeId('cust', custIndex);

    // Realistic distribution
    const roll = rng();
    let status;
    let dueDate;
    let issueDate;

    if (roll < 0.55) {
      status = 'PAID';
      issueDate = dateBetween('2026-01-01', '2026-09-30', rng);
      dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    } else if (roll < 0.80) {
      status = 'CONFIRMED';
      issueDate = dateBetween('2026-10-20', '2026-10-30', rng);
      // Future dueDate (not overdue)
      dueDate = new Date(today.getTime() + randomInt(5, 20, rng) * 24 * 60 * 60 * 1000);
    } else if (roll < 0.90) {
      status = 'CONFIRMED';
      issueDate = dateBetween('2026-08-01', '2026-09-15', rng);
      // Past dueDate (overdue)
      dueDate = dateBetween(issueDate, new Date(today.getTime() - 24 * 60 * 60 * 1000), rng);
    } else if (roll < 0.95) {
      status = 'DRAFT';
      issueDate = dateBetween('2026-10-25', '2026-10-31', rng);
      dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    } else {
      status = 'CANCELLED';
      issueDate = dateBetween('2026-05-01', '2026-09-01', rng);
      dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    }

    const qty = randomInt(1, 3, rng);
    const unitPrice = product.salesPrice;
    const subtotal = qty * unitPrice;
    const taxTotal = Math.round((subtotal * 18) / 100);
    const discountTotal = 0;
    const total = subtotal + taxTotal - discountTotal;

    let amountPaid = 0;
    if (status === 'PAID') {
      amountPaid = total;
      payments.push({
        id: makeId('pay', payments.length + 1),
        invoiceId: invId,
        method: pick(['CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE'], rng),
        amount: total,
        paidAt: dateBetween(issueDate, dueDate, rng),
        note: 'Full invoice settlement',
        createdAt: issueDate,
      });
    } else if (status === 'CONFIRMED' && rng() < 0.3) {
      // Partial payment on some confirmed invoices
      amountPaid = Math.round(total * 0.4);
      payments.push({
        id: makeId('pay', payments.length + 1),
        invoiceId: invId,
        method: pick(['CARD', 'UPI', 'BANK_TRANSFER'], rng),
        amount: amountPaid,
        paidAt: dateBetween(issueDate, today, rng),
        note: 'Partial payment',
        createdAt: issueDate,
      });
    }

    const periodStart = issueDate;
    const periodEnd = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    invoices.push({
      id: invId,
      number: `INV-2026-${String(i).padStart(6, '0')}`,
      subscriptionId,
      customerId,
      status,
      periodStart,
      periodEnd,
      issueDate,
      dueDate,
      subtotal,
      taxTotal,
      discountTotal,
      total,
      amountPaid,
      createdAt: issueDate,
      updatedAt: issueDate,
    });

    invoiceLines.push({
      id: `${invId}_line_1`,
      invoiceId: invId,
      productId: product.id,
      taxId: tax.id,
      description: 'Monthly Cloud Subscription Service',
      quantity: qty,
      unitPrice,
      taxAmount: taxTotal,
      amount: subtotal,
      createdAt: issueDate,
    });
  }

  for (const b of chunk(invoices, BATCH_SIZE)) {
    await prisma.invoice.createMany({ data: b, skipDuplicates: true });
  }
  for (const b of chunk(invoiceLines, BATCH_SIZE)) {
    await prisma.invoiceLine.createMany({ data: b, skipDuplicates: true });
  }
  for (const b of chunk(payments, BATCH_SIZE)) {
    await prisma.payment.createMany({ data: b, skipDuplicates: true });
  }
  console.log(
    `[Phase 3] Created ${invoices.length} Invoices, ${invoiceLines.length} Lines & ${payments.length} Payments in ${Date.now() - t3}ms.\n`
  );

  const totalDuration = Date.now() - globalStart;
  console.log('='.repeat(70));
  console.log(`[Brightloop Seed] Finished successfully in ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s).`);
  console.log(`Summary:`);
  console.log(`  - Users:         ${users.length}`);
  console.log(`  - Customers:     ${customers.length}`);
  console.log(`  - Subscriptions: ${subscriptions.length}`);
  console.log(`  - Invoices:      ${invoices.length}`);
  console.log(`  - Payments:      ${payments.length}`);
  console.log('='.repeat(70));

  return {
    usersCount: users.length,
    customersCount: customers.length,
    subscriptionsCount: subscriptions.length,
    invoicesCount: invoices.length,
    paymentsCount: payments.length,
    durationMs: totalDuration,
  };
}

export async function main() {
  const prisma = new PrismaClient();
  try {
    await seedLarge(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Database seed error:', err);
    process.exit(1);
  });
}
