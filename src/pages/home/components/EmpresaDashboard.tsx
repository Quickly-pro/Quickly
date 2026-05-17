import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardStats from './DashboardStats';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell,
} from 'recharts';
import { useTheme } from '@/hooks/useTheme';
import SubscriptionBanner from '@/components/feature/SubscriptionBanner';

const COLORS = ['#f97316', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b'];

export default function EmpresaDashboard() {
  const { isDark } = useTheme();
  const gridStroke = isDark ? '#334155' : '#e5e7eb';
  const tickFill = isDark ? '#94a3b8' : '#9ca3af';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#f3f4f6';
  const tooltipText = isDark ? '#e2e8f0' : '#1f2937';

  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<any[]>([]);
  const [dailyRoutes, setDailyRoutes] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);

    const [
      { data: clients },
      { data: routes },
      { data: invoices },
      { data: products },
      { data: orders },
      { data: stops },
      { data: employees },
      { data: incs },
      { data: fuel },
    ] = await Promise.all([
      supabase.from('clients').select('id, total_spent'),
      supabase.from('routes').select('id, status, driver, name, start_time'),
      supabase.from('invoices').select('id, amount, status, invoice_number, client, created_at'),
      supabase.from('product_items').select('id, stock, min_stock, price'),
      supabase.from('order_headers').select('id, status, total, created_at, shipping_total, tax_total, subtotal_items, discount_price, payment_provider'),
      supabase.from('route_stops').select('id, status'),
      supabase.from('employees').select('id'),
      supabase.from('vehicle_incidents').select('id, status'),
      supabase.from('fuel_tickets').select('id, cost'),
    ]);

    const lowStockCount = (products || []).filter((p: any) => p.stock !== null && p.min_stock !== null && p.stock < p.min_stock).length;
    const pendingInvoices = (invoices || []).filter((i: any) => i.status === 'pendiente');
    const pendingTotal = pendingInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);
    const cobradas = (invoices || []).filter((i: any) => i.status === 'cobrada');
    const cobradasTotal = cobradas.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);
    const vencidas = (invoices || []).filter((i: any) => i.status === 'vencida');

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyMap = new Map<string, number>();
    months.forEach(m => monthlyMap.set(m, 0));
    (invoices || []).forEach((inv: any) => {
      const d = new Date(inv.created_at || Date.now());
      const monthName = months[d.getMonth()];
      monthlyMap.set(monthName, (monthlyMap.get(monthName) || 0) + Number(inv.amount || 0));
    });
    const revenueData = months.map(m => ({ name: m, importe: Math.round(monthlyMap.get(m) || 0) }));

    const statusMap: Record<string, number> = {};
    (orders || []).forEach((o: any) => {
      const s = o.status || 'desconocido';
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const pieData = Object.entries(statusMap).map(([name, value]) => ({ name: statusLabel(name), value }));

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { label: d.toLocaleDateString('es-ES', { weekday: 'short' }), date: d.toISOString().split('T')[0] };
    });
    const routesByDay = days.map(day => ({
      name: day.label,
      rutas: (routes || []).filter((r: any) => r.start_time && r.start_time.startsWith(day.date)).length,
    }));

    const topOrders = [...(orders || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    setRecentOrders(topOrders);

    const activity: any[] = [];
    (invoices || []).slice(0, 3).forEach((inv: any) => activity.push({
      id: `inv-${inv.id}`, text: `Factura ${inv.invoice_number || inv.id.slice(0, 8)} para ${inv.client || 'cliente'}`, time: 'Hoy', icon: 'ri-file-list-3-line', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    }));
    (routes || []).slice(0, 3).forEach((r: any) => activity.push({
      id: `route-${r.id}`, text: `Ruta ${r.name || 'sin nombre'} asignada a ${r.driver || 'conductor'}`, time: r.start_time ? 'Hoy' : 'Pendiente', icon: 'ri-truck-line', color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    }));
    (incs || []).slice(0, 2).forEach((inc: any) => activity.push({
      id: `inc-${inc.id}`, text: `Incidencia registrada`, time: 'Hoy', icon: 'ri-error-warning-line', color: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    }));

    setStats({
      totalClients: clients?.length || 0,
      clientRevenue: (clients || []).reduce((sum: number, c: any) => sum + Number(c.total_spent || 0), 0),
      activeRoutes: (routes || []).filter((r: any) => r.status === 'active').length,
      completedRoutes: (stops || []).filter((s: any) => s.status === 'completado').length,
      pendingStops: (stops || []).filter((s: any) => s.status !== 'completado').length,
      pendingInvoices: pendingInvoices.length,
      pendingTotal,
      cobradas: cobradas.length,
      cobradasTotal,
      vencidas: vencidas.length,
      lowStock: lowStockCount,
      activeOrders: (orders || []).filter((o: any) => ['pending_payment', 'processing', 'shipped'].includes(o.status)).length,
      totalOrders: orders?.length || 0,
      totalEmployees: employees?.length || 0,
      totalIncidents: incs?.length || 0,
      openIncidents: (incs || []).filter((i: any) => i.status === 'abierto').length,
      fuelCost: (fuel || []).reduce((sum: number, f: any) => sum + Number(f.cost || 0), 0),
      totalInventory: (products || []).reduce((sum: number, p: any) => sum + Number(p.stock || 0) * Number(p.price || 0), 0),
    });

    setMonthlyRevenue(revenueData);
    setOrdersByStatus(pieData);
    setDailyRoutes(routesByDay);
    setRecentActivity(activity.slice(0, 6));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const orderTotal = (order: any) => {
    const detailed = Number(order.subtotal_items || 0) + Number(order.shipping_total || 0) + Number(order.tax_total || 0) - Number(order.discount_price || 0);
    // Si no hay desglose usa el campo total directo
    return detailed > 0 ? detailed : Number(order.total || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_payment: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
      paid: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
      processing: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
      shipped: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
      delivered: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
      cancelled: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
      refunded: 'bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
    };
    return map[status] || 'bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-400';
  };

  const statCards = useMemo(() => stats ? [
    { label: 'Clientes', value: stats.totalClients, icon: 'ri-user-3-line', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
    { label: 'Rutas Activas', value: stats.activeRoutes, icon: 'ri-route-line', color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
    { label: 'Pedidos Activos', value: stats.activeOrders, icon: 'ri-shopping-cart-2-line', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' },
    { label: 'Stock Bajo', value: stats.lowStock, icon: 'ri-alert-line', color: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
    { label: 'Facturas Pend.', value: stats.pendingInvoices, icon: 'ri-file-list-3-line', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
    { label: 'Empleados', value: stats.totalEmployees, icon: 'ri-user-settings-line', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' },
  ] : [], [stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Dashboard Empresarial</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Resumen completo de tu operación</p>
        </div>
        <span className="text-sm text-gray-400 dark:text-slate-500">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      <SubscriptionBanner />

      <DashboardStats stats={stats} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-700 mb-2" />
              <div className="h-6 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded mt-2" />
            </div>
          ))
        ) : (
          statCards.map((s, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg mb-2 ${s.color}`}>
                <i className={s.icon} />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
            </div>
          ))
        )}
      </div>

      {!loading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Pendiente Cobro</p>
            <p className="text-xl font-bold text-orange-600">€{stats.pendingTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{stats.pendingInvoices} facturas</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Total Cobrado</p>
            <p className="text-xl font-bold text-green-600">€{stats.cobradasTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{stats.cobradas} facturas</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Valor Inventario</p>
            <p className="text-xl font-bold text-blue-600">€{Math.round(stats.totalInventory).toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Productos en stock</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Gasto Combustible</p>
            <p className="text-xl font-bold text-red-600">€{stats.fuelCost.toLocaleString()}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Este mes</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100">Ingresos Mensuales (€)</h3>
            <span className="text-xs text-gray-400 dark:text-slate-500">Desde facturas reales</span>
          </div>
          <div className="h-56">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Cargando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: tickFill, fontSize: 12 }} axisLine={false} tickFormatter={v => `€${v}`} />
                  <Tooltip formatter={(value: any) => [`€${value}`, 'Importe']} contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg }} itemStyle={{ color: tooltipText }} labelStyle={{ color: tooltipText }} />
                  <Bar dataKey="importe" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100">Pedidos por Estado</h3>
            <span className="text-xs text-gray-400 dark:text-slate-500">Total: {stats?.totalOrders || 0}</span>
          </div>
          <div className="h-48">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Cargando...</div>
            ) : ordersByStatus.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ordersByStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" nameKey="name" paddingAngle={3}>
                    {ordersByStatus.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {ordersByStatus.map((entry, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {entry.name} ({entry.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Rutas por Día (últimos 7 días)</h3>
          <div className="h-48">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Cargando...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRoutes}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: tickFill, fontSize: 12 }} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg }} itemStyle={{ color: tooltipText }} labelStyle={{ color: tooltipText }} />
                  <Line type="monotone" dataKey="rutas" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Actividad Reciente</h3>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))
            ) : (
              recentActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${act.color}`}>
                    <i className={act.icon} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-slate-300">{act.text}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{act.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">Pedidos Recientes</h3>
          <span className="text-xs text-gray-400 dark:text-slate-500">5 más recientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">ID</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Estado</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Pago</th>
                <th className="text-right px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">Cargando...</td></tr>
              ) : recentOrders.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">Sin pedidos aún</td></tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">PED-{String(order.id).padStart(6, '0')}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 capitalize">{order.payment_provider || 'manual'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-slate-200">€{orderTotal(order).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Estado de Facturas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/30">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-800/40 rounded-full">
              <i className="ri-time-line text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Pendientes</p>
              <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{stats?.pendingInvoices || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800/30">
            <div className="w-10 h-10 flex items-center justify-center bg-green-100 dark:bg-green-800/40 rounded-full">
              <i className="ri-check-double-line text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Cobradas</p>
              <p className="text-lg font-bold text-green-800 dark:text-green-300">{stats?.cobradas || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/30">
            <div className="w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-800/40 rounded-full">
              <i className="ri-alert-line text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Vencidas</p>
              <p className="text-lg font-bold text-red-800 dark:text-red-300">{stats?.vencidas || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'Pendiente Pago',
    paid: 'Pagado',
    processing: 'En Preparación',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
  };
  return map[status] || status;
}