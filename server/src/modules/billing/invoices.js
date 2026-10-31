import PDFDocument from 'pdfkit';
import { sendMail } from '../../utils/mailer.js';

export class InvoiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'InvoiceError';
    this.statusCode = statusCode;
  }
}

const invoiceInclude = {
  customer: { include: { user: { select: { email: true } } } },
  subscription: { select: { id: true, number: true } },
  lines: { orderBy: { createdAt: 'asc' } },
  discounts: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { paidAt: 'asc' } },
};

export async function listInvoices(prisma, { page, limit, status, customerId }) {
  const where = { ...(status && { status }), ...(customerId && { customerId }) };
  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: invoiceInclude,
      orderBy: { issueDate: 'desc' },
    }),
  ]);
  return { invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getInvoice(prisma, id) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw new InvoiceError('Invoice not found', 404);
  return invoice;
}

export async function confirmInvoice(prisma, id) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!invoice) throw new InvoiceError('Invoice not found', 404);
    if (invoice.status !== 'DRAFT') throw new InvoiceError(`Cannot confirm an invoice in ${invoice.status} status`, 409);
    const changed = await tx.invoice.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'CONFIRMED' } });
    if (changed.count !== 1) throw new InvoiceError('Invoice status changed concurrently; retry the request', 409);
    return tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
  });
}

export async function cancelInvoice(prisma, id) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { payments: { select: { id: true, amount: true } } } });
    if (!invoice) throw new InvoiceError('Invoice not found', 404);
    if (!['DRAFT', 'CONFIRMED'].includes(invoice.status)) {
      throw new InvoiceError(`Cannot cancel an invoice in ${invoice.status} status`, 409);
    }
    if (invoice.payments.some((payment) => payment.amount > 0)) {
      throw new InvoiceError('An invoice with recorded payments cannot be cancelled', 409);
    }
    const changed = await tx.invoice.updateMany({ where: { id, status: invoice.status }, data: { status: 'CANCELLED' } });
    if (changed.count !== 1) throw new InvoiceError('Invoice status changed concurrently; retry the request', 409);
    return tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
  });
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function currency(amount) {
  return `₹${(amount / 100).toFixed(2)}`;
}

export async function sendInvoice(prisma, id, mailer = sendMail) {
  const invoice = await getInvoice(prisma, id);
  if (invoice.status !== 'CONFIRMED') throw new InvoiceError('Only confirmed invoices can be sent', 409);
  const recipient = invoice.customer?.user?.email;
  if (!recipient) throw new InvoiceError('Customer does not have an email address', 400);
  const rows = invoice.lines.map((line) => `<tr><td>${escapeHtml(line.description)}</td><td>${line.quantity}</td><td>${currency(line.amount)}</td></tr>`).join('');
  await mailer({
    to: recipient,
    subject: `Invoice ${invoice.number} from Brightloop Software`,
    html: `<p>Hello ${escapeHtml(invoice.customer.name)},</p><p>Invoice <strong>${escapeHtml(invoice.number)}</strong> is due on ${invoice.dueDate.toISOString().slice(0, 10)}.</p><table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p>Subtotal: ${currency(invoice.subtotal)}</p><p>Tax: ${currency(invoice.taxTotal)}</p><p>Discount: ${currency(invoice.discountTotal)}</p><p><strong>Total due: ${currency(invoice.total)}</strong></p>`,
  });
  return { message: 'Invoice sent successfully', invoiceId: invoice.id, recipient };
}

export async function renderInvoicePdf(invoice) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(22).text('Brightloop Software', { continued: false });
  doc.moveDown(0.3).fontSize(16).text(`Invoice ${invoice.number}`);
  doc.fontSize(10).text(`Status: ${invoice.status}`);
  doc.text(`Issue date: ${invoice.issueDate.toISOString().slice(0, 10)}`);
  doc.text(`Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`);
  doc.moveDown().fontSize(12).text(`Bill to: ${invoice.customer.name}`);
  doc.fontSize(10).text(invoice.customer.user?.email ?? '');
  doc.moveDown().font('Helvetica-Bold').text('Description', 48, doc.y, { continued: true, width: 270 });
  doc.text('Qty', 320, doc.y, { continued: true, width: 50 });
  doc.text('Unit price', 370, doc.y, { continued: true, width: 90 });
  doc.text('Amount', 460, doc.y);
  doc.font('Helvetica');
  for (const line of invoice.lines) {
    doc.text(line.description, 48, doc.y, { continued: true, width: 270 });
    doc.text(String(line.quantity), 320, doc.y, { continued: true, width: 50 });
    doc.text(currency(line.unitPrice), 370, doc.y, { continued: true, width: 90 });
    doc.text(currency(line.amount), 460, doc.y);
  }
  doc.moveDown();
  doc.text(`Subtotal: ${currency(invoice.subtotal)}`, { align: 'right' });
  doc.text(`Tax: ${currency(invoice.taxTotal)}`, { align: 'right' });
  doc.text(`Discount: ${currency(invoice.discountTotal)}`, { align: 'right' });
  doc.font('Helvetica-Bold').text(`Total: ${currency(invoice.total)}`, { align: 'right' });
  doc.end();
  return finished;
}
