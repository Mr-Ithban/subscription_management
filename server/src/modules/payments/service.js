export class PaymentError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'PaymentError';
    this.statusCode = statusCode;
  }
}

/**
 * Records a payment against a CONFIRMED invoice atomically.
 * Updates invoice.amountPaid and sets status to PAID when settled in full.
 * Protects against race conditions / overpayment via conditional OCC update.
 */
export async function recordPayment(prisma, { invoiceId, paymentData, user }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new PaymentError(404, 'Invoice not found');
  }

  if (invoice.status === 'PAID') {
    throw new PaymentError(409, 'Invoice is already paid in full');
  }

  if (invoice.status === 'DRAFT') {
    throw new PaymentError(409, 'Payments can only be recorded for CONFIRMED invoices');
  }

  if (invoice.status === 'CANCELLED') {
    throw new PaymentError(409, 'Cannot record payment for a CANCELLED invoice');
  }

  if (invoice.status !== 'CONFIRMED') {
    throw new PaymentError(409, `Cannot record payment for invoice with status ${invoice.status}`);
  }

  const currentAmountPaid = invoice.amountPaid || 0;
  const remainingBalance = invoice.total - currentAmountPaid;

  if (paymentData.amount > remainingBalance) {
    throw new PaymentError(
      400,
      `Payment amount (${paymentData.amount}) cannot exceed remaining balance (${remainingBalance})`
    );
  }

  const newAmountPaid = currentAmountPaid + paymentData.amount;
  const nextStatus = newAmountPaid === invoice.total ? 'PAID' : 'CONFIRMED';
  const paidAtDate = paymentData.paidAt ? new Date(paymentData.paidAt) : new Date();

  const executeTransaction = async (tx) => {
    // Conditional update row lock / optimistic concurrency guard:
    // Ensures invoice was not concurrently paid or modified
    const updateResult = await tx.invoice.updateMany({
      where: {
        id: invoiceId,
        status: 'CONFIRMED',
        amountPaid: currentAmountPaid,
        total: { gte: currentAmountPaid + paymentData.amount },
      },
      data: {
        amountPaid: newAmountPaid,
        status: nextStatus,
      },
    });

    if (updateResult.count === 0) {
      throw new PaymentError(
        409,
        'Concurrent payment conflict: invoice balance or status was modified. Please retry.'
      );
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        method: paymentData.method,
        amount: paymentData.amount,
        paidAt: paidAtDate,
        note: paymentData.note || null,
        createdById: user?.id || null,
      },
    });

    return {
      payment,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: nextStatus,
        total: invoice.total,
        amountPaid: newAmountPaid,
        remainingBalance: invoice.total - newAmountPaid,
      },
    };
  };

  if (typeof prisma.$transaction === 'function') {
    return await prisma.$transaction(executeTransaction);
  }

  return await executeTransaction(prisma);
}

/**
 * Lists paginated payments with optional filtering by invoiceId, method, dateFrom, dateTo.
 */
export async function listPayments(prisma, { filters = {}, pagination = { page: 1, limit: 20, skip: 0 } }) {
  const where = {};

  if (filters.invoiceId) {
    where.invoiceId = filters.invoiceId;
  }

  if (filters.method) {
    where.method = filters.method;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.paidAt = {};
    if (filters.dateFrom) {
      where.paidAt.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.paidAt.lte = new Date(filters.dateTo);
    }
  }

  const [total, data] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { paidAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            total: true,
            amountPaid: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return {
    data,
    page: pagination.page,
    limit: pagination.limit,
    total,
  };
}

/**
 * Lists payments for a specific invoice with pagination.
 */
export async function listInvoicePayments(prisma, { invoiceId, pagination = { page: 1, limit: 20, skip: 0 } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new PaymentError(404, 'Invoice not found');
  }

  const where = { invoiceId };

  const [total, data] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { paidAt: 'desc' },
    }),
  ]);

  return {
    data,
    page: pagination.page,
    limit: pagination.limit,
    total,
  };
}

