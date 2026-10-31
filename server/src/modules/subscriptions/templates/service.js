import { newSubscriptionNumber } from '../subscriptions/service.js';

export class TemplateError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'TemplateError';
    this.statusCode = statusCode;
  }
}

const templateInclude = { lines: { orderBy: { createdAt: 'asc' } }, plan: true };

async function validateReferences(prisma, { planId, lines = [] }) {
  if (planId && !(await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } }))) {
    throw new TemplateError('Plan not found', 404);
  }

  for (const line of lines) {
    if (!(await prisma.product.findUnique({ where: { id: line.productId }, select: { id: true } }))) {
      throw new TemplateError(`Product not found: ${line.productId}`, 404);
    }
    if (line.variantId) {
      const variant = await prisma.productVariant.findUnique({ where: { id: line.variantId }, select: { id: true, productId: true } });
      if (!variant || variant.productId !== line.productId) throw new TemplateError('Variant does not belong to the selected product', 400);
    }
    if (line.taxId && !(await prisma.tax.findUnique({ where: { id: line.taxId }, select: { id: true } }))) {
      throw new TemplateError(`Tax not found: ${line.taxId}`, 404);
    }
  }
}

function lineCreateData(lines) {
  return lines.map(({ productId, variantId, taxId, quantity, unitPrice }) => ({
    productId,
    variantId: variantId || null,
    taxId: taxId || null,
    quantity,
    unitPrice,
  }));
}

export async function listTemplates(prisma) {
  return prisma.quotationTemplate.findMany({ include: templateInclude, orderBy: { createdAt: 'desc' } });
}

export async function getTemplate(prisma, id) {
  const template = await prisma.quotationTemplate.findUnique({ where: { id }, include: templateInclude });
  if (!template) throw new TemplateError('Quotation template not found', 404);
  return template;
}

export async function createTemplate(prisma, data) {
  await validateReferences(prisma, data);
  const { lines, ...templateData } = data;
  return prisma.quotationTemplate.create({
    data: { ...templateData, lines: { create: lineCreateData(lines) } },
    include: templateInclude,
  });
}

export async function updateTemplate(prisma, id, data) {
  await getTemplate(prisma, id);
  await validateReferences(prisma, data);
  const { lines, ...templateData } = data;
  return prisma.$transaction(async (tx) => {
    if (lines !== undefined) await tx.templateLine.deleteMany({ where: { templateId: id } });
    return tx.quotationTemplate.update({
      where: { id },
      data: { ...templateData, ...(lines !== undefined && { lines: { create: lineCreateData(lines) } }) },
      include: templateInclude,
    });
  });
}

export async function deleteTemplate(prisma, id) {
  await getTemplate(prisma, id);
  await prisma.quotationTemplate.delete({ where: { id } });
  return { message: 'Quotation template deleted successfully' };
}

export async function createSubscriptionFromTemplate(prisma, templateId, data, changedById) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.quotationTemplate.findUnique({
      where: { id: templateId },
      include: { plan: true, lines: { orderBy: { createdAt: 'asc' } } },
    });
    if (!template) throw new TemplateError('Quotation template not found', 404);

    const customer = await tx.customer.findUnique({ where: { id: data.customerId }, select: { id: true } });
    if (!customer) throw new TemplateError('Customer not found', 404);
    if (template.plan.status !== 'ACTIVE') throw new TemplateError('Plan is not active', 400);
    if (data.startDate < template.plan.startDate) throw new TemplateError('Subscription starts before plan availability', 400);
    if (template.plan.endDate && data.startDate > template.plan.endDate) {
      throw new TemplateError('Plan is not available on the subscription start date', 400);
    }
    if (data.expiryDate && data.expiryDate < data.startDate) throw new TemplateError('Expiry date must be on or after the start date', 400);

    const lines = [];
    for (const line of template.lines) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product?.active) throw new TemplateError(`Active product not found: ${line.productId}`, 404);
      if (line.variantId) {
        const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
        if (!variant || variant.productId !== line.productId) throw new TemplateError('Template variant no longer belongs to its product', 409);
      }
      if (line.taxId) {
        const tax = await tx.tax.findUnique({ where: { id: line.taxId } });
        if (!tax?.active) throw new TemplateError(`Active tax not found: ${line.taxId}`, 404);
      }
      const amount = line.unitPrice * line.quantity;
      if (!Number.isSafeInteger(amount) || amount > 2_147_483_647) {
        throw new TemplateError('Template line amount exceeds the supported currency range', 400);
      }
      lines.push({
        productId: line.productId,
        variantId: line.variantId,
        taxId: line.taxId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount,
      });
    }
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
    if (totalQuantity < template.plan.minQty) {
      throw new TemplateError(`Plan requires a minimum quantity of ${template.plan.minQty}`, 400);
    }

    return tx.subscription.create({
      data: {
        number: newSubscriptionNumber(),
        customerId: customer.id,
        planId: template.planId,
        startDate: data.startDate,
        expiryDate: data.expiryDate ?? null,
        paymentTerms: data.paymentTerms,
        status: 'QUOTATION',
        lines: { create: lines },
        history: {
          create: {
            fromStatus: 'DRAFT',
            toStatus: 'QUOTATION',
            changedById,
            note: `Created from quotation template ${template.name}`,
          },
        },
      },
      include: {
        customer: true,
        plan: true,
        lines: { include: { product: true, variant: true, tax: true }, orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
  });
}
