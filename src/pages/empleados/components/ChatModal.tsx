import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/base/Modal';
import { useAuth } from '@/context/AuthContext';
import { useChatMessages } from '@/hooks/useChatMessages';

interface Props {
  employeeName: string;
  onClose: () => void;
}

export default function ChatModal({ employeeName, onClose }: Props) {
  const { user } = useAuth();
  const { messages, sendMessage } = useChatMessages('employee', employeeName);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const sender = user?.full_name || 'Tú';
    sendMessage(input.trim(), sender);
    setInput('');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="md" className="h-[80vh]">
      <div className="flex flex-col h-[calc(80vh-80px)]">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-700 mb-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <i className="ri-user-line text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">{employeeName}</h3>
            <p className="text-xs text-green-500">En línea</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
              <i className="ri-chat-1-line text-3xl mb-2" />
              <p className="text-sm">Sin mensajes. ¡Empieza la conversación!</p>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.sender_name === (user?.full_name || 'Tú');
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>

                {/* Avatar del empleado en mensajes recibidos */}
                {!mine && (
                  <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 self-end">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                      {employeeName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Burbuja */}
                <div className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm
                  ${mine
                    ? 'bg-orange-500 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-bl-sm'
                  }`}>
                  {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender_name}</p>}
                  <p>{m.text}</p>
                  <p className={`text-[10px] mt-1 text-right ${mine ? 'text-orange-100' : 'text-gray-400 dark:text-slate-500'}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>

                {/* Avatar propio en mensajes enviados */}
                {mine && (
                  <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 self-end">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                      {(user?.full_name || 'T').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-gray-100 dark:border-slate-700 pt-3 flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
          />
          <button onClick={send} className="w-9 h-9 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            <i className="ri-send-plane-fill text-sm" />
          </button>
        </div>
      </div>
    </Modal>
  );
}