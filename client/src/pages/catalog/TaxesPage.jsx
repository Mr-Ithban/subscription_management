import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import StatusBadge from '../../components/StatusBadge';
import { Plus, Edit2, Trash2, Search, AlertCircle, Receipt } from 'lucide-react';

export default function TaxesPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    rate: '',
    active: true,
  });

  // Query Taxes
  const { data, isLoading, error } = useQuery({
    queryKey: ['taxes', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) params.append('search', search);

      const res = await api.get(`/api/taxes?${params.toString()}`);
      return res.data;
    },
  });

  // Mutations
  const createTaxMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/api/taxes', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const updateTaxMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/api/taxes/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const deleteTaxMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/taxes/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taxes'] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to delete tax'),
  });

  // Handlers
  const openCreateForm = () => {
    setEditingTax(null);
    setFormData({ name: '', rate: '', active: true });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (tax) => {
    setEditingTax(tax);
    setFormData({
      name: tax.name,
      rate: Number(tax.rate),
      active: tax.active,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTax(null);
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    const rateNum = Number(formData.rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setFormError('Tax rate must be between 0% and 100%');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      rate: rateNum,
      active: formData.active,
    };

    if (editingTax) {
      updateTaxMutation.mutate({ id: editingTax.id, payload });
    } else {
      createTaxMutation.mutate(payload);
    }
  };

  const columns = [
    {
      header: 'Tax Rule Name',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white block">{row.name}</span>
            <span className="text-[11px] text-slate-400 font-mono">ID: {row.id?.slice(0, 8)}...</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Tax Rate (%)',
      cell: (row) => (
        <span className="text-sm font-bold font-mono text-indigo-300">
          {Number(row.rate).toFixed(2)}%
        </span>
      ),
    },
    {
      header: 'Calculation Rule',
      cell: () => (
        <span className="text-xs text-slate-400">
          Round-half-up on line items
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.active} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => openEditForm(row)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Edit Tax"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete tax rule "${row.name}"?`)) {
                    deleteTaxMutation.mutate(row.id);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                title="Delete Tax"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Read-only</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Tax Rates</h1>
        <p className="text-xs text-slate-400 mt-1">
          Define applicable tax categories and percentage rates for line-item invoice calculations.
        </p>
      </div>

      {/* Main Table */}
      <DataTable
        title="Tax Rules"
        subtitle="Applicable GST, VAT, and Sales Tax schedules"
        columns={columns}
        data={data?.taxes || []}
        loading={isLoading}
        error={error}
        pagination={{
          page: data?.pagination?.page || page,
          limit: data?.pagination?.limit || 10,
          total: data?.pagination?.total || 0,
          totalPages: data?.pagination?.totalPages || 1,
          onPageChange: (p) => setPage(p),
        }}
        actions={
          isAdmin && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Tax Rule</span>
            </button>
          )
        }
        filters={
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tax rules..."
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
            />
          </div>
        }
      />

      {/* Tax Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingTax ? 'Edit Tax Rule' : 'Create Tax Rule'}
        subtitle="Specify tax schedule name and percentage rate"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 hover:bg-slate-800 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createTaxMutation.isPending || updateTaxMutation.isPending}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {createTaxMutation.isPending || updateTaxMutation.isPending
                ? 'Saving...'
                : editingTax
                ? 'Save Changes'
                : 'Create Tax Rule'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <FormField label="Tax Name" required>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Standard GST 18%"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </FormField>

          <FormField
            label="Rate (%)"
            required
            helperText="Enter a percentage value between 0 and 100 (e.g. 18 for 18%)"
          >
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              placeholder="18.00"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="taxActive"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
            />
            <label htmlFor="taxActive" className="text-xs text-slate-300 select-none">
              Active tax rate (applied to new invoices)
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
