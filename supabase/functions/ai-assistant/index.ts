import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, language = 'es' } = await req.json();

    // Supabase client con service role para leer datos de la empresa
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Recopilar contexto de datos reales de la empresa
    const [
      { data: clients },
      { data: invoices },
      { data: products },
      { data: orders },
      { data: routes },
      { data: employees },
    ] = await Promise.all([
      supabase.from('clients').select('id,name,status,total_spent').limit(20),
      supabase.from('invoices').select('id,client,amount,status,due_date').limit(20),
      supabase.from('product_items').select('id,name,stock,price').limit(20),
      supabase.from('order_headers').select('id,status,total,created_at').limit(10),
      supabase.from('routes').select('id,name,status,date').limit(10),
      supabase.from('employees').select('id,name,role,status').limit(10),
    ]);

    const pendingInvoices = invoices?.filter(i => i.status === 'pendiente') || [];
    const lowStockProducts = products?.filter(p => (p.stock || 0) < 10) || [];
    const activeClients = clients?.filter(c => c.status === 'activo') || [];

    const systemPrompt = `Eres el Asistente Inteligente de Quickly, una app de gestión para empresas de distribución y reparto.

DATOS ACTUALES DE LA EMPRESA (${new Date().toLocaleDateString()}):
- Clientes activos: ${activeClients.length} de ${clients?.length || 0} total
- Facturas pendientes: ${pendingInvoices.length} por cobrar (total: €${pendingInvoices.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2)})
- Productos con stock bajo (<10 uds): ${lowStockProducts.length}
- Pedidos registrados: ${orders?.length || 0}
- Rutas: ${routes?.length || 0}
- Empleados: ${employees?.length || 0}

CLIENTES RECIENTES: ${activeClients.slice(0, 5).map(c => c.name).join(', ')}
PRODUCTOS BAJO STOCK: ${lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock} uds)`).join(', ')}
FACTURAS PENDIENTES: ${pendingInvoices.slice(0, 5).map(i => `${i.client}: €${Number(i.amount).toFixed(2)}`).join(', ')}

INSTRUCCIONES:
- Responde siempre en el idioma del usuario (detecta el idioma del mensaje)
- Sé conciso pero completo — máximo 3 párrafos
- Cuando des datos numéricos, sé preciso con los datos proporcionados
- Puedes ayudar con: análisis de datos, gestión de clientes/pedidos/facturas/rutas/empleados, recomendaciones operativas, cálculos, resolución de dudas sobre gestión empresarial
- Si preguntan algo fuera del contexto empresarial de reparto, igual ayuda con respuestas profesionales
- Usa formato limpio, sin markdown excesivo
- Si el idioma del mensaje es inglés, responde en inglés. Si es francés, responde en francés, etc.`;

    // Intentar con Anthropic Claude
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      const tools = [
        {
          name: 'add_route_stop',
          description: 'Añade una nueva parada de reparto a la ruta activa de la empresa',
          input_schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre del cliente o destino' },
              address: { type: 'string', description: 'Dirección completa de entrega' },
              phone: { type: 'string', description: 'Teléfono de contacto, opcional' },
              notes: { type: 'string', description: 'Notas o instrucciones de entrega, opcional' },
            },
            required: ['name', 'address'],
          },
        },
        {
          name: 'create_invoice',
          description: 'Crea una factura para un cliente con un concepto, cantidad y precio unitario',
          input_schema: {
            type: 'object',
            properties: {
              client: { type: 'string', description: 'Nombre del cliente a facturar' },
              product: { type: 'string', description: 'Concepto o producto facturado' },
              qty: { type: 'number', description: 'Cantidad' },
              unitPrice: { type: 'number', description: 'Precio unitario en euros, sin IVA' },
              notes: { type: 'string', description: 'Notas de la factura, opcional' },
            },
            required: ['client', 'product', 'qty', 'unitPrice'],
          },
        },
        {
          name: 'create_vehicle_incident',
          description: 'Registra una incidencia o avería de un vehículo de la flota',
          input_schema: {
            type: 'object',
            properties: {
              vehicle: { type: 'string', description: 'Nombre, modelo o matrícula del vehículo' },
              description: { type: 'string', description: 'Descripción de la incidencia' },
            },
            required: ['vehicle', 'description'],
          },
        },
        {
          name: 'add_pedido',
          description: 'Añade un nuevo pedido a la Hoja de Pedidos para un cliente, con dirección, turno y una lista de productos',
          input_schema: {
            type: 'object',
            properties: {
              employee: { type: 'string', description: 'Nombre del cliente o empleado para quien es el pedido' },
              address: { type: 'string', description: 'Dirección de entrega del cliente, opcional' },
              phone: { type: 'string', description: 'Teléfono móvil del cliente, opcional' },
              turno: { type: 'number', description: 'Número de turno (1, 2, 3...), opcional, por defecto 1' },
              items: {
                type: 'array',
                description: 'Lista de productos del pedido',
                items: {
                  type: 'object',
                  properties: {
                    product: { type: 'string', description: 'Nombre del producto' },
                    quantity: { type: 'string', description: 'Cantidad' },
                  },
                  required: ['product', 'quantity'],
                },
              },
            },
            required: ['employee', 'items'],
          },
        },
      ];

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: systemPrompt + `\n\nSi el usuario te pide una ACCIÓN concreta (añadir una parada a la ruta, crear una factura, o registrar una incidencia de vehículo), usa la herramienta correspondiente en vez de responder solo con texto. No ejecutes la acción tú mismo — el sistema le pedirá confirmación al usuario antes de aplicarla.`,
          messages: [{ role: 'user', content: message }],
          tools,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const textBlock = data.content.find((b: any) => b.type === 'text');
        const toolBlock = data.content.find((b: any) => b.type === 'tool_use');

        if (toolBlock) {
          const summaries: Record<string, (p: any) => string> = {
            add_route_stop: (p) => `Añadir parada: ${p.name} — ${p.address}${p.phone ? ` · ${p.phone}` : ''}`,
            create_invoice: (p) => `Crear factura a ${p.client}: ${p.qty} × ${p.product} a €${p.unitPrice} c/u`,
            create_vehicle_incident: (p) => `Registrar incidencia en ${p.vehicle}: ${p.description}`,
            add_pedido: (p) => `Nuevo pedido para ${p.employee}: ${(p.items || []).map((it: any) => `${it.quantity} × ${it.product}`).join(', ')}`,
          };
          return new Response(
            JSON.stringify({
              text: textBlock?.text || 'Esto es lo que voy a hacer — confírmalo cuando quieras:',
              source: 'claude',
              pendingAction: {
                type: toolBlock.name,
                params: toolBlock.input,
                summary: summaries[toolBlock.name]?.(toolBlock.input) || toolBlock.name,
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ text: textBlock?.text || '', source: 'claude' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fallback inteligente si no hay API key
    const fallbackResponse = buildFallbackResponse(message, {
      clients: clients || [],
      invoices: invoices || [],
      products: products || [],
      orders: orders || [],
      routes: routes || [],
      employees: employees || [],
    });

    return new Response(
      JSON.stringify({ text: fallbackResponse, source: 'local' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('AI assistant error:', err);
    return new Response(
      JSON.stringify({ text: 'Lo siento, hubo un error procesando tu consulta. Inténtalo de nuevo.', error: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildFallbackResponse(query: string, data: any): string {
  const q = query.toLowerCase();
  const { clients, invoices, products, orders, routes, employees } = data;

  const pendingInvoices = invoices.filter((i: any) => i.status === 'pendiente');
  const activeClients = clients.filter((c: any) => c.status === 'activo');
  const lowStock = products.filter((p: any) => (p.stock || 0) < 10);

  if (q.includes('factura') || q.includes('cobro') || q.includes('invoice')) {
    const total = pendingInvoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    return `Tienes ${pendingInvoices.length} facturas pendientes de cobro por un total de €${total.toFixed(2)}. ${pendingInvoices.slice(0, 3).map((i: any) => `${i.client} (€${Number(i.amount).toFixed(2)})`).join(', ')}${pendingInvoices.length > 3 ? ' y más...' : ''}.`;
  }

  if (q.includes('cliente') || q.includes('client')) {
    return `Tienes ${activeClients.length} clientes activos de un total de ${clients.length}. ${activeClients.length > 0 ? 'Los más recientes: ' + activeClients.slice(0, 4).map((c: any) => c.name).join(', ') + '.' : ''}`;
  }

  if (q.includes('stock') || q.includes('producto') || q.includes('inventario')) {
    return `Hay ${lowStock.length} producto${lowStock.length !== 1 ? 's' : ''} con stock bajo (menos de 10 unidades): ${lowStock.slice(0, 4).map((p: any) => `${p.name} (${p.stock} uds)`).join(', ')}${lowStock.length > 4 ? '...' : ''}. Total de productos en catálogo: ${products.length}.`;
  }

  if (q.includes('ruta') || q.includes('reparto') || q.includes('entrega')) {
    return `Hay ${routes.length} rutas en el sistema. ${routes.slice(0, 3).map((r: any) => `Ruta ${r.id}: ${r.status || 'programada'}`).join(', ')}.`;
  }

  if (q.includes('empleado') || q.includes('personal') || q.includes('equipo')) {
    return `La empresa cuenta con ${employees.length} empleados registrados. ${employees.slice(0, 4).map((e: any) => e.name).join(', ')}.`;
  }

  if (q.includes('pedido') || q.includes('orden') || q.includes('order')) {
    return `Hay ${orders.length} pedidos recientes en el sistema. ${orders.slice(0, 3).map((o: any) => `Pedido #${o.id}: ${o.status || 'pendiente'}`).join(', ')}.`;
  }

  if (q.includes('resumen') || q.includes('summary') || q.includes('dashboard')) {
    const pendingTotal = pendingInvoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    return `Resumen general: ${activeClients.length} clientes activos, ${pendingInvoices.length} facturas pendientes (€${pendingTotal.toFixed(2)}), ${lowStock.length} productos con stock bajo, ${orders.length} pedidos y ${routes.length} rutas.`;
  }

  return 'Puedo ayudarte con información sobre clientes, facturas, stock, rutas, empleados y pedidos. También puedo darte análisis y recomendaciones. ¿Qué necesitas consultar?\n\nI can also help in English, French, German, Portuguese, Italian, and other languages. Just ask in your preferred language.';
}
