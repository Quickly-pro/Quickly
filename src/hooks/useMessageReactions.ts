import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

/**
 * Trae y mantiene sincronizadas (realtime) las reacciones de todos los
 * mensajes visibles. Devuelve un mapa messageId -> lista de reacciones
 * agrupadas por emoji, listo para pintar debajo de cada burbuja.
 */
export function useMessageReactions(messageIds: number[], myUserId?: string | null) {
  const [raw, setRaw] = useState<{ message_id: number; user_id: string; emoji: string }[]>([]);

  const fetchReactions = useCallback(async () => {
    if (messageIds.length === 0) { setRaw([]); return; }
    const { data, error } = await supabase
      .from('chat_message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);
    if (error) console.error('Error cargando reacciones:', error);
    if (data) setRaw(data);
  }, [messageIds.join(',')]);

  useEffect(() => {
    fetchReactions();

    const sub = supabase
      .channel(`reactions_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, () => {
        fetchReactions();
      })
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [fetchReactions]);

  const byMessage = useCallback((messageId: number): ReactionSummary[] => {
    const rows = raw.filter(r => r.message_id === messageId);
    const groups = new Map<string, { count: number; mine: boolean }>();
    for (const r of rows) {
      const g = groups.get(r.emoji) || { count: 0, mine: false };
      g.count += 1;
      if (r.user_id === myUserId) g.mine = true;
      groups.set(r.emoji, g);
    }
    return Array.from(groups.entries()).map(([emoji, g]) => ({ emoji, count: g.count, mine: g.mine }));
  }, [raw, myUserId]);

  const react = useCallback(async (messageId: number, emoji: string) => {
    const { error } = await supabase.rpc('react_to_message', { p_message_id: messageId, p_emoji: emoji });
    if (error) console.error('Error al reaccionar al mensaje:', error);
    fetchReactions();
  }, [fetchReactions]);

  return { byMessage, react };
}
