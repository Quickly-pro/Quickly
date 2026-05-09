import { useState, useEffect, useCallback } from 'react';
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

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true });

    if (targetId) {
      query = query.eq('target_id', targetId);
    } else {
      query = query.is('target_id', null);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  }, [channel, targetId]);

  const sendMessage = useCallback(
    async (text: string, senderName: string, avatarUrl?: string) => {
      const payload = {
        sender_name: senderName,
        text,
        channel,
        target_id: targetId || null,
        avatar_url: avatarUrl || null,
        sender_type: 'user',
      };
      const { error } = await supabase.from('chat_messages').insert(payload);
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Error sending message:', error);
      }
    },
    [channel, targetId]
  );

  useEffect(() => {
    fetchMessages();

    const subscription = supabase
      .channel(`chat_messages_${channel}_${targetId || 'null'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.channel !== channel) return;
          if (targetId && newMsg.target_id !== targetId) return;
          if (!targetId && newMsg.target_id) return;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchMessages, channel, targetId]);

  return { messages, loading, sendMessage, refetch: fetchMessages };
}