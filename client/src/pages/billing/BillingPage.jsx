import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowLeft, Check, FileText, Layers, Mail, X } from 'lucide-react';
import { downloadInvoicePdf, getRequestError, getSessionToken, getStaffInvoices, getStaffSubscriptions, runInvoiceAction, runSubscriptionAction } from '../../api/billing';

const money = (amount = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const statusClass = {
  ACTIVE: 'bg-emerald-400/10 text-emerald-300',
  CONFIRMED: 'bg-sky-400/10 text-sky-300',
  PAID: 'bg-emerald-400/10 text-emerald-300',
  DRAFT: 'bg-amber-400/10 text-amber-300',
  QUOTATION: 'bg-violet-400/10 text-violet-300',
  CLOSED: 'bg-slate-700 text-slate-300',
  CANCELLED: 'bg-rose-400/10 text-rose-300',
};

function Status({ value }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[value] || 'bg-slate-700 text-slate-300'}`}>{value}</span>;
}

function AuthNotice() {
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-100">
      Sign in with an authorized staff account to view billing records. This page uses the current app session.
    </div>
  );
}

function SubscriptionTable({ subscriptions, onTransition, busyId }) {
  const actionByStatus = { DRAFT: ['quote', 'Create quotation'], QUOTATION: ['confirm', 'Confirm'], CONFIRMED: ['activate', 'Activate'], ACTIVE: ['close', 'Close'] };
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Subscription</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Plan</th><th className="px-5 py-4">Start</th><th className="px-5 py-4">Next bill</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Action</th></tr></thead>
        <tbody className="divide-y divide-slate-800">
          {subscriptions.map((item) => {
            const action = actionByStatus[item.status];
            return <tr key={item.id} className="text-slate-300">
              <td className="px-5 py-4 font-medium text-white">{item.number}</td><td className="px-5 py-4">{item.customer?.name || '—'}</td><td className="px-5 py-4">{item.plan?.name || '—'}</td><td className="px-5 py-4">{date(item.startDate)}</td><td className="px-5 py-4">{date(item.nextBillingDate)}</td><td className="px-5 py-4"><Status value={item.status} /></td>
              <td className="px-5 py-4">{action ? <button disabled={busyId === item.id} onClick={() => onTransition(item.id, action[0])} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50">{busyId === item.id ? 'Saving…' : action[1]}</button> : '—'}</td>
            </tr>;
          })}
          {!subscriptions.length && <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-500">No subscriptions found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceTable({ invoices, onAction, busyId }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Invoice</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Issue date</th><th className="px-5 py-4">Due date</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-800">
          {invoices.map((item) => <tr key={item.id} className="text-slate-300">
            <td className="px-5 py-4 font-medium text-white">{item.number}</td><td className="px-5 py-4">{item.customer?.name || '—'}</td><td className="px-5 py-4">{date(item.issueDate)}</td><td className="px-5 py-4">{date(item.dueDate)}</td><td className="px-5 py-4 font-medium">{money(item.total)}</td><td className="px-5 py-4"><Status value={item.status} /></td>
            <td className="px-5 py-4"><div className="flex gap-2">
              {item.status === 'DRAFT' && <button disabled={busyId === item.id} title="Confirm" onClick={() => onAction(item.id, 'confirm')} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800"><Check size={15} /></button>}
              {['DRAFT', 'CONFIRMED'].includes(item.status) && <button disabled={busyId === item.id} title="Cancel" onClick={() => onAction(item.id, 'cancel')} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800"><X size={15} /></button>}
              {item.status === 'CONFIRMED' && <button disabled={busyId === item.id} title="Email invoice" onClick={() => onAction(item.id, 'send')} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800"><Mail size={15} /></button>}
              <button title="Download PDF" onClick={() => downloadInvoicePdf(item.id).catch(() => {})} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800"><ArrowDownToLine size={15} /></button>
            </div></td>
          </tr>)}
          {!invoices.length && <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-500">No invoices found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function BillingPage() {
  const [tab, setTab] = useState('subscriptions');
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const token = getSessionToken();
  const subscriptions = useQuery({ queryKey: ['staff-subscriptions'], queryFn: getStaffSubscriptions, enabled: Boolean(token) });
  const invoices = useQuery({ queryKey: ['staff-invoices'], queryFn: getStaffInvoices, enabled: Boolean(token) });
  const mutation = useMutation({
    mutationFn: ({ id, action, type }) => type === 'subscription' ? runSubscriptionAction(id, action) : runInvoiceAction(id, action),
    onMutate: ({ id }) => { setBusyId(id); setNotice(''); },
    onSuccess: (_data, variables) => {
      setNotice(variables.action === 'send' ? 'Invoice emailed to the customer.' : 'Update saved.');
      queryClient.invalidateQueries({ queryKey: variables.type === 'subscription' ? ['staff-subscriptions'] : ['staff-invoices'] });
    },
    onError: (error) => setNotice(getRequestError(error)),
    onSettled: () => setBusyId(''),
  });

  const query = tab === 'subscriptions' ? subscriptions : invoices;
  const rows = tab === 'subscriptions' ? subscriptions.data?.subscriptions : invoices.data?.invoices;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Brightloop</Link><Link to="/portal" className="text-sm text-indigo-300 hover:text-indigo-200">Customer portal</Link></div></header>
      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Member billing</p><h1 className="mt-2 text-3xl font-bold text-white">Subscriptions and invoices</h1><p className="mt-2 text-sm text-slate-400">Review subscriptions, manage lifecycle transitions, and handle invoice actions.</p></div>
        {!token ? <AuthNotice /> : <>
          <div className="flex gap-2 border-b border-slate-800">
            <button onClick={() => setTab('subscriptions')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${tab === 'subscriptions' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400'}`}><Layers size={16} />Subscriptions</button>
            <button onClick={() => setTab('invoices')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${tab === 'invoices' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400'}`}><FileText size={16} />Invoices</button>
          </div>
          {notice && <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">{notice}</p>}
          {query.isLoading ? <p className="py-12 text-center text-slate-500">Loading billing records…</p> : query.isError ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">{getRequestError(query.error)}</p> : tab === 'subscriptions'
            ? <SubscriptionTable subscriptions={rows || []} busyId={busyId} onTransition={(id, action) => mutation.mutate({ id, action, type: 'subscription' })} />
            : <InvoiceTable invoices={rows || []} busyId={busyId} onAction={(id, action) => mutation.mutate({ id, action, type: 'invoice' })} />}
        </>}
      </div>
    </main>
  );
}
