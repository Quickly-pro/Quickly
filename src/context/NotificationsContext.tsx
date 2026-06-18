import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type NotifType = 'invoice' | 'route' | 'stock' | 'order' | 'system' | 'maintenance' | 'email';

export interface AppNotification {
  id: number;
  title: string;
  text: string;
  type: NotifType;
  time: string;
  read: boolean;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (title: string, text: string, type: NotifType) => void;
  markAllRead: () => void;
  markRead: (id: number) => void;
  clearAll: () => void;
  browserPermission: NotificationPermission | 'unsupported';
  requestBrowserPermission: () => Promise<boolean>;
}

function fireBrowserNotif(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const n = new Notification(title, { body, icon: '/favicon.svg' });
  n.onclick = () => { window.focus(); n.close(); };
  setTimeout(() => n.close(), 6000);
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
    return result === 'granted';
  }, []);

  const [notifications, setNotifications] = useState<AppNotification[]>([
    { id: 1001, title: 'Nueva factura', text: 'Factura #F-2026-042 creada para Restaurante El Pino - €1,240.50', type: 'invoice', time: 'Hace 2 min', read: false },
    { id: 1002, title: 'Ruta completada', text: 'Carlos terminó la Ruta #5 con 8 entregas exitosas', type: 'route', time: 'Hace 15 min', read: false },
    { id: 1003, title: 'Stock bajo', text: 'Aceite Oliva 5L quedan solo 3 unidades en almacén', type: 'stock', time: 'Hace 30 min', read: true },
    { id: 1004, title: 'Pedido confirmado', text: 'Pedido PED-100005 confirmado y pagado por €58.50', type: 'order', time: 'Hace 1 hora', read: true },
    { id: 1005, title: 'Ruta en curso', text: 'María salió del almacén con Ruta #3', type: 'route', time: 'Hace 2 horas', read: true },
    { id: 1006, title: 'Factura vencida', text: 'Factura #F-2026-038 de Frutería La Esperanza venció hoy', type: 'invoice', time: 'Hace 3 horas', read: true },
  ]);

  const addNotification = useCallback((title: string, text: string, type: NotifType) => {
    const newNotif: AppNotification = {
      id: Date.now(),
      title,
      text,
      type,
      time: 'Ahora',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
    fireBrowserNotif(title, text);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, markRead, clearAll, browserPermission, requestBrowserPermission }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be used within NotificationsProvider');
  return ctx;
}
