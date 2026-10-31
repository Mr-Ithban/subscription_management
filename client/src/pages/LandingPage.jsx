import HealthCard from '../components/HealthCard';
import { Link } from 'react-router-dom';
import { Layers, ShieldCheck, Box, CreditCard, Receipt, FileText, UserCheck, Sparkles } from 'lucide-react';

const modules = [
  { name: 'Auth Module', desc: 'JWT authentication, password hashing, RBAC', icon: ShieldCheck, path: 'src/modules/auth' },
  { name: 'Catalog Module', desc: 'Product plans, tiers, feature pricing', icon: Box, path: 'src/modules/catalog' },
  { name: 'Subscriptions', desc: 'Lifecycle, upgrades, downgrades, cancellations', icon: Layers, path: 'src/modules/subscriptions' },
  { name: 'Billing Module', desc: 'Recurring cycles, automated invoices, pdfkit', icon: Receipt, path: 'src/modules/billing' },
  { name: 'Payments Module', desc: 'Payment gateways, webhook handling, refunds', icon: CreditCard, path: 'src/modules/payments' },
  { name: 'Reports Module', desc: 'MRR, ARR, churn rate, analytics', icon: FileText, path: 'src/modules/reports' },
  { name: 'Customer Portal', desc: 'Self-serve billing and plan management', icon: UserCheck, path: 'src/pages/portal' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              ⚡
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight">Brightloop Software</span>
              <span className="hidden sm:inline-block ml-2 text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Subscription Engine
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Link to="/login" className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-800">Sign in</Link>
            <Link to="/signup" className="rounded-lg bg-indigo-500 px-3 py-2 font-semibold text-white hover:bg-indigo-400">Create account</Link>
            <Link to="/app/invoices" className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-800">Staff billing</Link>
            <Link to="/portal/my-payments" className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-indigo-200 hover:bg-indigo-500/20">Customer portal</Link>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Scaffold Milestone (M1)
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-10">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Hackathon Project Skeleton
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Subscription Management Platform
          </h1>
          <p className="text-sm sm:text-base text-slate-400">
            Engineered for Brightloop Software. A modern, enterprise-ready multi-tenant subscription engine built with Node.js, Express, PostgreSQL, Prisma, React, and Tailwind CSS.
          </p>
          <div className="pt-2 flex justify-center">
            <Link
              to="/app/catalog/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <Box className="w-4 h-4" />
              <span>Launch Catalog Module &bull; Member 2</span>
            </Link>
          </div>
        </div>

        {/* Health Check Live Integration Card */}
        <div className="max-w-xl mx-auto">
          <HealthCard />
        </div>

        {/* Architecture & Modules Grid */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Scaffolded System Modules</h2>
            <span className="text-xs text-slate-400">Ready for feature milestone implementations</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.name}
                  className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4 hover:border-slate-700 transition-all hover:bg-slate-850"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200">{mod.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{mod.desc}</p>
                  <code className="text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 block truncate font-mono">
                    {mod.path}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 bg-slate-950/40 text-center text-xs text-slate-400">
        <p>Brightloop Software &copy; 2026 &bull; Project Scaffold &bull; Node.js 20 &bull; Express &bull; React 18 &bull; Tailwind CSS &bull; Vite</p>
      </footer>
    </div>
  );
}
