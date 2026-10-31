import { jest } from '@jest/globals';
import { cancelInvoice, confirmInvoice, getInvoice, InvoiceError, listInvoices, renderInvoicePdf, sendInvoice } from './invoices.js';

function fakePrisma({ status = 'DRAFT', payments = [] } = {}) {
  const state = { status };
  const invoice = {
    id: 'invoice_1',
    number: 'INV-20260101-ABC123',
    status: state.status,
    issueDate: new Date('2026-01-01T00:00:00Z'),
    dueDate: new Date('2026-01-15T00:00:00Z'),
    subtotal: 2500,
    taxTotal: 450,
    discountTotal: 250,
    total: 2700,
    customerId: 'customer_1',
    customer: { name: 'Customer <A>', user: { email: 'customer@example.com' } },
    subscription: { id: 'sub_1', number: 'SUB-1' },
    lines: [{ description: 'Product & service', quantity: 1, unitPrice: 2500, amount: 2500 }],
    discounts: [],
    payments,
  };
  const tx = {
    invoice: {
      findUnique: jest.fn(async () => ({ ...invoice, status: state.status, payments })),
      updateMany: jest.fn(async ({ where, data }) => {
        if (where.status !== state.status) return { count: 0 };
        state.status = data.status;
        return { count: 1 };
      }),
    },
  };
  const invoiceModel = {
    count: jest.fn(async () => 1),
    findMany: jest.fn(async () => [invoice]),
    findUnique: jest.fn(async () => ({ ...invoice, status: state.status, payments })),
  };
  return {
    state,
    invoiceRecord: invoice,
    tx,
    $transaction: jest.fn(async (callback) => callback(tx)),
    invoice: invoiceModel,
    invoiceModel,
  };
}

describe('invoice actions', () => {
  it('confirms only draft invoices and rejects repeated or invalid confirmation', async () => {
    const prisma = fakePrisma();
    await confirmInvoice(prisma, 'invoice_1');
    expect(prisma.state.status).toBe('CONFIRMED');

    await expect(confirmInvoice(prisma, 'invoice_1')).rejects.toMatchObject({ statusCode: 409 });
    prisma.tx.invoice.findUnique.mockResolvedValueOnce(null);
    await expect(confirmInvoice(prisma, 'missing')).rejects.toBeInstanceOf(InvoiceError);
  });

  it('cancels draft or confirmed invoices only when no payment is recorded', async () => {
    const prisma = fakePrisma({ status: 'CONFIRMED' });
    await cancelInvoice(prisma, 'invoice_1');
    expect(prisma.state.status).toBe('CANCELLED');

    const paidPartially = fakePrisma({ status: 'CONFIRMED', payments: [{ id: 'payment_1', amount: 1 }] });
    await expect(cancelInvoice(paidPartially, 'invoice_1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('lists and retrieves invoice details with pagination', async () => {
    const prisma = fakePrisma();
    const result = await listInvoices(prisma, { page: 2, limit: 5, status: 'DRAFT' });
    expect(prisma.invoiceModel.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5, where: { status: 'DRAFT' } }));
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 1, pages: 1 });

    prisma.invoice.findUnique.mockResolvedValueOnce(null);
    await expect(getInvoice(prisma, 'missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sends confirmed invoices to the customer email and rejects drafts', async () => {
    const prisma = fakePrisma({ status: 'CONFIRMED' });
    const mailer = jest.fn(async () => ({ messageId: 'mail_1' }));
    const result = await sendInvoice(prisma, 'invoice_1', mailer);
    expect(mailer).toHaveBeenCalledWith(expect.objectContaining({ to: 'customer@example.com' }));
    expect(mailer.mock.calls[0][0].html).toContain('&lt;A&gt;');
    expect(result.recipient).toBe('customer@example.com');

    const draft = fakePrisma({ status: 'DRAFT' });
    await expect(sendInvoice(draft, 'invoice_1', mailer)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('renders invoice details as a PDF buffer', async () => {
    const { invoiceRecord } = fakePrisma({ status: 'CONFIRMED' });
    const pdf = await renderInvoicePdf(invoiceRecord);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
