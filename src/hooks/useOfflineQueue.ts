import { useState, useEffect, useCallback, useRef } from 'react';

export interface QueuedAction<T = any> {
  id: string;
  type: string;
  payload: T;
  createdAt: number;
}

/**
 * Cola de acciones pendientes para cuando no hay conexión. Guarda cada
 * acción en localStorage (sobrevive a cerrar la app) y las reintenta
 * automáticamente en orden en cuanto vuelve la señal.
 *
 * `processors` es un mapa "tipo de acción" -> función que la ejecuta de
 * verdad contra Supabase. Si una acción falla al reintentarla, se detiene
 * ahí (no se pierde ni se salta) y lo reintenta en el próximo evento online.
 */
export function useOfflineQueue(storageKey: string, processors: Record<string, (payload: any) => Promise<void>>) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueLength, setQueueLength] = useState(0);
  const processingRef = useRef(false);
  const processorsRef = useRef(processors);
  processorsRef.current = processors;

  const readQueue = (): QueuedAction[] => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  };

  const writeQueue = (q: QueuedAction[]) => {
    localStorage.setItem(storageKey, JSON.stringify(q));
    setQueueLength(q.length);
  };

  useEffect(() => { setQueueLength(readQueue().length); }, [storageKey]);

  const enqueue = useCallback((type: string, payload: any) => {
    const action: QueuedAction = { id: crypto.randomUUID(), type, payload, createdAt: Date.now() };
    const next = [...readQueue(), action];
    writeQueue(next);
  }, [storageKey]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || !navigator.onLine) return;
    processingRef.current = true;
    let current = readQueue();
    while (current.length > 0 && navigator.onLine) {
      const [next, ...rest] = current;
      const processor = processorsRef.current[next.type];
      if (!processor) { current = rest; writeQueue(current); continue; }
      try {
        await processor(next.payload);
        current = rest;
        writeQueue(current);
      } catch {
        break; // deja el resto en cola — se reintenta en el próximo "online"
      }
    }
    processingRef.current = false;
  }, [storageKey]);

  useEffect(() => {
    const goOnline = () => { setIsOnline(true); processQueue(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (navigator.onLine) processQueue();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, queueLength, enqueue, processQueue };
}
