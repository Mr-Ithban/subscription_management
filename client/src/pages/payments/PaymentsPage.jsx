import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, ExternalLink } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { formatMinorCurrency } from '../../utils/currency';

const methods = ['CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE'];

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [method, setMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const query = useQuery({ queryKey: ['payments-list', page, method, dateFrom, dateTo], queryFn: async () => (await api.get('/api/payments', { params: { page, limit: 15, ...(method && { method }), ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) } })).data, placeholderData: (previous) => previous });
  const columns = [
    { header: 'Invoice', accessor: 'invoice', render: (payment) => <Link to={`/app/invoices/${payment.invoiceId}/payments`} className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline">{payment.invoice?.number || 'Invoice'} <ExternalLink size={13} /></Link> },
    { header: 'Method', accessor: 'method', render: (payment) => <StatusBadge status={payment.method} /> },
    { header: 'Amount', accessor: 'amount', render: (payment) => <span className="font-semibold text-emerald-700">{formatMinorCurrency(payment.amount)}</span> },
    { header: 'Paid at', accessor: 'paidAt', render: (payment) => new Date(payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
    { header: 'Invoice status', accessor: 'invoice', render: (payment) => <StatusBadge status={payment.invoice?.status} /> },
    { header: 'Note', accessor: 'note', render: (payment) => payment.note || '—' },
  ];

  return <div className="space-y-6"><PageHeader title="Payments" description="Review recorded payments, narrow the ledger by method and date, and open invoice details."><span className="inline-flex items-center gap-2 text-sm text-slate-500"><CreditCard size={17} />{query.data?.total || 0} records</span></PageHeader>
    <div className="flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5"><label className="grid gap-1 text-xs text-slate-500">Payment method<select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All methods</option>{methods.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1 text-xs text-slate-500">From<input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs text-slate-500">To<input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label></div>
    {query.isError && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{query.error?.response?.data?.error?.message || 'Could not load payments.'}</p>}
    <DataTable columns={columns} data={query.data?.data || []} isLoading={query.isLoading} emptyMessage="No payments match these filters." pagination={{ page, limit: query.data?.limit || 15, total: query.data?.total || 0 }} onPageChange={setPage} />
  </div>;
}
