import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Box, Check, CreditCard, FileText, Layers3, ShieldCheck, Sparkles, Users } from 'lucide-react';
import HealthCard from '../components/HealthCard';
import { useAuth } from '../auth/useAuth';

const features = [
  { icon: Box, title: 'Product catalog', text: 'Manage products, variants, plans, tax rules, and discounts.', href: '/app/catalog' },
  { icon: Layers3, title: 'Subscriptions', text: 'Create quotations and follow each subscription through its lifecycle.', href: '/app/subscriptions' },
  { icon: FileText, title: 'Billing and invoices', text: 'Generate recurring invoices, send them, and download PDFs.', href: '/app/invoices' },
  { icon: CreditCard, title: 'Payments', text: 'Record payments and track balances, outstanding invoices, and overdue accounts.', href: '/app/invoices' },
  { icon: BarChart3, title: 'Finance reports', text: 'Review revenue trends, recurring revenue, and subscription health.', href: '/app/reports/dashboard' },
  { icon: Users, title: 'Customer portal', text: 'Give customers a private view of their subscriptions, invoices, and payments.', href: '/portal' },
];

export default function LandingPage() {
  const { isAuthenticated, role } = useAuth();
  const destination = role === 'CUSTOMER' ? '/portal' : '/app';
  const visibleFeatures = role === 'CUSTOMER'
    ? features.filter((feature) => feature.title === 'Customer portal')
    : features.filter((feature) => feature.title !== 'Customer portal');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Brightloop home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg shadow-lg shadow-indigo-900/40">⚡</span>
            <span><strong className="block text-base tracking-tight text-white">Brightloop Software</strong><span className="text-xs text-slate-400">Subscription management</span></span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? <Link to={destination} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">Open workspace <ArrowRight size={16} /></Link> : <>
              <Link to="/login" className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">Sign in</Link>
              <Link to="/signup" className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">Create account</Link>
            </>}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-medium text-indigo-200"><Sparkles size={14} /> Subscription operations, in one place</div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">Every subscription. <span className="text-indigo-300">Under control.</span></h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Manage your catalog, customer agreements, recurring invoices, payments, and revenue reporting from one workspace built for Brightloop Software.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={isAuthenticated ? destination : '/login'} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 hover:bg-indigo-400">{isAuthenticated ? 'Go to workspace' : 'Sign in to workspace'} <ArrowRight size={16} /></Link>
              {!isAuthenticated && <Link to="/signup" className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900">Create customer account</Link>}
            </div>
            <ul className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {['Role-based access', 'Recurring billing', 'Invoice PDF and payment tracking', 'Customer self-service portal'].map((item) => <li key={item} className="flex items-center gap-2"><Check size={16} className="text-emerald-400" />{item}</li>)}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Platform status</p><h2 className="mt-1 text-lg font-semibold text-white">Live service check</h2></div><ShieldCheck className="text-indigo-300" /></div>
            <HealthCard />
          </div>
        </section>

        <section aria-labelledby="features-heading" className="border-t border-slate-800 pt-12">
          <div className="mb-6 max-w-2xl"><p className="text-sm font-semibold text-indigo-300">One connected workflow</p><h2 id="features-heading" className="mt-2 text-2xl font-bold text-white sm:text-3xl">From first product to paid invoice</h2><p className="mt-3 text-sm leading-6 text-slate-400">The tools your team needs to manage subscription operations and keep customer billing clear.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFeatures.map(({ icon: Icon, title, text, href }) => <Link key={title} to={href} className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:-translate-y-0.5 hover:border-indigo-400/40 hover:bg-slate-900"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-400/10 text-indigo-300"><Icon size={20} /></span><h3 className="mt-4 flex items-center justify-between font-semibold text-white">{title}<ArrowRight size={15} className="text-slate-500 transition group-hover:text-indigo-300" /></h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></Link>)}
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-800 px-5 py-6 text-center text-xs text-slate-500">Brightloop Software · Subscription Management</footer>
    </div>
  );
}
