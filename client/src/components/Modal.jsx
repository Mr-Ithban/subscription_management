import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, open, onClose, title, subtitle, children, footer, maxWidth = 'max-w-lg' }) {
  const visible = open ?? isOpen;
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className={`relative transform overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-left text-slate-100 shadow-xl transition-all sm:my-8 sm:w-full ${maxWidth} p-6`}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div><h3 className="text-lg font-semibold leading-6">{title}</h3>{subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}</div>
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4">{children}</div>
          {footer && <div className="mt-5 flex justify-end gap-3 border-t border-slate-700 pt-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

