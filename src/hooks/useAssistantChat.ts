import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AssistantMessage {
  id: number;
  text: string;
  isUser: boolean;
  time: string;
  dataCards?: { title: string; value: string; icon: string }[];
  pendingAction?: { type: string; params: any; summary: string };
  actionStatus?: 'pending' | 'done' | 'cancelled' | 'error';
  actionError?: string;
}

const timeNow = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// ── Respuestas locales de respaldo (sin IA) cuando la edge function no
// responde — mismas reglas que usaba la página del Asistente, ahora
// compartidas también con la burbuja flotante.
const ACTION_VERBS = ['crea ', 'crear ', 'crea un', 'crea una', 'añade ', 'anade ', 'agrega ', 'agregar ', 'da de alta', 'dar de alta', 'alta de', 'registra ', 'registrar ', 'apunta ', 'apuntar '];

async function processQueryFallback(query: string) {
  const q = query.toLowerCase();

  // Esto suena a una orden de crear/registrar algo, no a una pregunta — sin
  // conexión con la IA no podemos ejecutar acciones. Decirlo con claridad en
  // vez de responder con un dato suelto (p.ej. un conteo) que no tiene nada
  // que ver con lo que se pidió.
  if (ACTION_VERBS.some((v) => q.includes(v))) {
    return {
      text: 'No he podido conectar con la IA para ejecutar esta acción ahora mismo. Comprueba tu conexión e inténtalo de nuevo en unos segundos.\n\nI could not reach the AI to perform this action right now. Please check your connection and try again shortly.',
    };
  }

  if (q.includes('cliente') || q.includes('clientes') || q.includes('contacto') || q.includes('contactos')) {
    const { data } = await supabase.from('clients').select('*').eq('status', 'activo').order('name');
    const count = data?.length || 0;
    return {
      text: `Tienes ${count} cliente${count !== 1 ? 's' : ''} activo${count !== 1 ? 's' : ''} en este momento.`,
      dataCards: data?.slice(0, 4).map(c => ({ title: c.name, value: `€${(c.total_spent || 0).toLocaleString()}`, icon: 'ri-store-2-line' })),
    };
  }
  if (q.includes('factura') || q.includes('facturas') || q.includes('cobro') || q.includes('cobros')) {
    const { data } = await supabase.from('invoices').select('*').eq('status', 'pendiente').order('due_date');
    const count = data?.length || 0;
    const total = data?.reduce((s, i) => s + Number(i.amount || 0), 0) || 0;
    return {
      text: `Hay ${count} factura${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''} de cobro, por un total de €${total.toFixed(2)}.`,
      dataCards: data?.slice(0, 4).map(inv => ({ title: inv.client, value: `€${Number(inv.amount).toFixed(2)}`, icon: 'ri-bill-line' })),
    };
  }
  if (q.includes('stock') || q.includes('producto') || q.includes('productos') || q.includes('inventario')) {
    const { data } = await supabase.from('product_items').select('*, product_categories(id, name)').eq('status', 'active');
    const lowStock = data?.filter(p => (p.stock || 0) < 10) || [];
    return {
      text: `Hay ${lowStock.length} producto${lowStock.length !== 1 ? 's' : ''} con stock bajo (menos de 10 unidades).`,
      dataCards: lowStock.slice(0, 4).map(p => ({ title: p.name, value: `${p.stock} unid.`, icon: 'ri-box-3-line' })),
    };
  }
  if (q.includes('ruta') || q.includes('rutas') || q.includes('reparto') || q.includes('entrega')) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('routes').select('*').gte('date', today).order('date');
    const count = data?.length || 0;
    return {
      text: `Hay ${count} ruta${count !== 1 ? 's' : ''} programada${count !== 1 ? 's' : ''} para hoy.`,
      dataCards: data?.slice(0, 4).map(r => ({ title: `Ruta ${r.id}`, value: r.status || 'Programada', icon: 'ri-truck-line' })),
    };
  }
  if (q.includes('empleado') || q.includes('empleados') || q.includes('horas')) {
    const { data } = await supabase.from('employees').select('*').order('name');
    const count = data?.length || 0;
    return {
      text: `La empresa tiene ${count} empleado${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''}.`,
      dataCards: data?.slice(0, 4).map(e => ({ title: e.name, value: `${e.hours_this_month || 0}h este mes`, icon: 'ri-user-line' })),
    };
  }
  if (q.includes('pedido') || q.includes('pedidos') || q.includes('orden')) {
    const { data } = await supabase.from('order_headers').select('*').order('created_at', { ascending: false }).limit(5);
    const count = data?.length || 0;
    return {
      text: `Hay ${count} pedidos recientes en el sistema.`,
      dataCards: data?.map(o => ({ title: `PED-${o.id}`, value: o.status || 'Pendiente', icon: 'ri-shopping-cart-2-line' })),
    };
  }
  if (q.includes('incidencia') || q.includes('incidencias') || q.includes('problema') || q.includes('vehiculo')) {
    const { data } = await supabase.from('vehicle_incidents').select('*').order('created_at', { ascending: false }).limit(5);
    const count = data?.length || 0;
    return {
      text: `Hay ${count} incidencia${count !== 1 ? 's' : ''} de vehículo${count !== 1 ? 's' : ''} registrada${count !== 1 ? 's' : ''}.`,
      dataCards: data?.map(i => ({ title: i.type || 'Incidencia', value: i.status || 'Abierta', icon: 'ri-error-warning-line' })),
    };
  }
  if (q.includes('combustible') || q.includes('gasolina') || q.includes('diesel') || q.includes('repostar')) {
    const { data } = await supabase.from('fuel_tickets').select('*').order('date', { ascending: false }).limit(5);
    const totalLitros = data?.reduce((s, t) => s + Number(t.liters || 0), 0) || 0;
    return {
      text: `El consumo reciente de combustible suma ${totalLitros.toFixed(1)} litros en total.`,
      dataCards: data?.slice(0, 4).map(t => ({ title: t.station || 'Estación', value: `${t.liters || 0}L (€${Number(t.cost || 0).toFixed(2)})`, icon: 'ri-gas-station-line' })),
    };
  }
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
  return { text: 'Puedo ayudarte con información de clientes, facturas, stock, rutas, empleados, pedidos e incidencias. ¿Qué necesitas consultar?' };
}

// ── Hook compartido: la lógica del Asistente IA (mensajes, acciones con
// confirmación, historial y memoria de conversación) vive aquí, para que
// tanto la página completa como la burbuja flotante hablen exactamente
// con las mismas reglas y el mismo backend.
export function useAssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = useCallback((msg: AssistantMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const executeAction = useCallback(async (msgId: number, type: string, params: any) => {
    try {
      if (type === 'add_route_stop') {
        const { error } = await supabase.from('route_stops').insert({
          client: params.name, address: params.address, phone: params.phone || null,
          notes: params.notes || null, order_num: 9999, status: 'pending',
        });
        if (error) throw error;
      } else if (type === 'create_vehicle_incident') {
        const { error } = await supabase.from('vehicle_incidents').insert({
          vehicle: params.vehicle, description: params.description, type: 'general',
          status: 'abierto', date: new Date().toISOString().split('T')[0],
        });
        if (error) throw error;
      } else if (type === 'create_invoice') {
        const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
        const year = new Date().getFullYear();
        const seq = String((count || 0) + 1).padStart(3, '0');
        const invoiceId = `F-${year}-${seq}`;
        const subtotal = Number(params.qty) * Number(params.unitPrice);
        const tax = subtotal * 0.21;
        const total = subtotal + tax;
        const { error: invErr } = await supabase.from('invoices').insert({
          id: invoiceId, invoice_number: invoiceId, client: params.client, amount: total,
          subtotal, tax, status: 'pendiente', date: new Date().toISOString().split('T')[0],
          notes: params.notes || null,
        });
        if (invErr) throw invErr;
        await supabase.from('invoice_items').insert({
          invoice_id: invoiceId, product: params.product, qty: params.qty, price: params.unitPrice, total: subtotal,
        });
      } else if (type === 'create_client') {
        const { error } = await supabase.from('clients').insert({
          name: params.name, phone: params.phone || null, email: params.email || null,
          address: params.address || null, notes: params.notes || null, status: 'activo', total_spent: 0,
        });
        if (error) throw error;
      } else if (type === 'create_employee') {
        const { error } = await supabase.from('employees').insert({
          name: params.name, role: params.role || 'Repartidor', phone: params.phone || null, email: params.email || null,
        });
        if (error) throw error;
      } else if (type === 'create_product') {
        const { error } = await supabase.from('product_items').insert({
          name: params.name, price: Number(params.price) || 0, stock: Number(params.stock || 0),
          description: params.description || null, status: 'active',
        });
        if (error) throw error;
      } else if (type === 'create_calendar_event') {
        const { error } = await supabase.from('calendar_events').insert({
          title: params.title, date: params.date, time: params.time || null, type: params.type || 'otro',
          description: params.description || null, location: params.location || null, priority: params.priority || 'media',
        });
        if (error) throw error;
      } else if (type === 'register_fuel_ticket') {
        const { error } = await supabase.from('fuel_tickets').insert({
          vehicle: params.vehicle, employee: params.employee || null, date: new Date().toISOString().split('T')[0],
          liters: Number(params.liters) || 0, cost: params.cost != null ? Number(params.cost) : null, station: params.station || null,
        });
        if (error) throw error;
      } else if (type === 'create_reminder') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No se pudo identificar al usuario');
        const { error } = await supabase.from('notifications').insert({
          user_id: user.id, title: params.title, text: params.text, type: 'reminder', read: false,
        });
        if (error) throw error;
      } else if (type === 'add_pedido') {
        const items = Array.isArray(params.items) ? params.items.slice(0, 20) : [];
        const { data, error } = await supabase.rpc('create_order_row', {
          p_employee: params.employee,
          p_date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          p_address: params.address || '', p_items: items, p_turno: params.turno || 1, p_phone: params.phone || '',
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'No se pudo crear el pedido');
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: 'done' } : m));
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: 'error', actionError: err?.message || 'No se pudo completar la acción' } : m));
    }
  }, []);

  const cancelAction = useCallback((msgId: number) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: 'cancelled' } : m));
  }, []);

  const sendMessage = useCallback(async (query: string, onSaved?: (conv: { id: number; title: string }) => void) => {
    if (!query.trim() || isLoading) return;

    const userMsg: AssistantMessage = { id: Date.now(), text: query, isUser: true, time: timeNow() };
    addMessage(userMsg);
    setIsLoading(true);

    try {
      let aiText = '';
      let dataCards: AssistantMessage['dataCards'];
      let pendingAction: AssistantMessage['pendingAction'];

      try {
        const history = messages
          .filter(m => m.text)
          .slice(-16)
          .map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.text }));

        const res = await fetch('https://wtelnoiuqaqnzgobuuce.supabase.co/functions/v1/ai-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query, history }),
        });
        if (res.ok) {
          const json = await res.json();
          aiText = json.text;
          pendingAction = json.pendingAction;
        }
      } catch { /* fall through to local */ }

      if (!aiText) {
        const result = await processQueryFallback(query);
        aiText = result.text;
        dataCards = result.dataCards;
      }

      addMessage({
        id: Date.now() + 1, text: aiText, isUser: false, time: timeNow(),
        dataCards, pendingAction, actionStatus: pendingAction ? 'pending' : undefined,
      });

      const title = query.length > 40 ? query.slice(0, 37) + '...' : query;
      const { data: savedConv } = await supabase.from('assistant_conversations').insert({ title, query, response: aiText }).select('id').single();
      if (savedConv && onSaved) onSaved({ id: savedConv.id, title });
    } catch {
      addMessage({
        id: Date.now() + 1,
        text: 'Lo siento, hubo un error consultando los datos. Inténtalo de nuevo.\nSorry, there was an error. Please try again.',
        isUser: false, time: timeNow(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, addMessage]);

  return { messages, setMessages, isLoading, addMessage, executeAction, cancelAction, sendMessage };
}
