import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Receipt } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { formatMinorCurrency } from '../../utils/currency';

export default function MyPayments() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['portal-payments', page],
    queryFn: async () => {
      const res = await api.get('/api/portal/payments', {
        params: { page, limit: 10 },
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const columns = [
    {
      header: 'Invoice #',
      accessor: 'invoice',
      render: (p) => (
        <span className="font-semibold text-gray-900 flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-indigo-600" />
          {p.invoice?.number || '—'}
        </span>
      ),
    },
    {
      header: 'Payment Method',
      accessor: 'method',
      render: (p) => <StatusBadge status={p.method} />,
    },
    {
      header: 'Amount Paid',
      accessor: 'amount',
      render: (p) => (
        <span className="font-medium text-emerald-700">{formatMinorCurrency(p.amount)}</span>
      ),
    },
    {
      header: 'Payment Date',
      accessor: 'paidAt',
      render: (p) => new Date(p.paidAt).toLocaleDateString(),
    },
    {
      header: 'Note',
      accessor: 'note',
      render: (p) => p.note || '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Payment History"
        description="View all processed transactions, receipts, and settlement records for your account."
      >
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CreditCard className="h-4 w-4 text-gray-400" />
          Total Payments: <span className="font-semibold text-gray-900">{data?.total || 0}</span>
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        emptyMessage="You have no recorded payments yet."
        pagination={{
          page,
          limit: data?.limit || 10,
          total: data?.total || 0,
        }}
        onPageChange={(newPage) => setPage(newPage)}
      />
    </div>
  );
}

