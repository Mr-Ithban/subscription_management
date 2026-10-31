import React from 'react';

export default function PageHeader({ title, description, children }) {
  return (
    <div className="md:flex md:items-center md:justify-between pb-6 border-b border-gray-200 mb-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {children && (
        <div className="mt-4 flex md:ml-4 md:mt-0 space-x-3">{children}</div>
      )}
    </div>
  );
}

