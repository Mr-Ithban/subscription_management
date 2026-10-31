import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { formatMinorCurrency } from '../../utils/currency';

export default function Dashboard() {
  const [groupBy, setGroupBy] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [overduePage, setOverduePage] = useState(1);

  // 1. Fetch Finance Summary
  const {
    data: summary,
    isLoading: isSummaryLoading,
  } = useQuery({
    queryKey: ['finance-summary', from, to],
    queryFn: async () => {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/api/reports/summary', { params });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  // 2. Fetch Revenue Breakdown for chart
  const {
    data: revenueData,
    isLoading: isRevenueLoading,
  } = useQuery({
    queryKey: ['finance-revenue', groupBy, from, to],
    queryFn: async () => {
      const params = { groupBy };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/api/reports/revenue', { params });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  // 3. Fetch Overdue Invoices
  const {
    data: overdueData,
    isLoading: isOverdueLoading,
  } = useQuery({
    queryKey: ['reports-overdue', overduePage],
    queryFn: async () => {
      const res = await api.get('/api/reports/overdue', {
        params: { page: overduePage, limit: 10 },
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const cards = [
    {
      name: 'Active Subscriptions',
      value: summary?.activeSubscriptionCount ?? 0,
      icon: Users,
      color: 'text-indigo-600 bg-indigo-50',
      subtitle: `MRR: ${formatMinorCurrency(summary?.mrr)}`,
    },
    {
      name: 'Revenue Collected',
      value: formatMinorCurrency(summary?.revenue),
      icon: DollarSign,
      color: 'text-emerald-600 bg-emerald-50',
      subtitle: `Invoiced: ${formatMinorCurrency(summary?.invoicedTotal)}`,
    },
    {
      name: 'Outstanding Balance',
      value: formatMinorCurrency(summary?.outstandingTotal),
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
      subtitle: 'Open invoices pending payment',
    },
    {
      name: 'Overdue Invoices',
      value: summary?.overdueCount ?? 0,
      icon: AlertTriangle,
      color: 'text-rose-600 bg-rose-50',
      subtitle: `Amount: ${formatMinorCurrency(summary?.overdueAmount)}`,
    },
  ];

  const overdueColumns = [
    {
      header: 'Invoice #',
      accessor: 'number',
      render: (inv) => (
        <a
          href={`/app/invoices/${inv.id}`}
          className="font-medium text-indigo-600 hover:text-indigo-900"
        >
          {inv.number}
        </a>
      ),
    },
    {
      header: 'Due Date',
      accessor: 'dueDate',
      render: (inv) => new Date(inv.dueDate).toLocaleDateString(),
    },
    {
      header: 'Days Overdue',
      accessor: 'daysOverdue',
      render: (inv) => (
        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
          {inv.daysOverdue} days
        </span>
      ),
    },
    {
      header: 'Balance Due',
      accessor: 'remainingBalance',
      render: (inv) => formatMinorCurrency(inv.remainingBalance ?? inv.total),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (inv) => <StatusBadge status={inv.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Revenue Dashboard"
        description="Real-time financial indicators, revenue trends, and accounts receivable tracking."
      >
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm p-1.5 border"
            placeholder="From Date"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm p-1.5 border"
            placeholder="To Date"
          />
          {(from || to) && (
            <button
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear
            </button>
          )}
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.name}
              className="relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 shadow ring-1 ring-black ring-opacity-5 sm:px-6"
            >
              {isSummaryLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-100 rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <dt>
                    <div className={`absolute rounded-md p-3 ${c.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-gray-500">
                      {c.name}
                    </p>
                  </dt>
                  <dd className="ml-16 flex items-baseline pb-1">
                    <p className="text-2xl font-semibold text-gray-900">
                      {c.value}
                    </p>
                  </dd>
                  <p className="ml-16 text-xs text-gray-500">{c.subtitle}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Revenue Breakdown Chart */}
      <div className="rounded-lg bg-white p-6 shadow ring-1 ring-black ring-opacity-5">
        <div className="sm:flex sm:items-center sm:justify-between pb-4 border-b border-gray-200 mb-4">
          <div>
            <h3 className="text-base font-semibold leading-6 text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Revenue Trends
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Total period collections: ₹
              {formatMinorCurrency(revenueData?.totalRevenue)}
            </p>
          </div>

          <div className="inline-flex rounded-md shadow-sm mt-3 sm:mt-0">
            {['day', 'week', 'month'].map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setGroupBy(period)}
                className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold capitalize ring-1 ring-inset ring-gray-300 first:rounded-l-md last:rounded-r-md ${
                  groupBy === period
                    ? 'bg-indigo-600 text-white ring-indigo-600'
                    : 'bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {isRevenueLoading ? (
          <div className="h-72 flex items-center justify-center animate-pulse bg-gray-50 rounded">
            <span className="text-sm text-gray-400">Loading revenue chart...</span>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData?.breakdown || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(val) => formatMinorCurrency(val)}
                />
                <Tooltip
                  formatter={(value) => [formatMinorCurrency(value), 'Revenue']}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Overdue Invoices Table */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold leading-6 text-gray-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          Overdue Invoices Requiring Attention
        </h3>
        <DataTable
          columns={overdueColumns}
          data={overdueData?.data || []}
          isLoading={isOverdueLoading}
          emptyMessage="No overdue invoices. Accounts receivable in good standing!"
          pagination={{
            page: overduePage,
            limit: overdueData?.limit || 10,
            total: overdueData?.total || 0,
          }}
          onPageChange={(page) => setOverduePage(page)}
        />
      </div>
    </div>
  );
}

