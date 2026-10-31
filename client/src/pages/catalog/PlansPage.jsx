import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import StatusBadge from '../../components/StatusBadge';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Pause,
  XCircle,
  RotateCw,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals & Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    billingPeriod: 'MONTHLY',
    minQty: 1,
    startDate: '',
    endDate: '',
    productId: '',
    autoClose: false,
    allowPause: true,
    allowEarlyClose: true,
    allowRenew: true,
  });

  // Query Products for Product Link Selector
  const { data: productsData } = useQuery({
    queryKey: ['products-lookup'],
    queryFn: async () => {
      const res = await api.get('/api/products?limit=100');
      return res.data?.products || [];
    },
  });

  // Fetch Plans Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['plans', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/api/plans?${params.toString()}`);
      return res.data;
    },
  });

  // Action Mutations
  const pausePlanMutation = useMutation({
    mutationFn: async (id) => {
      await api.post(`/api/plans/${id}/pause`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to pause plan'),
  });

  const closePlanMutation = useMutation({
    mutationFn: async (id) => {
      await api.post(`/api/plans/${id}/close`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to close plan'),
  });

  const renewPlanMutation = useMutation({
    mutationFn: async (id) => {
      await api.post(`/api/plans/${id}/renew`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to renew plan'),
  });

  // CRUD Mutations
  const createPlanMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/api/plans', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/api/plans/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/plans/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to delete plan'),
  });

  // Handlers
  const openCreateForm = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      price: '',
      billingPeriod: 'MONTHLY',
      minQty: 1,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      productId: '',
      autoClose: false,
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: (plan.price / 100).toFixed(2),
      billingPeriod: plan.billingPeriod,
      minQty: plan.minQty,
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().slice(0, 10) : '',
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().slice(0, 10) : '',
      productId: plan.productId || '',
      autoClose: plan.autoClose,
      allowPause: plan.allowPause,
      allowEarlyClose: plan.allowEarlyClose,
      allowRenew: plan.allowRenew,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPlan(null);
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    const priceInt = Math.round(Number(formData.price) * 100);
    if (isNaN(priceInt) || priceInt < 0) {
      setFormError('Plan price must be a valid non-negative number');
      return;
    }

    if (formData.endDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
      setFormError('End date must be after start date');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      price: priceInt,
      billingPeriod: formData.billingPeriod,
      minQty: Number(formData.minQty) || 1,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      productId: formData.productId ? formData.productId : null,
      autoClose: formData.autoClose,
      allowPause: formData.allowPause,
      allowEarlyClose: formData.allowEarlyClose,
      allowRenew: formData.allowRenew,
    };

    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, payload });
    } else {
      createPlanMutation.mutate(payload);
    }
  };

  // Columns
  const columns = [
    {
      header: 'Plan Details',
      cell: (row) => (
        <div>
          <span className="font-semibold text-white block">{row.name}</span>
          <span className="text-[11px] text-slate-400">
            {row.product ? `Linked: ${row.product.name}` : 'Standalone Plan'}
          </span>
        </div>
      ),
    },
    {
      header: 'Price & Cadence',
      cell: (row) => (
        <div>
          <span className="font-mono font-semibold text-slate-200 block">
            ₹{(row.price / 100).toFixed(2)}
          </span>
          <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-medium">
            Every {row.billingPeriod?.toLowerCase()}
          </span>
        </div>
      ),
    },
    {
      header: 'Validity Dates',
      cell: (row) => (
        <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {new Date(row.startDate).toLocaleDateString()} &rarr;{' '}
            {row.endDate ? new Date(row.endDate).toLocaleDateString() : 'Indefinite'}
          </span>
        </div>
      ),
    },
    {
      header: 'Flags Allowed',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.allowPause && (
            <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded">
              Pause
            </span>
          )}
          {row.allowEarlyClose && (
            <span className="text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 rounded">
              Early Close
            </span>
          )}
          {row.allowRenew && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              Renew
            </span>
          )}
          {row.autoClose && (
            <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-1.5 py-0.5 rounded">
              Auto-Close
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions & State Transitions',
      className: 'text-right',
      cell: (row) => {
        // Business Rules:
        // Pause: only if allowPause && status === 'ACTIVE'
        const canPause = row.allowPause && row.status === 'ACTIVE';
        // Close: only if allowEarlyClose && status !== 'CLOSED'
        const canClose = row.allowEarlyClose && row.status !== 'CLOSED';
        // Renew: only if allowRenew
        const canRenew = Boolean(row.allowRenew && row.endDate);

        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* Pause Action */}
            <button
              type="button"
              disabled={!canPause || pausePlanMutation.isPending}
              onClick={() => pausePlanMutation.mutate(row.id)}
              className="p-1.5 rounded-lg border border-slate-800 text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title={
                !row.allowPause
                  ? 'Plan does not allow pause'
                  : row.status !== 'ACTIVE'
                  ? 'Only ACTIVE plans can be paused'
                  : 'Pause Plan'
              }
            >
              <Pause className="w-3.5 h-3.5" />
            </button>

            {/* Early Close Action */}
            <button
              type="button"
              disabled={!canClose || closePlanMutation.isPending}
              onClick={() => closePlanMutation.mutate(row.id)}
              className="p-1.5 rounded-lg border border-slate-800 text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title={
                !row.allowEarlyClose
                  ? 'Plan does not allow early close'
                  : row.status === 'CLOSED'
                  ? 'Plan is already closed'
                  : 'Close Plan'
              }
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>

            {/* Renew Action */}
            <button
              type="button"
              disabled={!canRenew || renewPlanMutation.isPending}
              onClick={() => renewPlanMutation.mutate(row.id)}
              className="p-1.5 rounded-lg border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title={
                !row.allowRenew
                  ? 'Plan does not allow renewal'
                  : !row.endDate
                  ? 'Cannot renew plan with no end date'
                  : 'Renew (extends endDate by 1 billing period and sets status ACTIVE)'
              }
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Admin CRUD edit & delete */}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => openEditForm(row)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
                  title="Edit Plan"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete plan "${row.name}"?`)) {
                      deletePlanMutation.mutate(row.id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  title="Delete Plan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Subscription Plans</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure recurring pricing plans, billing period cadences, and automated action lifecycle.
        </p>
      </div>

      {/* Main Table */}
      <DataTable
        title="Plans"
        subtitle="Active, paused, and closed plan cadences"
        columns={columns}
        data={data?.plans || []}
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
              <span>Add Plan</span>
            </button>
          )
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search plans..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
              />
            </div>

            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>
        }
      />

      {/* Plan Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingPlan ? 'Edit Plan' : 'Create New Subscription Plan'}
        subtitle="Define plan rules, recurring cadence, dates, and allowed state transitions"
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
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {createPlanMutation.isPending || updatePlanMutation.isPending
                ? 'Saving...'
                : editingPlan
                ? 'Save Changes'
                : 'Create Plan'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Plan Name" required>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Pro Monthly Cadence"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </FormField>

            <FormField label="Recurring Billing Period" required>
              <select
                value={formData.billingPeriod}
                onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="DAILY">Daily (+1 Day)</option>
                <option value="WEEKLY">Weekly (+7 Days)</option>
                <option value="MONTHLY">Monthly (Clamped Month-End)</option>
                <option value="YEARLY">Yearly (+1 Year)</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Plan Price (₹)" required helperText="Recurring billing price in Rupees">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="e.g. 990.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </FormField>

            <FormField label="Minimum Quantity" required>
              <input
                type="number"
                min="1"
                required
                value={formData.minQty}
                onChange={(e) => setFormData({ ...formData, minQty: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </FormField>

            <FormField label="Linked Product (Optional)">
              <select
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">None (Standalone)</option>
                {productsData?.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} (₹{(prod.salesPrice / 100).toFixed(2)})
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Start Date" required>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </FormField>

            <FormField label="End Date (Optional)" helperText="Leave empty for open-ended subscription plan">
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </FormField>
          </div>

          {/* Action and Lifecycle Flags */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
              Lifecycle & State Transition Rules
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-850 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowPause}
                  onChange={(e) => setFormData({ ...formData, allowPause: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-200">
                  Allow Pause (Admin can pause active plan)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-850 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowEarlyClose}
                  onChange={(e) => setFormData({ ...formData, allowEarlyClose: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-200">
                  Allow Early Close (Admin can close before endDate)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-850 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowRenew}
                  onChange={(e) => setFormData({ ...formData, allowRenew: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-200">
                  Allow Renewal (Extends endDate by 1 period & sets ACTIVE)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-850 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoClose}
                  onChange={(e) => setFormData({ ...formData, autoClose: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <span className="text-xs text-slate-200">
                  Auto-Close (Daily job auto-closes when endDate passes)
                </span>
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
