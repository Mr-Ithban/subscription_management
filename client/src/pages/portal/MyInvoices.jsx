import React from 'react';
import PageHeader from '../../components/PageHeader';
import { Receipt } from 'lucide-react';

export default function MyInvoices() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Invoices"
        description="View and download your billing invoices."
      />
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-16 text-center">
        <Receipt className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Your invoice history will appear here.</p>
      </div>
    </div>
  );
}
