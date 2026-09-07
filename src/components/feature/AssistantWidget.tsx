import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import PremiumGate from './PremiumGate';

const quickPrompts = [
  'Resumen general',
  'Clientes activos',
  'Facturas pendientes',
  'Rutas de hoy',
];

export default function AssistantWidget() {
  const { isCliente, isGuest } = useRole();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, executeAction, cancelAction, sendMessage } = useAssistantChat();

  useEffect(() => {
    if (open) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleSend = (text?: string) => {
    const query = (text ?? inputValue).trim();
    if (!query || isLoading) return;
    setInputValue('');
    sendMessage(query);
  };

  // El Asistente IA no está disponible para clientes ni invitados —
  // misma regla de acceso que la página completa (ver permissions.ts).
  if (isCliente || isGuest) return null;

  return (
    <div className="fixed z-50 flex flex-col items-end bottom-[140px] right-3 sm:bottom-[88px] sm:right-4">
      {open && (
        <div
          className="assistant-panel-in mb-3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-purple-500/15 overflow-hidden"
          style={{
            width: 'min(390px, calc(100vw - 12px))',
            height: 'min(560px, calc(100svh - 230px))',
          }}
        >
          <PremiumGate
            fallback={
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <i className="ri-vip-crown-line text-amber-500 text-2xl" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">Función Premium</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-[240px]">
                  Activa el plan Premium para hablar con el Asistente IA.
                </p>
                <Link
                  to="/asistente"
                  onClick={() => setOpen(false)}
                  className="mt-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-all"
                >
                  Ver más
                </Link>
              </div>
            }
          >
            <>
              {/* Header */}
              <div className="assistant-widget-header px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <i className="ri-sparkling-2-fill text-white text-sm" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">Asistente IA</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-green-300 rounded-full" />
                      <p className="text-white/80 text-xs">Powered by Quickly</p>
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
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/50 dark:bg-slate-900/50">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <i className="ri-sparkling-2-line text-purple-500 dark:text-purple-400 text-xl" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-slate-300">¿En qué puedo ayudarte?</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {quickPrompts.map((p) => (
                        <button
                          key={p}
                          onClick={() => handleSend(p)}
                          className="px-2.5 py-1 rounded-full text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm
                        ${msg.isUser
                          ? 'assistant-bubble-user text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-sm border border-gray-100 dark:border-slate-700'
                        }`}>
                        <p className="whitespace-pre-line">{msg.text}</p>

                        {!msg.isUser && msg.dataCards && msg.dataCards.length > 0 && (
                          <div className="grid grid-cols-1 gap-1.5 mt-2">
                            {msg.dataCards.map((card, idx) => (
                              <div key={idx} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-2 py-1.5 border border-gray-200/60 dark:border-slate-600/60 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <i className={`${card.icon} text-purple-500 text-xs flex-shrink-0`} />
                                  <span className="text-xs text-gray-700 dark:text-slate-200 truncate">{card.title}</span>
                                </div>
                                <span className="text-xs font-bold text-gray-800 dark:text-slate-100 flex-shrink-0">{card.value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className={`text-[10px] mt-1 ${msg.isUser ? 'text-white/70' : 'text-gray-400 dark:text-slate-500'}`}>{msg.time}</p>

                        {!msg.isUser && msg.pendingAction && (
                          <div className="mt-2 p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-purple-200 dark:border-purple-700/40">
                            <div className="flex items-start gap-1.5 mb-2">
                              <i className="ri-flashlight-line text-purple-500 mt-0.5 text-xs" />
                              <p className="text-xs text-gray-700 dark:text-slate-200">{msg.pendingAction.summary}</p>
                            </div>
                            {msg.actionStatus === 'pending' && (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => executeAction(msg.id, msg.pendingAction!.type, msg.pendingAction!.params)}
                                  className="flex-1 px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => cancelAction(msg.id)}
                                  className="px-2.5 py-1.5 bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-gray-200"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                            {msg.actionStatus === 'done' && (
                              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><i className="ri-check-line" /> Hecho</p>
                            )}
                            {msg.actionStatus === 'cancelled' && (
                              <p className="text-xs text-gray-400">Cancelado</p>
                            )}
                            {msg.actionStatus === 'error' && (
                              <p className="text-xs text-red-500 flex items-center gap-1"><i className="ri-error-warning-line" /> {msg.actionError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div className="px-2 py-2 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                    placeholder="Escribe tu pregunta o tarea..."
                    className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 border border-transparent focus:border-purple-300 dark:focus:border-purple-500/40 transition-colors"
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={isLoading || !inputValue.trim()}
                    className="w-9 h-9 flex items-center justify-center assistant-bubble-user text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 flex-shrink-0"
                  >
                    <i className="ri-send-plane-fill text-sm" />
                  </button>
                </div>
              </div>
            </>
          </PremiumGate>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="assistant-fab w-14 h-14 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center relative"
        title={open ? 'Cerrar asistente' : 'Asistente IA'}
      >
        <i className={`${open ? 'ri-close-line' : 'ri-sparkling-2-fill'} text-xl transition-all`} />
      </button>
    </div>
  );
}
