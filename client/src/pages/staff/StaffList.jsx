import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

export default function StaffList() {
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['staff', page], queryFn: async () => (await api.get('/api/staff', { params: { page, limit: 20 } })).data });

  async function submit(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    try { await api.post('/api/staff', payload); form.reset(); setNotice('Staff account created.'); await refetch(); }
    catch (err) { const body = err.response?.data?.error; setError(body?.details?.map((item) => item.message).join(', ') || body?.message || 'Unable to create staff account.'); }
    finally { setBusy(false); }
  }

  const columns = [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role} /> },
    { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];
  return <><PageHeader title="Staff management" description="Create and manage team access." />
    <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="mb-4 font-semibold">Add staff member</h2><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><FormField label="Name" name="name" required autoComplete="name" /><FormField label="Email" name="email" type="email" required autoComplete="email" /><FormField label="Temporary password" name="password" type="password" minLength={9} required autoComplete="new-password" className="sm:col-span-2" /><p className="text-xs text-slate-500 sm:col-span-2">Use at least 9 characters, including uppercase, lowercase, and a special character.</p>{error && <p role="alert" className="text-sm text-rose-300 sm:col-span-2">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-300 sm:col-span-2">{notice}</p>}<button disabled={busy} className="rounded-lg bg-indigo-500 px-4 py-2.5 font-semibold text-white disabled:opacity-60 sm:col-span-2">{busy ? 'Creating…' : 'Create staff account'}</button></form></section>
    {isError && <p role="alert" className="mb-3 text-sm text-rose-300">Staff list could not be loaded.</p>}
    <DataTable columns={columns} rows={data?.data || []} page={data?.page || page} limit={data?.limit || 20} total={data?.total || 0} onPageChange={setPage} emptyMessage={isLoading ? 'Loading staff…' : 'No staff accounts yet.'} />
  </>;
}
