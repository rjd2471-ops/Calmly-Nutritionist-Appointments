/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  undoAction?: () => void;
  undoLabel?: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (item: Omit<ToastItem, 'id'>) => string;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = crypto.randomUUID();
      const newToast: ToastItem = { ...item, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = item.durationMs ?? (item.undoAction ? 6000 : 4000);
      setTimeout(() => {
        hideToast(id);
      }, duration);

      return id;
    },
    [hideToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl shadow-lg border border-stone-200/80 bg-white/95 backdrop-blur-sm text-stone-900 transition-all duration-200 text-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-sky-600 shrink-0" />}
              <span className="truncate">{toast.message}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.undoAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.undoAction?.();
                    hideToast(toast.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {toast.undoLabel || 'Undo'}
                </button>
              )}
              <button
                type="button"
                onClick={() => hideToast(toast.id)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
