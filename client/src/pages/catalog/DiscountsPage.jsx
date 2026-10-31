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
  AlertCircle,
  Percent,
  Calendar,
  Lock,
} from 'lucide-react';

export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appliesToFilter, setAppliesToFilter] = useState('');

  // Modals & Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    type: 'PERCENT',
    value: '',
    minPurchase: '',
    minQty: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
    appliesTo: 'SUBSCRIPTION',
    productId: '',
    active: true,
  });

  // Query Products for Product Selection
  const { data: productsData } = useQuery({
    queryKey: ['products-lookup-discounts'],
    queryFn: async () => {
      const res = await api.get('/api/products?limit=100');
      return res.data?.products || [];
    },
  });

  // Query Discounts
  const { data, isLoading, error } = useQuery({
    queryKey: ['discounts', page, search, statusFilter, appliesToFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (appliesToFilter) params.append('appliesTo', appliesToFilter);

      const res = await api.get(`/api/discounts?${params.toString()}`);
      return res.data;
    },
  });

  // Mutations
  const createDiscountMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/api/discounts', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const updateDiscountMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/api/discounts/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/discounts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to delete discount'),
  });

  // Handlers
  const openCreateForm = () => {
    setEditingDiscount(null);
    setFormData({
      name: '',
      type: 'PERCENT',
      value: '',
      minPurchase: '',
      minQty: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      usageLimit: '',
      appliesTo: 'SUBSCRIPTION',
      productId: '',
      active: true,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (disc) => {
    setEditingDiscount(disc);
    setFormData({
      name: disc.name,
      type: disc.type,
      value: disc.type === 'FIXED' ? (disc.value / 100).toFixed(2) : disc.value,
      minPurchase: disc.minPurchase ? (disc.minPurchase / 100).toFixed(2) : '',
      minQty: disc.minQty || '',
      startDate: disc.startDate ? new Date(disc.startDate).toISOString().slice(0, 10) : '',
      endDate: disc.endDate ? new Date(disc.endDate).toISOString().slice(0, 10) : '',
      usageLimit: disc.usageLimit || '',
      appliesTo: disc.appliesTo,
      productId: disc.productId || '',
      active: disc.active,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingDiscount(null);
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    // Validations
    if (!formData.name.trim()) {
      setFormError('Discount name is required');
      return;
    }

    let valInt;
    if (formData.type === 'PERCENT') {
      valInt = Number(formData.value);
      if (isNaN(valInt) || valInt < 1 || valInt > 100) {
        setFormError('PERCENT discount value must be between 1 and 100');
        return;
      }
    } else {
      valInt = Math.round(Number(formData.value) * 100);
      if (isNaN(valInt) || valInt <= 0) {
        setFormError('FIXED discount value must be a positive amount');
        return;
      }
    }

    if (!formData.startDate) {
      setFormError('Start date is required');
      return;
    }

    if (!formData.endDate) {
      setFormError('End date is required');
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setFormError('End date must be after start date');
      return;
    }

    if (formData.appliesTo === 'PRODUCT' && !formData.productId) {
      setFormError('Product selection is required when appliesTo is PRODUCT');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      value: valInt,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      appliesTo: formData.appliesTo,
      productId: formData.appliesTo === 'PRODUCT' ? formData.productId : null,
      minPurchase: formData.minPurchase ? Math.round(Number(formData.minPurchase) * 100) : null,
      minQty: formData.minQty ? Number(formData.minQty) : null,
      usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
      active: formData.active,
    };

    if (editingDiscount) {
      updateDiscountMutation.mutate({ id: editingDiscount.id, payload });
    } else {
      createDiscountMutation.mutate(payload);
    }
  };

  // Columns
  const columns = [
    {
      header: 'Discount Rule',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white block">{row.name}</span>
            <span className="text-[11px] text-slate-400">
              {row.appliesTo === 'PRODUCT'
                ? `Specific Product: ${row.product?.name || row.productId}`
                : 'Entire Subscription Subtotal'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Discount Value',
      cell: (row) => (
        <div>
          <span className="font-mono font-bold text-indigo-300 block">
            {row.type === 'PERCENT' ? `${row.value}% Off` : `₹${(row.value / 100).toFixed(2)} Off`}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            {row.type}
          </span>
        </div>
      ),
    },
    {
      header: 'Thresholds',
      cell: (row) => (
        <div className="text-[11px] text-slate-300 space-y-0.5">
          {row.minPurchase && (
            <p>Min Purchase: ₹{(row.minPurchase / 100).toFixed(2)}</p>
          )}
          {row.minQty && <p>Min Qty: {row.minQty} units</p>}
          {!row.minPurchase && !row.minQty && (
            <span className="text-slate-500 italic">No minimums</span>
          )}
        </div>
      ),
    },
    {
      header: 'Validity Period',
      cell: (row) => (
        <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {new Date(row.startDate).toLocaleDateString()} &rarr;{' '}
            {new Date(row.endDate).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      header: 'Usage Count',
      cell: (row) => (
        <div className="text-xs font-mono">
          <span className="font-semibold text-slate-200">{row.usedCount}</span>
          <span className="text-slate-400">
            {' '}/ {row.usageLimit !== null && row.usageLimit !== undefined ? row.usageLimit : '∞'}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
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
                title="Edit Discount"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete discount rule "${row.name}"?`)) {
                    deleteDiscountMutation.mutate(row.id);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                title="Delete Discount"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
        <h1 className="text-xl font-bold text-white tracking-tight">Discount Rules</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure percentage or fixed promo codes and automated cart/subscription volume discounts.
        </p>
      </div>

      {/* Staff Read-Only Warning Banner */}
      {!isAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Staff View Mode:</strong> Discount configuration is strictly restricted to Administrators. You have view-only permissions.
            </span>
          </div>
          <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded font-mono">
            403 on mutations
          </span>
        </div>
      )}

      {/* Main Table */}
      <DataTable
        title="Promotions & Discounts"
        subtitle="Active, expired, and exhausted discount schedules"
        columns={columns}
        data={data?.discounts || []}
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
              <span>Add Discount</span>
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
                placeholder="Search discounts..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-40"
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
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="exhausted">Exhausted</option>
              </select>
            </div>

            <select
              value={appliesToFilter}
              onChange={(e) => {
                setAppliesToFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Scopes</option>
              <option value="SUBSCRIPTION">Subscription (Whole Order)</option>
              <option value="PRODUCT">Specific Product</option>
            </select>
          </div>
        }
      />

      {/* Discount Form Modal (Admin Only) */}
      {isAdmin && (
        <Modal
          isOpen={isFormOpen}
          onClose={closeForm}
          title={editingDiscount ? 'Edit Discount Rule' : 'Create Discount Rule'}
          subtitle="Define discount parameters, percentages, scope, and usage limits"
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
                disabled={createDiscountMutation.isPending || updateDiscountMutation.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
              >
                {createDiscountMutation.isPending || updateDiscountMutation.isPending
                  ? 'Saving...'
                  : editingDiscount
                  ? 'Save Changes'
                  : 'Create Discount'}
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
              <FormField label="Discount Name" required>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Black Friday 20%"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </FormField>

              <FormField label="Discount Type" required>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="PERCENT">PERCENT (1% - 100%)</option>
                  <option value="FIXED">FIXED (Amount in Rupees)</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                label={formData.type === 'PERCENT' ? 'Value (%)' : 'Amount (₹)'}
                required
                helperText={
                  formData.type === 'PERCENT' ? 'Integer between 1 and 100' : 'Rupees amount'
                }
              >
                <input
                  type="number"
                  step={formData.type === 'PERCENT' ? '1' : '0.01'}
                  min="1"
                  max={formData.type === 'PERCENT' ? '100' : undefined}
                  required
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.type === 'PERCENT' ? '20' : '500.00'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </FormField>

              <FormField label="Applies To Scope" required>
                <select
                  value={formData.appliesTo}
                  onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="SUBSCRIPTION">Whole Subscription Order</option>
                  <option value="PRODUCT">Specific Product Item</option>
                </select>
              </FormField>

              {formData.appliesTo === 'PRODUCT' ? (
                <FormField label="Select Product" required>
                  <select
                    required
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Choose product...</option>
                    {productsData?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : (
                <FormField label="Scope Target">
                  <input
                    disabled
                    value="Cart & Subscription Subtotal"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                  />
                </FormField>
              )}
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

              <FormField label="End Date" required helperText="Must be after start date">
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Min Purchase (₹)" helperText="Optional threshold">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minPurchase}
                  onChange={(e) => setFormData({ ...formData, minPurchase: e.target.value })}
                  placeholder="e.g. 1000.00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </FormField>

              <FormField label="Min Quantity" helperText="Optional minimum units">
                <input
                  type="number"
                  min="1"
                  value={formData.minQty}
                  onChange={(e) => setFormData({ ...formData, minQty: e.target.value })}
                  placeholder="e.g. 2"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </FormField>

              <FormField label="Usage Limit" helperText="Total allowed redemptions">
                <input
                  type="number"
                  min="1"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  placeholder="e.g. 100 (Blank = ∞)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="discActive"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
              />
              <label htmlFor="discActive" className="text-xs text-slate-300 select-none">
                Active promotion rule
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
