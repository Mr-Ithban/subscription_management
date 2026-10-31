import { randomBytes } from 'node:crypto';

export class SubscriptionError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'SubscriptionError';
    this.statusCode = statusCode;
  }
}

const includeSubscription = {
  customer: true,
  plan: true,
  lines: { include: { product: true, variant: true, tax: true }, orderBy: { createdAt: 'asc' } },
  history: { include: { changedBy: { select: { id: true, email: true } } }, orderBy: { createdAt: 'asc' } },
};

const allowedTransitions = {
  DRAFT: 'QUOTATION',
  QUOTATION: 'CONFIRMED',
  CONFIRMED: 'ACTIVE',
  ACTIVE: 'CLOSED',
  CLOSED: null,
};

const transitionRouteStatus = {
  quote: 'QUOTATION',
  confirm: 'CONFIRMED',
  activate: 'ACTIVE',
  close: 'CLOSED',
};

export function statusForTransitionAction(action) {
  return transitionRouteStatus[action];
}

async function requireCustomer(prisma, customerId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new SubscriptionError('Customer not found', 404);
}

async function requirePlan(prisma, planId, startDate) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new SubscriptionError('Plan not found', 404);
  if (plan.status !== 'ACTIVE') throw new SubscriptionError('Plan is not active', 400);
  if (startDate && startDate < plan.startDate) throw new SubscriptionError('Subscription starts before plan availability', 400);
  if (startDate && plan.endDate && startDate > plan.endDate) throw new SubscriptionError('Plan is not available on the subscription start date', 400);
  return plan;
}

async function buildLineData(prisma, lines) {
  const result = [];
  for (const line of lines) {
    const product = await prisma.product.findUnique({ where: { id: line.productId } });
    if (!product || !product.active) throw new SubscriptionError(`Active product not found: ${line.productId}`, 404);
    let variant = null;
    if (line.variantId) {
      variant = await prisma.productVariant.findUnique({ where: { id: line.variantId } });
      if (!variant || variant.productId !== product.id) throw new SubscriptionError('Variant does not belong to the selected product', 400);
    }
    if (line.taxId) {
      const tax = await prisma.tax.findUnique({ where: { id: line.taxId } });
      if (!tax || !tax.active) throw new SubscriptionError(`Active tax not found: ${line.taxId}`, 404);
    }

    const unitPrice = product.salesPrice + (variant?.extraPrice ?? 0);
    const amount = unitPrice * line.quantity;
    if (!Number.isSafeInteger(unitPrice) || !Number.isSafeInteger(amount)) {
      throw new SubscriptionError('Subscription line amount exceeds the supported range', 400);
    }
    result.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      taxId: line.taxId ?? null,
      quantity: line.quantity,
      unitPrice,
      amount,
    });
  }
  return result;
}

export function newSubscriptionNumber() {
  return `SUB-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function listSubscriptions(prisma, { page, limit, status, customerId, search }) {
  const where = { ...(status && { status }), ...(customerId && { customerId }) };
  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { plan: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  const [total, subscriptions] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: includeSubscription,
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { subscriptions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getSubscription(prisma, id) {
  const subscription = await prisma.subscription.findUnique({ where: { id }, include: includeSubscription });
  if (!subscription) throw new SubscriptionError('Subscription not found', 404);
  return subscription;
}

export async function createSubscription(prisma, data) {
  await requireCustomer(prisma, data.customerId);
  const plan = await requirePlan(prisma, data.planId, data.startDate);
  const lineData = await buildLineData(prisma, data.lines);
  const totalQuantity = lineData.reduce((sum, line) => sum + line.quantity, 0);
  if (totalQuantity < plan.minQty) throw new SubscriptionError(`Plan requires a minimum quantity of ${plan.minQty}`, 400);

  const subscriptionData = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'lines'));
  return prisma.subscription.create({
    data: {
      ...subscriptionData,
      number: newSubscriptionNumber(),
      lines: { create: lineData },
    },
    include: includeSubscription,
  });
}

export async function updateSubscription(prisma, id, data) {
  await getSubscription(prisma, id);
  if (data.customerId) await requireCustomer(prisma, data.customerId);
  const current = await prisma.subscription.findUnique({
    where: { id },
    select: { planId: true, startDate: true, lines: { select: { quantity: true } } },
  });
  const planId = data.planId ?? current.planId;
  const startDate = data.startDate ?? current.startDate;
  const plan = (data.planId || data.startDate || data.lines !== undefined)
    ? await requirePlan(prisma, planId, startDate)
    : null;
  const lineData = data.lines === undefined ? undefined : await buildLineData(prisma, data.lines);
  const quantities = lineData?.map((line) => line.quantity) ?? current.lines.map((line) => line.quantity);
  if (plan && quantities.reduce((sum, quantity) => sum + quantity, 0) < plan.minQty) {
    throw new SubscriptionError(`Plan requires a minimum quantity of ${plan.minQty}`, 400);
  }

  const subscriptionData = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'lines'));
  return prisma.$transaction(async (tx) => {
    if (lineData !== undefined) await tx.subscriptionLine.deleteMany({ where: { subscriptionId: id } });
    return tx.subscription.update({
      where: { id },
      data: { ...subscriptionData, ...(lineData !== undefined && { lines: { create: lineData } }) },
      include: includeSubscription,
    });
  });
}

export async function transitionSubscription(prisma, id, toStatus, { changedById = null, note = null } = {}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findUnique({
      where: { id },
      select: { id: true, status: true, expiryDate: true, plan: { select: { allowEarlyClose: true } } },
    });
    if (!current) throw new SubscriptionError('Subscription not found', 404);
    if (allowedTransitions[current.status] !== toStatus) {
      throw new SubscriptionError(`Invalid subscription transition: ${current.status} to ${toStatus}`, 409);
    }
    if (toStatus === 'CLOSED' && !current.plan.allowEarlyClose && (!current.expiryDate || current.expiryDate > new Date())) {
      throw new SubscriptionError('The plan does not allow early closure', 409);
    }

    const changed = await tx.subscription.updateMany({
      where: { id, status: current.status },
      data: { status: toStatus },
    });
    if (changed.count !== 1) throw new SubscriptionError('Subscription status changed concurrently; retry the request', 409);

    await tx.subscriptionHistory.create({
      data: { subscriptionId: id, fromStatus: current.status, toStatus, changedById, note },
    });
    return tx.subscription.findUnique({ where: { id }, include: includeSubscription });
  });
}
