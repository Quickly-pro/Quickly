import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Indicador de "escribiendo..." en tiempo real, sin tocar la base de datos:
 * usa un canal de broadcast efímero de Supabase Realtime, como WhatsApp Web.
 */
export function useTypingIndicator(channel: string, targetId: string | null | undefined, myName: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const rtChannelRef = useRef<RealtimeChannel | null>(null);
  const clearTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const key = `typing_${channel}_${targetId ?? 'null'}`;

  useEffect(() => {
    if (channel === '__none__') return;

    const rt = supabase.channel(key, { config: { broadcast: { self: false } } });
    rt.on('broadcast', { event: 'typing' }, (payload) => {
      const name = payload.payload?.name as string;
      if (!name || name === myName) return;

      setTypingUsers(prev => prev.includes(name) ? prev : [...prev, name]);

      if (clearTimers.current[name]) clearTimeout(clearTimers.current[name]);
      clearTimers.current[name] = setTimeout(() => {
        setTypingUsers(prev => prev.filter(n => n !== name));
      }, 3000);
    });
    rt.subscribe();
    rtChannelRef.current = rt;

    return () => {
      rt.unsubscribe();
      Object.values(clearTimers.current).forEach(clearTimeout);
      clearTimers.current = {};
      setTypingUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const notifyTyping = useCallback(() => {
    rtChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { name: myName } });
  }, [myName]);

  return { typingUsers, notifyTyping };
}
