import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import PremiumGate from '@/components/feature/PremiumGate';
import { useAssistantChat } from '@/hooks/useAssistantChat';

interface Conversation {
  id: number;
  title: string;
  date: string;
}

interface QuickAction {
  icon: string;
  label: string;
  color: string;
}

const quickActions: QuickAction[] = [
  { icon: 'ri-group-line', label: 'Ver mis clientes activos', color: 'bg-blue-50 text-blue-600' },
  { icon: 'ri-box-3-line', label: 'Alertas de stock bajo', color: 'bg-red-50 text-red-600' },
  { icon: 'ri-bill-line', label: 'Facturas pendientes de cobro', color: 'bg-amber-50 text-amber-600' },
  { icon: 'ri-bar-chart-box-line', label: 'Dame un resumen general', color: 'bg-green-50 text-green-600' },
  { icon: 'ri-map-2-line', label: 'Rutas y entregas de hoy', color: 'bg-purple-50 text-purple-600' },
  { icon: 'ri-team-line', label: 'Estado del equipo', color: 'bg-cyan-50 text-cyan-600' },
  { icon: 'ri-user-add-line', label: 'Crea un nuevo cliente', color: 'bg-indigo-50 text-indigo-600' },
  { icon: 'ri-calendar-event-line', label: 'Añade un evento al calendario', color: 'bg-pink-50 text-pink-600' },
];

export default function Asistente() {
  const { profile } = useProfile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, setMessages, isLoading, executeAction, cancelAction, sendMessage } = useAssistantChat();

  useEffect(() => {
    supabase.from('assistant_conversations').select('id, title, created_at').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => {
        if (data) setConversations(data.map((c: any) => ({
          id: c.id, title: c.title,
          date: new Date(c.created_at).toDateString() === new Date().toDateString() ? 'Hoy' : new Date(c.created_at).toLocaleDateString('es-ES'),
        })));
      });
  }, []);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    const query = inputValue;
    setInputValue('');
    sendMessage(query, (conv) => {
      setConversations(prev => [{ id: conv.id, title: conv.title, date: 'Hoy' }, ...prev.slice(0, 29)]);
    });
  };

  return (
    <PremiumGate>
      <div className="h-[calc(100vh-4rem-92px)] md:h-[calc(100vh-4rem)] flex -mx-6 -mt-6 flex-col md:flex-row">
        {/* Left sidebar */}
        <div className="w-full md:w-64 bg-gray-50 dark:bg-slate-800/50 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-sparkling-line text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800 dark:text-slate-100">Asistente IA</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Powered by Quickly</p>
              </div>
            </div>
            <button
              onClick={() => setMessages([])}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all"
            >
              <i className="ri-add-line" />
              Nueva conversación
            </button>
          </div>

          <div className="hidden md:block flex-1 overflow-y-auto p-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setMessages([])}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-all text-left"
              >
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <i className="ri-chat-3-line text-gray-400 dark:text-slate-500" />
                </div>
                <span className="truncate flex-1">{conv.title}</span>
                {conv.date !== 'Hoy' && conv.date !== 'Ayer' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); supabase.from('assistant_conversations').delete().eq('id', conv.id); setConversations(prev => prev.filter(c => c.id !== conv.id)); }}
                    className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-red-500"
                  >
                    <i className="ri-delete-bin-line text-xs" />
                  </button>
                )}
              </button>
            ))}
          </div>

          <div className="hidden md:block p-3 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{(profile.full_name || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="text-sm text-gray-600 dark:text-slate-300 truncate">{profile.full_name || 'Tu cuenta'}</span>
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
          {/* Header */}
          <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-sparkling-line text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-800 dark:text-slate-100">Asistente Quickly</span>
              <span className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </div>

          {/* Chat content */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-4">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <i className="ri-sparkling-line text-orange-600 dark:text-orange-400 text-2xl" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">¿En qué puedo ayudarte?</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 text-center max-w-md mb-2">
                  Soy tu asistente inteligente con acceso a los datos de tu empresa. Puedo analizar clientes, facturas, stock, rutas y empleados, y ayudarte a tomar decisiones.
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-8">
                  I also speak English, French, German, Portuguese, Italian and more. Just write in your language.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full px-4">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputValue(action.label);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-500/40 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-all text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color}`}>
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className={action.icon} />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm
                      ${msg.isUser
                        ? 'bg-orange-500 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-md'
                      }`}>
                      <p>{msg.text}</p>

                      {/* Data cards for AI responses */}
                      {!msg.isUser && msg.dataCards && msg.dataCards.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                          {msg.dataCards.map((card, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-700/50 rounded-lg p-2.5 border border-gray-200/60 dark:border-slate-600/60">
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-4 h-4 flex items-center justify-center">
                                  <i className={`${card.icon} text-orange-500 text-xs`} />
                                </div>
                                <span className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">{card.title}</span>
                              </div>
                              <p className="text-sm font-bold text-gray-800 dark:text-slate-100">{card.value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className={`text-xs mt-1 ${msg.isUser ? 'text-orange-100' : 'text-gray-400 dark:text-slate-500'}`}>{msg.time}</p>

                      {/* Tarjeta de confirmación de acción */}
                      {!msg.isUser && msg.pendingAction && (
                        <div className="mt-3 p-3 bg-white dark:bg-slate-700/50 rounded-xl border border-orange-200 dark:border-orange-700/40">
                          <div className="flex items-start gap-2 mb-2">
                            <i className="ri-flashlight-line text-orange-500 mt-0.5" />
                            <p className="text-sm text-gray-700 dark:text-slate-200">{msg.pendingAction.summary}</p>
                          </div>
                          {msg.actionStatus === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => executeAction(msg.id, msg.pendingAction!.type, msg.pendingAction!.params)}
                                className="flex-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => cancelAction(msg.id)}
                                className="px-3 py-1.5 bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-gray-200"
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
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-6 pt-4 pb-[calc(1rem+92px)] md:pb-4 border-t border-gray-100 dark:border-slate-700 flex-shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                  placeholder="Escribe tu pregunta o tarea..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm text-gray-800 dark:text-slate-200 outline-none focus:bg-gray-100 dark:focus:bg-slate-700 pr-10"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                <i className="ri-send-plane-fill" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PremiumGate>
  );
}
