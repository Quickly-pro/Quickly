import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: number;
  sender_id: string | null;
  sender_name: string;
  sender_type: string;
  channel: string;
  target_id: string | null;
  text: string;
  avatar_url: string | null;
  created_at: string;
  edited_at: string | null;
  hidden_for: string[];
  reply_to_id: number | null;
  forwarded: boolean;
  read_by: string[];
  starred_by: string[];
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
      setMessages(data as ChatMessage[]);
      if (data.length > 0) {
        lastIdRef.current = data[data.length - 1].id;
      }
    }
    setLoading(false);
  }, [channel, targetId]);

  // ── Send ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, senderName: string, avatarUrl?: string, extra?: { replyToId?: number | null; forwarded?: boolean }): Promise<boolean> => {
      if (channel === '__none__') return false;
      setSendError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) console.error('Error obteniendo usuario:', userError);

      const payload = {
        sender_id: user?.id ?? null,
        sender_name: senderName || 'Usuario',
        text,
        channel,
        target_id: targetId ?? null,
        avatar_url: avatarUrl ?? null,
        sender_type: 'user',
        reply_to_id: extra?.replyToId ?? null,
        forwarded: extra?.forwarded ?? false,
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

  // ── Editar mensaje propio ────────────────────────────────────────────
  const editMessage = useCallback(async (messageId: number, newText: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('edit_chat_message', { p_message_id: messageId, p_new_text: newText });
    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error };

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: newText, edited_at: new Date().toISOString() } : m));
    return { success: true };
  }, []);

  // ── Eliminar para todos (solo mensajes propios) ──────────────────────
  const deleteForEveryone = useCallback(async (messageId: number): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('delete_chat_message_everyone', { p_message_id: messageId });
    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error };

    setMessages(prev => prev.filter(m => m.id !== messageId));
    return { success: true };
  }, []);

  // ── Ocultar solo para mí ──────────────────────────────────────────────
  const hideForMe = useCallback(async (messageId: number): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('hide_chat_message_for_me', { p_message_id: messageId });
    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error };

    setMessages(prev => prev.filter(m => m.id !== messageId));
    return { success: true };
  }, []);

  // ── Marcar mensajes de esta conversación como leídos ─────────────────
  const markAsRead = useCallback(async () => {
    if (channel === '__none__') return;
    const { error } = await supabase.rpc('mark_messages_read', { p_channel: channel, p_target_id: targetId ?? null });
    if (error) console.error('Error marcando mensajes como leídos:', error);
  }, [channel, targetId]);

  // ── Destacar / quitar destacado ────────────────────────────────────────
  const toggleStar = useCallback(async (messageId: number): Promise<{ success: boolean; starred?: boolean; error?: string }> => {
    const { data, error } = await supabase.rpc('toggle_star_message', { p_message_id: messageId });
    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error };
    return { success: true, starred: data.starred };
  }, []);

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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          if (!updated?.id) return;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` },
        (payload) => {
          const deletedId = (payload.old as { id?: number })?.id;
          if (!deletedId) return;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
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

  return { messages, loading, sendError, tableError, sendMessage, editMessage, deleteForEveryone, hideForMe, markAsRead, toggleStar, refetch: fetchMessages };
}
