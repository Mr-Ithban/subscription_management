import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowLeft, FileText, Layers } from 'lucide-react';
import { downloadInvoicePdf, getPortalInvoices, getPortalSubscriptions, getRequestError, getSessionToken } from '../../api/billing';

const money = (amount = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Status({ value }) {
  const tone = value === 'ACTIVE' || value === 'PAID' ? 'text-emerald-300 bg-emerald-400/10' : value === 'CANCELLED' || value === 'CLOSED' ? 'text-slate-300 bg-slate-700' : 'text-indigo-200 bg-indigo-400/10';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

function LoginNotice() {
  return <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-100">Sign in with your customer account to view your subscriptions and invoices. Your records are private to your account.</div>;
}

export default function PortalPage() {
  const [tab, setTab] = useState('subscriptions');
  const token = getSessionToken();
  const subscriptions = useQuery({ queryKey: ['portal-subscriptions'], queryFn: getPortalSubscriptions, enabled: Boolean(token) });
  const invoices = useQuery({ queryKey: ['portal-invoices'], queryFn: getPortalInvoices, enabled: Boolean(token) });
  const query = tab === 'subscriptions' ? subscriptions : invoices;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Brightloop</Link><Link to="/billing" className="text-sm text-indigo-300 hover:text-indigo-200">Staff billing</Link></div></header>
      <div className="mx-auto max-w-6xl space-y-7 px-5 py-8">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Your account</p><h1 className="mt-2 text-3xl font-bold text-white">Subscription portal</h1><p className="mt-2 text-sm text-slate-400">View your current plans, billing periods, and invoice history.</p></div>
        {!token ? <LoginNotice /> : <>
          <div className="flex gap-2 border-b border-slate-800">
            <button onClick={() => setTab('subscriptions')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${tab === 'subscriptions' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400'}`}><Layers size={16} />Subscriptions</button>
            <button onClick={() => setTab('invoices')} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${tab === 'invoices' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400'}`}><FileText size={16} />Invoices</button>
          </div>
          {query.isLoading ? <p className="py-12 text-center text-slate-500">Loading your records…</p> : query.isError ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">{getRequestError(query.error)}</p> : tab === 'subscriptions'
            ? <div className="grid gap-4 md:grid-cols-2">{(subscriptions.data?.subscriptions || []).map((item) => <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-slate-500">{item.number}</p><h2 className="mt-1 text-lg font-semibold text-white">{item.plan?.name || 'Subscription plan'}</h2></div><Status value={item.status} /></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Started</dt><dd className="mt-1 text-slate-200">{date(item.startDate)}</dd></div><div><dt className="text-slate-500">Next billing</dt><dd className="mt-1 text-slate-200">{date(item.nextBillingDate)}</dd></div><div><dt className="text-slate-500">Plan period</dt><dd className="mt-1 text-slate-200">{item.plan?.billingPeriod || '—'}</dd></div><div><dt className="text-slate-500">Invoices</dt><dd className="mt-1 text-slate-200">{item.invoices?.length || 0}</dd></div></dl></article>)}{!subscriptions.data?.subscriptions?.length && <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-500 md:col-span-2">No subscriptions found.</p>}</div>
            : <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Invoice</th><th className="px-5 py-4">Period</th><th className="px-5 py-4">Due date</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">PDF</th></tr></thead><tbody className="divide-y divide-slate-800">{(invoices.data?.invoices || []).map((item) => <tr key={item.id} className="text-slate-300"><td className="px-5 py-4 font-medium text-white">{item.number}</td><td className="px-5 py-4">{date(item.periodStart)} – {date(item.periodEnd)}</td><td className="px-5 py-4">{date(item.dueDate)}</td><td className="px-5 py-4">{money(item.total)}</td><td className="px-5 py-4"><Status value={item.status} /></td><td className="px-5 py-4"><button title="Download invoice PDF" onClick={() => downloadInvoicePdf(item.id, true).catch(() => {})} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800"><ArrowDownToLine size={15} /></button></td></tr>)}{!invoices.data?.invoices?.length && <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">No invoices found.</td></tr>}</tbody></table></div>}
        </>}
      </div>
    </main>
  );
}
