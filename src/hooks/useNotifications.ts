import { useState, useCallback } from 'react';

export interface Notification {
  id: number;
  text: string;
  type: 'invoice' | 'route' | 'stock' | 'order' | 'system';
  time: string;
  read: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, text: 'Nueva factura creada - Factura #F-2026-042', type: 'invoice', time: 'Hace 2 min', read: false },
    { id: 2, text: 'Ruta #5 completada - Carlos entregó 8 paradas', type: 'route', time: 'Hace 15 min', read: false },
    { id: 3, text: 'Stock bajo: Aceite Oliva 5L (quedan 3 unidades)', type: 'stock', time: 'Hace 30 min', read: true },
    { id: 4, text: 'Pedido PED-100005 confirmado y pagado', type: 'order', time: 'Hace 1 hora', read: true },
    { id: 5, text: 'Ruta #3 en camino - María salió del almacén', type: 'route', time: 'Hace 2 horas', read: true },
  ]);

  const addNotification = useCallback((text: string, type: Notification['type']) => {
    const newNotif: Notification = {
      id: Date.now(),
      text,
      type,
      time: 'Ahora',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, addNotification, markAllRead, markRead, unreadCount };
}