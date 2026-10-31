import { jest } from '@jest/globals';
import { seedCatalog } from '../../../prisma/seed.js';

describe('Catalog Seeding (M2-9)', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = {
      tax: { upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)) },
      product: { upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)) },
      productVariant: { upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)) },
      plan: { upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)) },
      discount: { upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)) },
    };
  });

  test('seeds 3 taxes: 5%, 12%, and 18%', async () => {
    const result = await seedCatalog(mockPrisma);

    expect(mockPrisma.tax.upsert).toHaveBeenCalledTimes(3);
    const taxRates = result.taxes.map((t) => t.rate);
    expect(taxRates).toEqual(expect.arrayContaining([5.0, 12.0, 18.0]));
  });

  test('seeds 6 products including one with Brand variant (Odoo +560, Zoho +300)', async () => {
    const result = await seedCatalog(mockPrisma);

    expect(mockPrisma.product.upsert).toHaveBeenCalledTimes(6);
    expect(result.products).toHaveLength(6);

    const accountingSuite = result.products.find((p) => p.name === 'Accounting Suite');
    expect(accountingSuite).toBeDefined();

    expect(mockPrisma.productVariant.upsert).toHaveBeenCalledTimes(2);
    expect(result.variants).toHaveLength(2);

    const odooVariant = result.variants.find((v) => v.attribute === 'Brand' && v.value === 'Odoo');
    expect(odooVariant).toBeDefined();
    expect(odooVariant.extraPrice).toBe(560);

    const zohoVariant = result.variants.find((v) => v.attribute === 'Brand' && v.value === 'Zoho');
    expect(zohoVariant).toBeDefined();
    expect(zohoVariant.extraPrice).toBe(300);
  });

  test('seeds 4 plans: daily, weekly, monthly, and yearly', async () => {
    const result = await seedCatalog(mockPrisma);

    expect(mockPrisma.plan.upsert).toHaveBeenCalledTimes(4);
    expect(result.plans).toHaveLength(4);

    const periods = result.plans.map((p) => p.billingPeriod);
    expect(periods).toContain('DAILY');
    expect(periods).toContain('WEEKLY');
    expect(periods).toContain('MONTHLY');
    expect(periods).toContain('YEARLY');
  });

  test('seeds 3 discounts: 10% subscription-wide, fixed 200 on product, and one expired', async () => {
    const result = await seedCatalog(mockPrisma);

    expect(mockPrisma.discount.upsert).toHaveBeenCalledTimes(3);
    expect(result.discounts).toHaveLength(3);

    const sub10 = result.discounts.find(
      (d) => d.type === 'PERCENT' && d.value === 10 && d.appliesTo === 'SUBSCRIPTION',
    );
    expect(sub10).toBeDefined();

    const fixed200 = result.discounts.find(
      (d) => d.type === 'FIXED' && d.value === 200 && d.appliesTo === 'PRODUCT',
    );
    expect(fixed200).toBeDefined();
    expect(fixed200.productId).toBe('prod-accounting-suite');

    const now = new Date();
    const expired = result.discounts.find((d) => d.endDate && d.endDate < now);
    expect(expired).toBeDefined();
  });
});
