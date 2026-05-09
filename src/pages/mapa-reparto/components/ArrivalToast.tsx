import { useEffect, useState } from 'react';

interface Toast {
  id: number;
  vehicleName: string;
  destination: string;
  color: string;
}

let toastId = 0;

export function useArrivalToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (vehicleName: string, destination: string, color: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, vehicleName, destination, color }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, pushToast, removeToast };
}

export function ArrivalToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 shadow-lg rounded-xl px-4 py-3 min-w-[280px] max-w-[340px] animate-[slideIn_0.4s_ease-out]"
          style={{ animationFillMode: 'both' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: toast.color + '20', color: toast.color }}
          >
            <i className="ri-truck-line text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
              {toast.vehicleName} ha llegado
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
              Destino: {toast.destination}
            </p>
          </div>
          <button
            onClick={() => onClose(toast.id)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 flex-shrink-0"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      ))}
    </div>
  );
}