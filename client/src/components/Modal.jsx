import { useEffect } from 'react';
export default function Modal({ open, title, onClose, children }) {
  useEffect(() => { if (!open) return undefined; const close = (event) => event.key === 'Escape' && onClose?.(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 id="modal-title" className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">×</button></div>{children}</section></div>;
}
