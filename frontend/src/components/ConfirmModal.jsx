import React from 'react';
import { X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', confirmColor = 'bg-red-500' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border panel-bg p-5 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-primary-label">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-secondary-label hover:bg-highlight hover:text-primary-label transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-secondary-label mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-primary-label hover:bg-highlight transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 ${confirmColor}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
