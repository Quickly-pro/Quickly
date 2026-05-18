import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import PremiumGate from '@/components/feature/PremiumGate';

interface Conversation {
  id: number;
  title: string;
  date: string;
}

const demoConversations: Conversation[] = [
  { id: 1, title: '¿me puedes ayudar?', date: 'Hoy' },
  { id: 2, title: 'Nueva conversación', date: 'Hoy' },
  { id: 3, title: '¿Qué productos tienen...', date: 'Ayer' },
  { id: 4, title: '¿Cuáles son las factura...', date: 'Ayer' },
  { id: 5, title: 'Nueva conversación', date: '28/04/2026' },
  { id: 6, title: 'Resumen de pedidos', date: '29/4/2026' },
];

interface QuickAction {
  icon: string;
  label: string;
  color: string;
}

const quickActions: QuickAction[] = [
  { icon: 'ri-group-line', label: 'Ver mis clientes activos', color: 'bg-blue-50 text-blue-600' },
  { icon: 'ri-box-3-line', label: 'Alertas de stock bajo', color: 'bg-red-50 text-red-600' },
  { icon: 'ri-bill-line', label: 'Facturas pendientes', color: 'bg-amber-50 text-amber-600' },
  { icon: 'ri-map-2-line', label: 'Rutas de hoy', color: 'bg-green-50 text-green-600' },
];

interface ChatMessage {
  id: number;
  text: string;
  isUser: boolean;
  time: string;
  dataCards?: { title: string; value: string; icon: string }[];
  listItems?: { label: string; detail: string }[];
}

export default function Asistente() {
  const [conversations, setConversations] = useState<Conversation[]>(demoConversations);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const processQuery = async (query: string) => {
    const q = query.toLowerCase();

    // CLIENTES ACTIVOS
    if (q.includes('cliente') || q.includes('clientes')) {
      const { data } = await supabase.from('clients').select('*').eq('status', 'activo').order('name');
      const count = data?.length || 0;
      return {
        text: `Tienes ${count} cliente${count !== 1 ? 's' : ''} activo${count !== 1 ? 's' : ''} en este momento.`,
        dataCards: data?.slice(0, 4).map(c => ({
          title: c.name,
          value: `€${(c.total_spent || 0).toLocaleString()}`,
          icon: 'ri-store-2-line',
        })),
      };
    }

    // FACTURAS PENDIENTES
    if (q.includes('factura') || q.includes('facturas') || q.includes('cobro') || q.includes('cobros')) {
      const { data } = await supabase.from('invoices').select('*').eq('status', 'pendiente').order('due_date');
      const count = data?.length || 0;
      const total = data?.reduce((s, i) => s + Number(i.amount || 0), 0) || 0;
      return {
        text: `Hay ${count} factura${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''} de cobro, por un total de €${total.toFixed(2)}.`,
        dataCards: data?.slice(0, 4).map(inv => ({
          title: inv.client,
          value: `€${Number(inv.amount).toFixed(2)}`,
          icon: 'ri-bill-line',
        })),
      };
    }

    // STOCK BAJO
    if (q.includes('stock') || q.includes('producto') || q.includes('productos') || q.includes('inventario')) {
      const { data } = await supabase.from('product_items').select('*, product_categories(id, name)').eq('status', 'active');
      const lowStock = data?.filter(p => (p.stock || 0) < 10) || [];
      return {
        text: `Hay ${lowStock.length} producto${lowStock.length !== 1 ? 's' : ''} con stock bajo (menos de 10 unidades).`,
        dataCards: lowStock.slice(0, 4).map(p => ({
          title: p.name,
          value: `${p.stock} unid.`,
          icon: 'ri-box-3-line',
        })),
      };
    }

    // RUTAS DE HOY
    if (q.includes('ruta') || q.includes('rutas') || q.includes('reparto') || q.includes('entrega')) {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('routes').select('*').gte('date', today).order('date');
      const count = data?.length || 0;
      return {
        text: `Hay ${count} ruta${count !== 1 ? 's' : ''} programada${count !== 1 ? 's' : ''} para hoy.`,
        dataCards: data?.slice(0, 4).map(r => ({
          title: `Ruta ${r.id}`,
          value: r.status || 'Programada',
          icon: 'ri-truck-line',
        })),
      };
    }

    // EMPLEADOS / HORAS
    if (q.includes('empleado') || q.includes('empleados') || q.includes('horas')) {
      const { data } = await supabase.from('employees').select('*').order('name');
      const count = data?.length || 0;
      return {
        text: `La empresa tiene ${count} empleado${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''}.`,
        dataCards: data?.slice(0, 4).map(e => ({
          title: e.name,
          value: `${e.hours_this_month || 0}h este mes`,
          icon: 'ri-user-line',
        })),
      };
    }

    // PEDIDOS
    if (q.includes('pedido') || q.includes('pedidos') || q.includes('orden')) {
      const { data } = await supabase.from('order_headers').select('*').order('created_at', { ascending: false }).limit(5);
      const count = data?.length || 0;
      return {
        text: `Hay ${count} pedidos recientes en el sistema.`,
        dataCards: data?.map(o => ({
          title: `PED-${o.id}`,
          value: o.status || 'Pendiente',
          icon: 'ri-shopping-cart-2-line',
        })),
      };
    }

    // INCIDENCIAS
    if (q.includes('incidencia') || q.includes('incidencias') || q.includes('problema') || q.includes('vehiculo')) {
      const { data } = await supabase.from('vehicle_incidents').select('*').order('created_at', { ascending: false }).limit(5);
      const count = data?.length || 0;
      return {
        text: `Hay ${count} incidencia${count !== 1 ? 's' : ''} de vehículo${count !== 1 ? 's' : ''} registrada${count !== 1 ? 's' : ''}.`,
        dataCards: data?.map(i => ({
          title: i.type || 'Incidencia',
          value: i.status || 'Abierta',
          icon: 'ri-error-warning-line',
        })),
      };
    }

    // COMBUSTIBLE
    if (q.includes('combustible') || q.includes('gasolina') || q.includes('diesel') || q.includes('repostar')) {
      const { data } = await supabase.from('fuel_tickets').select('*').order('date', { ascending: false }).limit(5);
      const totalLitros = data?.reduce((s, t) => s + Number(t.liters || 0), 0) || 0;
      return {
        text: `El consumo reciente de combustible suma ${totalLitros.toFixed(1)} litros en total.`,
        dataCards: data?.slice(0, 4).map(t => ({
          title: t.station || 'Estación',
          value: `${t.liters || 0}L (€${Number(t.cost || 0).toFixed(2)})`,
          icon: 'ri-gas-station-line',
        })),
      };
    }

    // ESTADÍSTICAS / RESUMEN
    if (q.includes('estadistica') || q.includes('resumen') || q.includes('dashboard') || q.includes('general')) {
      const [{ data: clients }, { data: invoices }, { data: orders }] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('*').eq('status', 'pendiente'),
        supabase.from('order_headers').select('*', { count: 'exact', head: true }),
      ]);
      const pendingTotal = invoices?.reduce((s, i) => s + Number(i.amount || 0), 0) || 0;
      return {
        text: 'Aquí tienes el resumen general de la empresa:',
        dataCards: [
          { title: 'Clientes', value: `${(clients as any)?.length || 0}`, icon: 'ri-group-line' },
          { title: 'Facturas Pendientes', value: `€${pendingTotal.toFixed(2)}`, icon: 'ri-bill-line' },
          { title: 'Pedidos', value: `${(orders as any)?.length || 0}`, icon: 'ri-shopping-cart-2-line' },
          { title: 'Ingresos Hoy', value: '€0.00', icon: 'ri-money-euro-circle-line' },
        ],
      };
    }

    // DEFAULT
    return {
      text: 'Puedo ayudarte con información de clientes, facturas, stock, rutas, empleados, pedidos e incidencias. ¿Qué necesitas consultar?',
    };
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      text: inputValue,
      isUser: true,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };
    addMessage(userMsg);
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await processQuery(inputValue);
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        text: result.text,
        isUser: false,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        dataCards: result.dataCards,
      };
      addMessage(aiMsg);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: Date.now() + 1,
        text: 'Lo siento, hubo un error consultando los datos. Inténtalo de nuevo en un momento.',
        isUser: false,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      };
      addMessage(fallbackMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PremiumGate>
      <div className="h-[calc(100vh-4rem)] flex -mx-6 -mt-6 flex-col md:flex-row">
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
                    onClick={(e) => { e.stopPropagation(); setConversations(prev => prev.filter(c => c.id !== conv.id)); }}
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
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Al</span>
              </div>
              <span className="text-sm text-gray-600 dark:text-slate-300">Alex</span>
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
                <p className="text-sm text-gray-500 dark:text-slate-400 text-center max-w-md mb-8">
                  Soy tu asistente inteligente. Puedo responder dudas, consultar datos de clientes, rutas, facturas y ayudarte a automatizar tareas de tu empresa.
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
          <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                  placeholder="Escribe tu pregunta o tarea..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm text-gray-800 dark:text-slate-200 outline-none focus:bg-gray-100 dark:focus:bg-slate-700 pr-10"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={sendMessage}
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