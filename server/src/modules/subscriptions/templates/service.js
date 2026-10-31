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
