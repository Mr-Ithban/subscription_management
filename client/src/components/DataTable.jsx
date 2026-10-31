import React from 'react';

export default function DataTable({
  columns = [],
  data = [],
  rows,
  isLoading = false,
  emptyMessage = 'No records found',
  pagination,
  page,
  limit,
  total,
  onPageChange,
}) {
  const records = rows ?? data;
  const pageInfo = pagination ?? (rows ? { page: page || 1, limit: limit || 20, total: total || 0 } : null);
  const totalPages = pageInfo ? Math.ceil((pageInfo.total || 0) / (pageInfo.limit || 20)) : 1;
  const currentPage = pageInfo?.page || 1;

  if (isLoading) {
    return (
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg bg-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-100 rounded w-full"></div>
          <div className="h-10 bg-gray-100 rounded w-full"></div>
          <div className="h-10 bg-gray-100 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.key || col.accessor || idx}
                  scope="col"
                  className={`py-3.5 px-4 text-left text-xs font-semibold text-gray-900 ${
                    col.className || ''
                  }`}
                >
                  {col.header || col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 px-4 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              records.map((row, rowIdx) => (
                <tr key={row.id || rowIdx} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || col.accessor || colIdx}
                      className={`whitespace-nowrap py-3 px-4 text-sm text-gray-700 ${
                        col.className || ''
                      }`}
                    >
                      {col.render ? col.render(row) : row[col.accessor || col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageInfo && pageInfo.total > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * pageInfo.limit + 1}</span>{' '}
            to{' '}
            <span className="font-medium">
              {Math.min(currentPage * pageInfo.limit, pageInfo.total)}
            </span>{' '}
            of <span className="font-medium">{pageInfo.total}</span> results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange && onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange && onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="relative inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

