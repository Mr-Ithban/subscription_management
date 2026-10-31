import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';

export default function TemplatesPage() {
  const client = useQueryClient();
  const [form, setForm] = useState({ name: '', planId: '', validityDays: '14', productId: '', variantId: '', taxId: '', quantity: '1', unitPrice: '' });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const templates = useQuery({ queryKey: ['quotation-templates'], queryFn: async () => (await api.get('/api/quotation-templates', { params: { limit: 100 } })).data.templates || [] });
  const customers = useQuery({ queryKey: ['customer-options'], queryFn: async () => (await api.get('/api/customers', { params: { limit: 100 } })).data.data || [] });
  const plans = useQuery({ queryKey: ['plan-options'], queryFn: async () => (await api.get('/api/plans', { params: { limit: 100, status: 'ACTIVE' } })).data.plans || [] });
  const products = useQuery({ queryKey: ['product-options'], queryFn: async () => (await api.get('/api/products', { params: { limit: 100, active: 'true' } })).data.products || [] });
  const taxes = useQuery({ queryKey: ['tax-options'], queryFn: async () => (await api.get('/api/taxes', { params: { limit: 100, active: 'true' } })).data.taxes || [] });
  const save = useMutation({
    mutationFn: () => api.post('/api/quotation-templates', { name: form.name, planId: form.planId, validityDays: Number(form.validityDays), lines: form.productId ? [{ productId: form.productId, variantId: form.variantId || null, taxId: form.taxId || null, quantity: Number(form.quantity), unitPrice: Math.round(Number(form.unitPrice) * 100) }] : [] }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['quotation-templates'] }); setForm({ name: '', planId: '', validityDays: '14', productId: '', variantId: '', taxId: '', quantity: '1', unitPrice: '' }); setError(''); },
    onError: (e) => setError(e.response?.data?.error?.message || e.message),
  });
  const createQuote = useMutation({
    mutationFn: () => api.post(`/api/quotation-templates/${quote.template.id}/create-subscription`, { customerId: quote.customerId, startDate: quote.startDate, paymentTerms: Number(quote.paymentTerms || 0) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['managed-subscriptions'] }); setQuote(null); setError('Quotation created from the template.'); },
    onError: (e) => setError(e.response?.data?.error?.message || e.message),
  });
  const product = (products.data || []).find((item) => item.id === form.productId);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value, ...(key === 'productId' ? { variantId: '' } : {}) }));

  return <div className="space-y-6"><PageHeader title="Quotation templates" description="Prepare reusable plan and product offers, then create a customer quotation in one step." />
    {error && <p role="status" className={`rounded-lg p-3 text-sm ${error.startsWith('Quotation created') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{error}</p>}
    <form onSubmit={(e) => { e.preventDefault(); setError(''); save.mutate(); }} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-slate-900">New template</h2>
      <div className="grid gap-3 sm:grid-cols-3"><input required maxLength="120" placeholder="Template name" value={form.name} onChange={(e) => update('name', e.target.value)} className={field} /><select required value={form.planId} onChange={(e) => update('planId', e.target.value)} className={field}><option value="">Select plan</option>{(plans.data || []).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><label className="flex items-center gap-2 text-sm text-slate-600">Valid for <input required min="1" type="number" value={form.validityDays} onChange={(e) => update('validityDays', e.target.value)} className={`${field} max-w-24`} /> days</label></div>
      <div className="grid gap-3 sm:grid-cols-5"><select value={form.productId} onChange={(e) => update('productId', e.target.value)} className={field}><option value="">No product line</option>{(products.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select disabled={!product?.variants?.length} value={form.variantId} onChange={(e) => update('variantId', e.target.value)} className={field}><option value="">No variant</option>{(product?.variants || []).map((item) => <option key={item.id} value={item.id}>{item.attribute}: {item.value}</option>)}</select><select value={form.taxId} onChange={(e) => update('taxId', e.target.value)} className={field}><option value="">No tax</option>{(taxes.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="Quantity" min="1" type="number" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} className={field} /><input aria-label="Unit price in rupees" min="0" step="0.01" type="number" placeholder="Unit price ₹" value={form.unitPrice} onChange={(e) => update('unitPrice', e.target.value)} className={field} /></div>
      <button disabled={save.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? 'Saving…' : 'Save template'}</button>
    </form>
    <section className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-black/5"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Template</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Validity</th><th className="px-4 py-3">Lines</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{(templates.data || []).map((template) => <tr key={template.id}><td className="px-4 py-3 font-medium text-slate-900">{template.name}</td><td className="px-4 py-3">{template.plan?.name}</td><td className="px-4 py-3">{template.validityDays} days</td><td className="px-4 py-3">{template.lines?.length || 0}</td><td className="px-4 py-3 text-right"><button onClick={() => setQuote({ template, customerId: '', startDate: new Date().toISOString().slice(0, 10), paymentTerms: '0' })} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"><FilePlus2 size={14} />Create quotation</button></td></tr>)}{!templates.isLoading && !templates.data?.length && <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">No quotation templates yet.</td></tr>}</tbody></table></section>
    {quote && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><form onSubmit={(e) => { e.preventDefault(); createQuote.mutate(); }} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"><h2 className="text-lg font-semibold">Create quotation · {quote.template.name}</h2><label className="grid gap-1 text-sm">Customer<select required value={quote.customerId} onChange={(e) => setQuote({ ...quote, customerId: e.target.value })} className={field}><option value="">Select customer</option>{(customers.data || []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.user?.email}</option>)}</select></label><label className="grid gap-1 text-sm">Start date<input required type="date" value={quote.startDate} onChange={(e) => setQuote({ ...quote, startDate: e.target.value })} className={field} /></label><label className="grid gap-1 text-sm">Payment terms (days)<input min="0" type="number" value={quote.paymentTerms} onChange={(e) => setQuote({ ...quote, paymentTerms: e.target.value })} className={field} /></label><p className="text-xs text-slate-500">The quotation is valid for {quote.template.validityDays} days. Line prices are stored in minor currency units.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setQuote(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={createQuote.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{createQuote.isPending ? 'Creating…' : 'Create quotation'}</button></div></form></div>}
  </div>;
}
