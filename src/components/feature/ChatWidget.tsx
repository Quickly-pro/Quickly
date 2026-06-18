import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useChatMessages } from '@/hooks/useChatMessages';
import EmojiPicker from '@/components/base/EmojiPicker';
import ChatInputAddons from '@/components/base/ChatInputAddons';
import MessageContent from '@/components/base/MessageContent';

function fireChatNotif(senderName: string, text: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const body = text.length > 80 ? text.slice(0, 80) + '…' : text;
  const n = new Notification(`💬 ${senderName}`, { body, icon: '/favicon.svg' });
  n.onclick = () => { window.focus(); n.close(); };
  setTimeout(() => n.close(), 6000);
}

export default function ChatWidget() {
  const { user } = useAuth();
  const { isEmpleado, isCliente } = useRole();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const prevCountRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, sendError } = useChatMessages('general');

  // Notificación push cuando llega un mensaje nuevo y la pestaña está en segundo plano
  const prevLengthRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLengthRef.current === null) { prevLengthRef.current = messages.length; return; }
    if (messages.length > prevLengthRef.current) {
      const newMsgs = messages.slice(prevLengthRef.current);
      for (const msg of newMsgs) {
        if (msg.sender_name !== (user?.full_name || 'Tú')) {
          fireChatNotif(msg.sender_name || 'Nuevo mensaje', msg.text);
        }
      }
      prevLengthRef.current = messages.length;
    }
  }, [messages, user?.full_name]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      prevCountRef.current = messages.length;
    } else if (messages.length > prevCountRef.current) {
      setUnread(messages.length - prevCountRef.current);
    }
  }, [messages.length, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = () => {
    if (!input.trim()) return;
    sendMessage(input.trim(), user?.full_name || 'Tú', user?.avatar_url || undefined);
    setInput('');
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  if (!isEmpleado && !isCliente) return null;

  return (
    <div className="fixed z-50 flex flex-col items-end sm:bottom-4 sm:right-4 bottom-[72px] right-3">

      {open && (
        <div
          className="mb-3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-orange-500/15 overflow-hidden"
          style={{
            width: 'min(390px, calc(100vw - 12px))',
            height: 'min(580px, calc(100svh - 160px))',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-orange-500 dark:bg-orange-600 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <i className="ri-building-line text-white text-sm" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">Empresa</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full" />
                  <p className="text-white/80 text-xs">Chat en tiempo real</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-slate-900/50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 dark:text-slate-500 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                  <i className="ri-chat-private-line text-orange-400 text-xl" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Sin mensajes aún</p>
                <p className="text-xs">Escribe un mensaje y la empresa te responderá en tiempo real</p>
              </div>
            ) : (
              messages.map(msg => {
                const mine = msg.sender_name === (user?.full_name || 'Tú');
                return (
                  <div key={msg.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {!mine && (
                      <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 self-end text-orange-600 dark:text-orange-400 font-bold text-xs">
                        {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm shadow-sm
                      ${mine
                        ? 'bg-orange-500 text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-sm border border-gray-100 dark:border-slate-700'}`}>
                      {!mine && (
                        <p className="text-[10px] font-semibold opacity-60 mb-0.5">{msg.sender_name}</p>
                      )}
                      <MessageContent text={msg.text} mine={mine} />
                      <p className={`text-[10px] mt-1 text-right ${mine ? 'text-orange-100' : 'text-gray-400 dark:text-slate-500'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                    {mine && (
                      <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 self-end text-orange-600 dark:text-orange-400 font-bold text-xs">
                        {(user?.full_name || 'T').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-2 py-2 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 space-y-1.5">
            {sendError && (
              <div className="flex items-start gap-1.5 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                <i className="ri-error-warning-line text-red-500 text-xs mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-red-600 dark:text-red-400 leading-tight">{sendError}</p>
              </div>
            )}
            <div className="flex items-center gap-1 min-w-0">
              <EmojiPicker onSelect={emoji => setInput(prev => prev + emoji)} direction="up" />
              <ChatInputAddons
                onSendAttachment={att => sendMessage(att, user?.full_name || 'Tú', user?.avatar_url || undefined)}
              />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Escribe un mensaje..."
                className="flex-1 min-w-0 px-2 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 border border-transparent focus:border-orange-300 dark:focus:border-orange-500/40 transition-colors"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="w-9 h-9 flex items-center justify-center bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all disabled:opacity-40 flex-shrink-0"
              >
                <i className="ri-send-plane-fill text-sm" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center relative bg-orange-500 hover:bg-orange-600"
        title={open ? 'Cerrar chat' : 'Empresa'}
      >
        <i className={`${open ? 'ri-close-line' : 'ri-chat-1-line'} text-xl transition-all`} />
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
