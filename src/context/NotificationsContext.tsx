import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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

async function fireBrowserNotif(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;

  try {
    // En apps instaladas (TWA/PWA) el navegador exige pasar por el Service
    // Worker en vez del constructor directo — si no, lanza "Illegal
    // constructor" y (si nadie lo atrapa) puede tirar abajo la pantalla.
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: '/favicon.svg' });
      return;
    }
  } catch {
    // seguir al método clásico de abajo
  }

  try {
    const n = new Notification(title, { body, icon: '/favicon.svg' });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  } catch {
    // Una notificación fallida nunca debe romper la app — se ignora en silencio.
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days !== 1 ? 's' : ''}`;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
    return result === 'granted';
  }, []);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); return; }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data.map((n: any) => ({
        id: n.id,
        title: n.title || '',
        text: n.text || '',
        type: (n.type || 'system') as NotifType,
        time: timeAgo(n.created_at),
        read: !!n.read,
      })));
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;

    const sub = supabase
      .channel(`notifications_${user.id}_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [user, fetchNotifications]);

  const addNotification = useCallback((title: string, text: string, type: NotifType) => {
    if (!user) return;
    // Optimista: se muestra ya mismo, y luego se sincroniza con la fila real
    const tempId = Date.now();
    setNotifications(prev => [{ id: tempId, title, text, type, time: 'Ahora', read: false }, ...prev]);
    fireBrowserNotif(title, text);

    supabase.from('notifications').insert({ user_id: user.id, title, text, type, read: false })
      .then(() => fetchNotifications());
  }, [user, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (user) await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  }, [user]);

  const markRead = useCallback(async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, []);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    if (user) await supabase.from('notifications').delete().eq('user_id', user.id);
  }, [user]);

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
