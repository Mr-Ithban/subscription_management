import { Link } from 'react-router-dom';

const roleContent = {
  ADMIN: { title: 'Administration', description: 'Manage the Brightloop subscription platform.', items: ['Users and access', 'Plans and catalog', 'Billing overview', 'Reports'] },
  STAFF: { title: 'Operations workspace', description: 'Your staff workspace for customer and subscription operations.', items: ['Customer support', 'Subscription operations', 'Invoices and payments'] },
  CUSTOMER: { title: 'Your subscription account', description: 'Your account workspace for subscription and billing self-service.', items: ['Active subscriptions', 'Invoices', 'Payment history'] },
};

export function RoleHome({ role }) {
  const content = roleContent[role];
  return <section><p className="text-sm font-medium text-indigo-300">{role}</p><h1 className="mt-2 text-3xl font-bold">{content.title}</h1><p className="mt-2 text-slate-400">{content.description}</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{content.items.map((item) => <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="font-semibold">{item}</h2><p className="mt-2 text-sm text-slate-400">This section is ready for its feature module.</p></div>)}</div></section>;
}

export function PortalSection({ title }) {
  return <section><p className="text-sm font-medium text-indigo-300">Customer portal</p><h1 className="mt-2 text-3xl font-bold">{title}</h1><div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-slate-400">Your {title.toLowerCase()} will appear here when the subscription and billing services are available.</div><Link className="mt-6 inline-block text-sm text-indigo-300 hover:text-indigo-200" to="/portal">Back to overview</Link></section>;
}
