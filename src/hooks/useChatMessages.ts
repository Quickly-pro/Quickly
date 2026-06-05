import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: number;
  sender_name: string;
  sender_type: string;
  channel: string;
  target_id: string | null;
  text: string;
  avatar_url: string | null;
  created_at: string;
}

export function useChatMessages(channel: string, targetId?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const lastIdRef = useRef<number>(0);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (channel === '__none__') { setLoading(false); return; }

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(200);

    if (targetId) {
      query = query.eq('target_id', targetId);
    } else {
      query = query.is('target_id', null);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        setTableError('tabla_no_existe');
      } else {
        setTableError(error.message);
      }
      setLoading(false);
      return;
    }

    setTableError(null);
    if (data) {
      setMessages(data);
      if (data.length > 0) {
        lastIdRef.current = data[data.length - 1].id;
      }
    }
    setLoading(false);
  }, [channel, targetId]);

  // ── Send ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, senderName: string, avatarUrl?: string): Promise<boolean> => {
      if (channel === '__none__') return false;
      setSendError(null);

      const payload = {
        sender_name: senderName || 'Usuario',
        text,
        channel,
        target_id: targetId ?? null,
        avatar_url: avatarUrl ?? null,
        sender_type: 'user',
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          setSendError('tabla_no_existe');
        } else if (error.code === '42501' || error.code === 'PGRST301') {
          setSendError('sin_permisos');
        } else {
          setSendError(error.message);
        }
        return false;
      }

      // Añadir el mensaje recién insertado directamente al estado (sin esperar realtime)
      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data as ChatMessage];
        });
        lastIdRef.current = data.id;
      }
      return true;
    },
    [channel, targetId]
  );

  // ── Realtime + polling fallback ────────────────────────────────────────
  useEffect(() => {
    if (channel === '__none__') return;

    fetchMessages();

    // Realtime subscription
    const sub = supabase
      .channel(`chmsg_${channel}_${targetId ?? 'null'}_${Math.random()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (!newMsg?.id) { fetchMessages(); return; }
          if (targetId && newMsg.target_id !== targetId) return;
          if (!targetId && newMsg.target_id !== null) return;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    // Polling cada 4 segundos como red de seguridad
    const poll = setInterval(fetchMessages, 4000);

    return () => {
      sub.unsubscribe();
      clearInterval(poll);
    };
  }, [channel, targetId, fetchMessages]);

  return { messages, loading, sendError, tableError, sendMessage, refetch: fetchMessages };
}
