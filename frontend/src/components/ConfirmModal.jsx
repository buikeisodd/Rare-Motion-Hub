import React from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', confirmColor = 'bg-red-500' }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-sm rounded-2xl border border-border panel-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
