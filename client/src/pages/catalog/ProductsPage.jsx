import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import StatusBadge from '../../components/StatusBadge';
import { Plus, Edit2, Trash2, Search, Filter, Layers, AlertCircle } from 'lucide-react';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [activeProductForVariants, setActiveProductForVariants] = useState(null);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'GOODS',
    salesPrice: '',
    costPrice: '',
    notes: '',
    active: true,
  });

  // Variants in Product Form
  const [variants, setVariants] = useState([]);

  // Fetch Products Query
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['products', page, search, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);

      const res = await api.get(`/api/products?${params.toString()}`);
      return res.data;
    },
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/api/products', payload);
      const product = res.data;

      // If variants were defined in form, create them
      if (variants.length > 0) {
        for (const v of variants) {
          if (v.attribute && v.value) {
            await api.post(`/api/products/${product.id}/variants`, {
              attribute: v.attribute,
              value: v.value,
              extraPrice: Number(v.extraPrice || 0),
            });
          }
        }
      }
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/api/products/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.error?.message || err.message);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      alert(err.response?.data?.error?.message || 'Failed to delete product');
    },
  });

  const addVariantMutation = useMutation({
    mutationFn: async ({ productId, payload }) => {
      await api.post(`/api/products/${productId}/variants`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      alert(err.response?.data?.error?.message || 'Failed to add variant');
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async ({ productId, variantId }) => {
      await api.delete(`/api/products/${productId}/variants/${variantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      alert(err.response?.data?.error?.message || 'Failed to delete variant');
    },
  });

  // Handlers
  const openCreateForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      type: 'GOODS',
      salesPrice: '',
      costPrice: '',
      notes: '',
      active: true,
    });
    setVariants([]);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      type: prod.type,
      salesPrice: (prod.salesPrice / 100).toFixed(2),
      costPrice: (prod.costPrice / 100).toFixed(2),
      notes: prod.notes || '',
      active: prod.active,
    });
    setVariants([]);
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    const salesPriceInt = Math.round(Number(formData.salesPrice) * 100);
    const costPriceInt = Math.round(Number(formData.costPrice) * 100);

    if (isNaN(salesPriceInt) || salesPriceInt < 0) {
      setFormError('Sales price must be a valid non-negative number');
      return;
    }

    if (isNaN(costPriceInt) || costPriceInt < 0) {
      setFormError('Cost price must be a valid non-negative number');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      salesPrice: salesPriceInt,
      costPrice: costPriceInt,
      notes: formData.notes.trim() || undefined,
      active: formData.active,
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, payload });
    } else {
      createProductMutation.mutate(payload);
    }
  };

  const handleAddVariantRow = () => {
    setVariants([...variants, { attribute: '', value: '', extraPrice: 0 }]);
  };

  const handleUpdateVariantRow = (index, field, val) => {
    const updated = [...variants];
    updated[index][field] = val;
    setVariants(updated);
  };

  const handleRemoveVariantRow = (index) => {
    setVariants(variants.filter((_, idx) => idx !== index));
  };

  // Columns definition
  const columns = [
    {
      header: 'Product Name',
      cell: (row) => (
        <div>
          <span className="font-semibold text-white block">{row.name}</span>
          {row.notes && <span className="text-[11px] text-slate-400 block truncate max-w-xs">{row.notes}</span>}
        </div>
      ),
    },
    {
      header: 'Type',
      cell: (row) => <StatusBadge status={row.type} />,
    },
    {
      header: 'Sales Price',
      cell: (row) => (
        <span className="font-mono text-slate-200">
          ₹{(row.salesPrice / 100).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Cost Price',
      cell: (row) => (
        <span className="font-mono text-slate-400">
          ₹{(row.costPrice / 100).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Variants',
      cell: (row) => (
        <button
          type="button"
          onClick={() => {
            setActiveProductForVariants(row);
            setIsVariantModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{row.variants?.length || 0} Variants</span>
        </button>
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
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => openEditForm(row)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Edit Product"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to deactivate "${row.name}"?`)) {
                    deleteProductMutation.mutate(row.id);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                title="Deactivate Product"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Products & Variants</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage product catalog, sales pricing, cost pricing, and dynamic variant attributes.
        </p>
      </div>

      {/* Main Table */}
      <DataTable
        title="Products"
        subtitle="Catalog items with SKU pricing"
        columns={columns}
        data={data?.products || []}
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
              <span>Add Product</span>
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
                placeholder="Search products..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
              />
            </div>

            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Types</option>
                <option value="GOODS">Goods</option>
                <option value="SERVICE">Service</option>
                <option value="CONSUMABLE">Consumable</option>
              </select>
            </div>
          </div>
        }
      />

      {/* Product Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingProduct ? 'Edit Product' : 'Create New Product'}
        subtitle="Specify product attributes, pricing and optional variants"
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
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {createProductMutation.isPending || updateProductMutation.isPending
                ? 'Saving...'
                : editingProduct
                ? 'Save Changes'
                : 'Create Product'}
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
            <FormField label="Product Name" required>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Cloud Pro Storage"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </FormField>

            <FormField label="Product Type" required>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="GOODS">Goods</option>
                <option value="SERVICE">Service</option>
                <option value="CONSUMABLE">Consumable</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Sales Price (₹)" required helperText="Amount in Rupees (converted to paise automatically)">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.salesPrice}
                onChange={(e) => setFormData({ ...formData, salesPrice: e.target.value })}
                placeholder="e.g. 499.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </FormField>

            <FormField label="Cost Price (₹)" required helperText="Base unit cost in Rupees">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="e.g. 299.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </FormField>
          </div>

          <FormField label="Internal Notes">
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional description or warehouse notes..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="productActive"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
            />
            <label htmlFor="productActive" className="text-xs text-slate-300 select-none">
              Active product (available for subscription plans)
            </label>
          </div>

          {/* Variant Editor (Shown on Create Product) */}
          {!editingProduct && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Product Variants
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Add initial variant combinations (attribute, value, extra price)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariantRow}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-indigo-400 font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variant</span>
                </button>
              </div>

              {variants.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2 text-center bg-slate-950/40 rounded-xl border border-slate-850">
                  No variants added yet. Click &quot;Add Variant&quot; to configure attributes.
                </p>
              ) : (
                <div className="space-y-2">
                  {variants.map((v, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-950 border border-slate-850"
                    >
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Attribute (e.g. RAM)"
                          value={v.attribute}
                          onChange={(e) => handleUpdateVariantRow(idx, 'attribute', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Value (e.g. 16GB)"
                          value={v.value}
                          onChange={(e) => handleUpdateVariantRow(idx, 'value', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="+₹ Extra"
                          value={v.extraPrice}
                          onChange={(e) => handleUpdateVariantRow(idx, 'extraPrice', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Manage Variants Modal */}
      {activeProductForVariants && (
        <Modal
          isOpen={isVariantModalOpen}
          onClose={() => setIsVariantModalOpen(false)}
          title={`Variants for ${activeProductForVariants.name}`}
          subtitle={`Base Sales Price: ₹${(activeProductForVariants.salesPrice / 100).toFixed(2)}`}
          footer={
            <button
              type="button"
              onClick={() => setIsVariantModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium transition"
            >
              Close
            </button>
          }
        >
          <div className="space-y-4">
            {/* Existing Variants List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Configured Variants
              </h4>
              {activeProductForVariants.variants?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-950 rounded-xl border border-slate-800">
                  No variants configured for this product.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeProductForVariants.variants?.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-xs text-white">{v.attribute}: </span>
                        <span className="text-xs text-indigo-400 font-medium">{v.value}</span>
                        {v.extraPrice > 0 && (
                          <span className="ml-2 text-[11px] text-emerald-400 font-mono">
                            (+₹{(v.extraPrice / 100).toFixed(2)})
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            deleteVariantMutation.mutate({
                              productId: activeProductForVariants.id,
                              variantId: v.id,
                            })
                          }
                          className="text-slate-400 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Add Variant (Admin only) */}
            {isAdmin && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Add New Variant
                </h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target;
                    const attribute = form.attribute.value.trim();
                    const value = form.value.value.trim();
                    const extraPrice = Math.round(Number(form.extraPrice.value || 0) * 100);

                    if (!attribute || !value) return;

                    addVariantMutation.mutate(
                      {
                        productId: activeProductForVariants.id,
                        payload: { attribute, value, extraPrice },
                      },
                      {
                        onSuccess: () => form.reset(),
                      }
                    );
                  }}
                  className="grid grid-cols-12 gap-2"
                >
                  <div className="col-span-4">
                    <input
                      name="attribute"
                      required
                      placeholder="Attribute (e.g. Size)"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      name="value"
                      required
                      placeholder="Value (e.g. Large)"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      name="extraPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="+₹ Price"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="submit"
                      disabled={addVariantMutation.isPending}
                      className="w-full h-full flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
