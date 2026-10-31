import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';

const STATUS_OPTIONS = [
  'ALL',
  'ACTIVE',
  'CONFIRMED',
  'QUOTATION',
  'DRAFT',
  'CLOSED',
];

export default function Subscriptions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['report-subscriptions', page, status],
    queryFn: async () => {
      const params = { page, limit: 15 };
      if (status !== 'ALL') params.status = status;
      const res = await api.get('/api/reports/subscriptions', { params });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const rawData = data?.data || [];
  const filteredData = search
    ? rawData.filter(
        (sub) =>
          sub.number?.toLowerCase().includes(search.toLowerCase()) ||
          sub.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
          sub.plan?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : rawData;

  const columns = [
    {
      header: 'Subscription #',
      accessor: 'number',
      render: (sub) => (
        <span className="font-semibold text-gray-900">{sub.number}</span>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer',
      render: (sub) => sub.customer?.name || '—',
    },
    {
      header: 'Plan',
      accessor: 'plan',
      render: (sub) => (
        <div>
          <span className="font-medium text-gray-900">{sub.plan?.name || 'Standard'}</span>
          <span className="text-xs text-gray-500 block">
            {sub.plan?.billingPeriod} • ₹{sub.plan?.price}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (sub) => <StatusBadge status={sub.status} />,
    },
    {
      header: 'Start Date',
      accessor: 'startDate',
      render: (sub) => new Date(sub.startDate).toLocaleDateString(),
    },
    {
      header: 'Next Billing',
      accessor: 'nextBillingDate',
      render: (sub) =>
        sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Analytics & Audit"
        description="Filter and track all customer recurring contracts, statuses, and renewal dates."
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow ring-1 ring-black ring-opacity-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number, customer..."
            className="block w-full rounded-md border-gray-300 pl-10 text-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Status:</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500 p-1.5 border"
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        emptyMessage="No subscriptions match the selected criteria."
        pagination={{
          page,
          limit: data?.limit || 15,
          total: data?.total || 0,
        }}
        onPageChange={(newPage) => setPage(newPage)}
      />
    </div>
  );
}

