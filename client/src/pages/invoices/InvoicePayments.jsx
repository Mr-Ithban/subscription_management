import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, CheckCircle2 } from 'lucide-react';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

const PAYMENT_METHODS = [
  'CARD',
  'UPI',
  'BANK_TRANSFER',
  'CASH',
  'CHEQUE',
  'ONLINE',
];

export default function InvoicePayments({ invoice: initialInvoice = {}, onPaymentRecorded }) {
  const { invoiceId } = useParams();
  const targetInvoiceId = initialInvoice.id || invoiceId;
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: fetchedInvoice, isLoading: invoiceLoading } = useQuery({
    queryKey: ['invoice', targetInvoiceId],
    queryFn: async () => (await api.get(`/api/invoices/${targetInvoiceId}`)).data.invoice,
    enabled: Boolean(targetInvoiceId),
    initialData: initialInvoice.id ? initialInvoice : undefined,
  });
  const invoice = fetchedInvoice || initialInvoice;
  const remainingBalance = Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0));

  const [formData, setFormData] = useState({
    method: 'CARD',
    amount: remainingBalance,
    paidAt: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [formError, setFormError] = useState('');

  // Fetch payments for this invoice
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['invoice-payments', invoice.id],
    queryFn: async () => {
      const res = await api.get(`/api/invoices/${invoice.id}/payments`);
      return res.data.data || [];
    },
    enabled: !!invoice?.id,
  });

  const recordMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/api/invoices/${invoice.id}/payments`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['invoice-payments', invoice.id]);
      queryClient.invalidateQueries(['invoice', invoice.id]);
      setIsModalOpen(false);
      setFormError('');
      if (onPaymentRecorded) onPaymentRecorded();
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.error?.message || 'Failed to record payment.'
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const amountInt = parseInt(formData.amount, 10);
    if (!amountInt || amountInt <= 0) {
      setFormError('Amount must be a positive integer.');
      return;
    }
    if (amountInt > remainingBalance) {
      setFormError(`Amount cannot exceed remaining balance of ₹${remainingBalance}.`);
      return;
    }

    recordMutation.mutate({
      method: formData.method,
      amount: amountInt,
      paidAt: formData.paidAt ? new Date(formData.paidAt).toISOString() : new Date().toISOString(),
      note: formData.note || undefined,
    });
  };

  const isConfirmed = invoice.status === 'CONFIRMED';
  const isPaid = invoice.status === 'PAID';

  if (invoiceLoading) return <div className="rounded-lg bg-white p-6 text-gray-500">Loading invoice…</div>;
  if (!invoice.id) return <div role="alert" className="rounded-lg bg-white p-6 text-rose-700">Invoice not found.</div>;

  return (
    <div className="bg-white rounded-lg shadow ring-1 ring-black ring-opacity-5 p-6 mb-6">
      <div className="sm:flex sm:items-center sm:justify-between pb-4 border-b border-gray-200 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            Payments & Transactions
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Total: ₹{invoice.total} • Paid: ₹{invoice.amountPaid || 0} • Balance: ₹{remainingBalance}
          </p>
        </div>

        {isConfirmed && remainingBalance > 0 && (
          <button
            onClick={() => {
              setFormData({
                method: 'CARD',
                amount: remainingBalance,
                paidAt: new Date().toISOString().slice(0, 10),
                note: '',
              });
              setFormError('');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        )}

        {isPaid && (
          <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="h-5 w-5" />
            Fully Paid
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3 py-4">
          <div className="h-8 bg-gray-100 rounded w-full"></div>
          <div className="h-8 bg-gray-100 rounded w-full"></div>
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No payments recorded for this invoice yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {payments.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  <span>₹{p.amount}</span>
                  <StatusBadge status={p.method} />
                </div>
                {p.note && <p className="text-xs text-gray-500 mt-0.5">{p.note}</p>}
              </div>
              <div className="text-right text-xs text-gray-500">
                {new Date(p.paidAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Record Payment for ${invoice.number || 'Invoice'}`}
      >
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <FormField label="Payment Method" required>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Amount (₹)" required>
            <input
              type="number"
              min="1"
              max={remainingBalance}
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Remaining balance: ₹{remainingBalance}</p>
          </FormField>

          <FormField label="Payment Date" required>
            <input
              type="date"
              value={formData.paidAt}
              onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              required
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              rows={2}
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="e.g. Transaction ID, UPI reference"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </FormField>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordMutation.isPending}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {recordMutation.isPending ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

