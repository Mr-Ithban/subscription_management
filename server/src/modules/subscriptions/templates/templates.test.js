import { jest } from '@jest/globals';
import { createSubscriptionFromTemplate, createTemplate, deleteTemplate, getTemplate, TemplateError, updateTemplate } from './service.js';

const baseTemplate = {
  id: 'tpl_1',
  name: 'Standard',
  validityDays: 30,
  planId: 'plan_1',
  lines: [],
};

function createPrisma() {
  const state = { template: baseTemplate, lines: [] };
  const tx = {
    templateLine: {
      deleteMany: jest.fn(async () => { state.lines = []; }),
    },
    quotationTemplate: {
      update: jest.fn(async ({ data }) => {
        state.template = { ...state.template, ...data };
        if (data.lines?.create) state.lines = data.lines.create;
        return { ...state.template, lines: state.lines };
      }),
    },
  };
  const prisma = {
    state,
    plan: { findUnique: jest.fn(async () => ({ id: 'plan_1' })) },
    product: { findUnique: jest.fn(async () => ({ id: 'prod_1' })) },
    productVariant: { findUnique: jest.fn(async () => ({ id: 'var_1', productId: 'prod_1' })) },
    tax: { findUnique: jest.fn(async () => ({ id: 'tax_1' })) },
    quotationTemplate: {
      findMany: jest.fn(async () => [baseTemplate]),
      findUnique: jest.fn(async () => state.template),
      create: jest.fn(async ({ data }) => ({ ...data, id: 'tpl_new' })),
      update: tx.quotationTemplate.update,
      delete: jest.fn(async () => ({ id: 'tpl_1' })),
    },
    templateLine: tx.templateLine,
    $transaction: jest.fn(async (callback) => callback(tx)),
  };
  return prisma;
}

describe('quotation template service', () => {
  it('creates templates with validated references and line items', async () => {
    const prisma = createPrisma();
    const result = await createTemplate(prisma, {
      name: 'Standard', validityDays: 30, planId: 'plan_1',
      lines: [{ productId: 'prod_1', variantId: 'var_1', taxId: 'tax_1', quantity: 2, unitPrice: 500 }],
    });

    expect(result.id).toBe('tpl_new');
    expect(prisma.quotationTemplate.create.mock.calls[0][0].data.lines.create[0]).toMatchObject({
      productId: 'prod_1', variantId: 'var_1', taxId: 'tax_1', quantity: 2, unitPrice: 500,
    });
  });

  it('rejects a variant that belongs to a different product', async () => {
    const prisma = createPrisma();
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'var_1', productId: 'another_product' });
    await expect(createTemplate(prisma, {
      name: 'Standard', validityDays: 30, planId: 'plan_1',
      lines: [{ productId: 'prod_1', variantId: 'var_1', quantity: 1, unitPrice: 500 }],
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('replaces lines atomically when updating and deletes templates', async () => {
    const prisma = createPrisma();
    await updateTemplate(prisma, 'tpl_1', { lines: [{ productId: 'prod_1', quantity: 3, unitPrice: 200 }] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.templateLine.deleteMany).toHaveBeenCalledWith({ where: { templateId: 'tpl_1' } });
    await deleteTemplate(prisma, 'tpl_1');
    expect(prisma.quotationTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl_1' } });
  });

  it('returns not found for missing templates', async () => {
    const prisma = createPrisma();
    prisma.quotationTemplate.findUnique.mockResolvedValue(null);
    await expect(getTemplate(prisma, 'missing')).rejects.toBeInstanceOf(TemplateError);
  });

  it('creates a quotation subscription using saved template prices and records its initial history', async () => {
    const template = {
      id: 'tpl_1', name: 'Standard quote', planId: 'plan_1',
      plan: { id: 'plan_1', status: 'ACTIVE', minQty: 1, startDate: new Date('2026-01-01'), endDate: null },
      lines: [{ productId: 'prod_1', variantId: 'var_1', taxId: 'tax_1', quantity: 2, unitPrice: 425 }],
    };
    const prisma = {
      $transaction: jest.fn(async (callback) => callback({
        quotationTemplate: { findUnique: jest.fn(async () => template) },
        customer: { findUnique: jest.fn(async () => ({ id: 'customer_1' })) },
        product: { findUnique: jest.fn(async () => ({ id: 'prod_1', active: true, salesPrice: 900 })) },
        productVariant: { findUnique: jest.fn(async () => ({ id: 'var_1', productId: 'prod_1' })) },
        tax: { findUnique: jest.fn(async () => ({ id: 'tax_1', active: true })) },
        subscription: { create: jest.fn(async ({ data }) => data) },
      })),
    };

    const result = await createSubscriptionFromTemplate(prisma, 'tpl_1', {
      customerId: 'customer_1', startDate: new Date('2026-03-01'), paymentTerms: 10,
    }, 'user_1');

    expect(result.status).toBe('QUOTATION');
    expect(result.lines.create[0]).toMatchObject({ unitPrice: 425, amount: 850, quantity: 2 });
    expect(result.history.create).toMatchObject({
      fromStatus: 'DRAFT', toStatus: 'QUOTATION', changedById: 'user_1',
      note: 'Created from quotation template Standard quote',
    });
  });

  it('rejects missing customers or invalid template line references', async () => {
    const plan = { id: 'plan_1', status: 'ACTIVE', minQty: 1, startDate: new Date('2026-01-01'), endDate: null };
    const template = { id: 'tpl_1', name: 'Standard', planId: 'plan_1', plan, lines: [{
      productId: 'prod_1', variantId: 'var_1', taxId: null, quantity: 1, unitPrice: 100,
    }] };
    const tx = {
      quotationTemplate: { findUnique: jest.fn(async () => template) },
      customer: { findUnique: jest.fn(async () => ({ id: 'customer_1' })) },
      product: { findUnique: jest.fn(async () => ({ id: 'prod_1', active: true })) },
      productVariant: { findUnique: jest.fn(async () => ({ id: 'var_1', productId: 'other_product' })) },
      tax: { findUnique: jest.fn() },
      subscription: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
    await expect(createSubscriptionFromTemplate(prisma, 'tpl_1', {
      customerId: 'customer_1', startDate: new Date('2026-03-01'), paymentTerms: 0,
    }, 'user_1')).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.subscription.create).not.toHaveBeenCalled();

    tx.customer.findUnique.mockResolvedValue(null);
    await expect(createSubscriptionFromTemplate(prisma, 'tpl_1', {
      customerId: 'missing', startDate: new Date('2026-03-01'), paymentTerms: 0,
    }, 'user_1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
