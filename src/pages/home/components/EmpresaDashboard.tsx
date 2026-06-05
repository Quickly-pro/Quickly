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
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : '#e5e7eb';
  const tickFill = isDark ? '#374151' : '#9ca3af';
  const tooltipBg = isDark ? 'rgba(4,8,22,0.97)' : '#ffffff';
  const tooltipBorder = isDark ? 'rgba(249,115,22,0.25)' : '#f3f4f6';
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
    const cobradas = (invoices || []).filter((i: any) => i.status === 'cobrado');
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
      openIncidents: (incs || []).filter((i: any) => ['abierto', 'abierta'].includes(i.status)).length,
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
    { label: 'Clientes', value: stats.totalClients, icon: 'ri-user-3-line', gradient: 'from-blue-500 to-cyan-500', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400' },
    { label: 'Rutas Activas', value: stats.activeRoutes, icon: 'ri-route-line', gradient: 'from-green-500 to-emerald-500', iconBg: 'bg-green-500/10', iconColor: 'text-green-400' },
    { label: 'Pedidos Activos', value: stats.activeOrders, icon: 'ri-shopping-cart-2-line', gradient: 'from-orange-500 to-amber-400', iconBg: 'bg-orange-500/10', iconColor: 'text-orange-400' },
    { label: 'Stock Bajo', value: stats.lowStock, icon: 'ri-alert-line', gradient: 'from-red-500 to-rose-500', iconBg: 'bg-red-500/10', iconColor: 'text-red-400' },
    { label: 'Facturas Pend.', value: stats.pendingInvoices, icon: 'ri-file-list-3-line', gradient: 'from-amber-500 to-yellow-400', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400' },
    { label: 'Empleados', value: stats.totalEmployees, icon: 'ri-user-settings-line', gradient: 'from-purple-500 to-violet-500', iconBg: 'bg-purple-500/10', iconColor: 'text-purple-400' },
  ] : [], [stats]);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            Dashboard <span className="dark:neon-gradient-text">Empresarial</span>
          </h1>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Resumen en tiempo real de tu operación</p>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-white/5 dark:border dark:border-white/8 text-gray-500 dark:text-slate-400 rounded-full capitalize">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <SubscriptionBanner />
      <DashboardStats stats={stats} />

      {/* ── Mini stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#080e24] rounded-2xl p-4 border border-gray-100 dark:border-white/5 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 mb-3" />
            <div className="h-7 w-10 bg-gray-100 dark:bg-white/5 rounded-lg" />
            <div className="h-2.5 w-16 bg-gray-100 dark:bg-white/5 rounded mt-2" />
          </div>
        )) : statCards.map((s, i) => (
          <div key={i} className="relative overflow-hidden bg-white dark:bg-[#080e24] rounded-2xl p-4 border border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-orange-500/20 transition-all group cursor-default">
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${s.gradient}`} />
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl mb-3 ${s.iconBg} group-hover:scale-110 transition-transform duration-200`}>
              <i className={`${s.icon} text-lg ${s.iconColor}`} />
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Financial cards ── */}
      {!loading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pendiente Cobro', value: `€${stats.pendingTotal.toLocaleString()}`, sub: `${stats.pendingInvoices} facturas`, valueColor: 'text-orange-500 dark:text-orange-400', bar: 'bg-orange-500', icon: 'ri-time-line', iconBg: 'bg-orange-500/10', iconColor: 'text-orange-400' },
            { label: 'Total Cobrado',   value: `€${stats.cobradasTotal.toLocaleString()}`, sub: `${stats.cobradas} facturas`,        valueColor: 'text-green-600 dark:text-green-400',  bar: 'bg-green-500',  icon: 'ri-check-double-line', iconBg: 'bg-green-500/10',  iconColor: 'text-green-400' },
            { label: 'Valor Inventario',value: `€${Math.round(stats.totalInventory).toLocaleString()}`, sub: 'En stock',          valueColor: 'text-blue-600 dark:text-blue-400',    bar: 'bg-blue-500',   icon: 'ri-archive-line',     iconBg: 'bg-blue-500/10',   iconColor: 'text-blue-400' },
            { label: 'Gasto Combustible',value:`€${stats.fuelCost.toLocaleString()}`,      sub: 'Este mes',                        valueColor: 'text-red-600 dark:text-red-400',      bar: 'bg-red-500',    icon: 'ri-gas-station-line', iconBg: 'bg-red-500/10',    iconColor: 'text-red-400' },
          ].map((card, i) => (
            <div key={i} className="relative overflow-hidden bg-white dark:bg-[#080e24] rounded-2xl p-4 border border-gray-100 dark:border-white/5">
              <div className={`absolute left-0 top-4 bottom-4 w-1 ${card.bar} rounded-r-full`} />
              <div className="pl-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-600">{card.label}</p>
                  <p className={`text-xl font-black mt-1 ${card.valueColor}`}>{card.value}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">{card.sub}</p>
                </div>
                <div className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl ${card.iconBg}`}>
                  <i className={`${card.icon} ${card.iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#080e24] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-gradient-to-b from-orange-500 to-amber-400 rounded-full" />
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">Ingresos Mensuales</h3>
                <p className="text-xs text-gray-400 dark:text-slate-500">Desde facturas reales</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg">€ EUR</span>
          </div>
          <div className="h-52">
            {loading ? <div className="h-full flex items-center justify-center text-gray-300 dark:text-slate-700 text-sm">Cargando...</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <Tooltip formatter={(value: any) => [`€${value}`, 'Importe']} contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} itemStyle={{ color: tooltipText }} labelStyle={{ color: tooltipText, fontWeight: 700 }} />
                  <Bar dataKey="importe" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#080e24] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
              <h3 className="font-bold text-gray-800 dark:text-white text-sm">Pedidos por Estado</h3>
            </div>
            <span className="text-xs font-medium text-gray-400 dark:text-slate-600">Total: {stats?.totalOrders || 0}</span>
          </div>
          <div className="h-44">
            {loading ? <div className="h-full flex items-center justify-center text-gray-300 dark:text-slate-700 text-sm">Cargando...</div>
            : ordersByStatus.length === 0 ? <div className="h-full flex items-center justify-center text-gray-300 dark:text-slate-700 text-sm">Sin datos</div>
            : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ordersByStatus} cx="50%" cy="50%" innerRadius={44} outerRadius={66} dataKey="value" nameKey="name" paddingAngle={4} strokeWidth={0}>
                    {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [v, n]} contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg }} itemStyle={{ color: tooltipText }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
            {ordersByStatus.map((entry, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {entry.name} ({entry.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#080e24] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-5 bg-gradient-to-b from-green-500 to-emerald-400 rounded-full" />
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-sm">Rutas por Día</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500">Últimos 7 días</p>
            </div>
          </div>
          <div className="h-44">
            {loading ? <div className="h-full flex items-center justify-center text-gray-300 dark:text-slate-700 text-sm">Cargando...</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRoutes}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} itemStyle={{ color: tooltipText }} labelStyle={{ color: tooltipText, fontWeight: 700 }} />
                  <Line type="monotone" dataKey="rutas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#080e24] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full" />
            <h3 className="font-bold text-gray-800 dark:text-white text-sm">Actividad Reciente</h3>
          </div>
          <div className="space-y-3">
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/5 flex-shrink-0" />
                <div className="flex-1 pt-1 space-y-1.5">
                  <div className="h-2.5 w-3/4 bg-gray-100 dark:bg-white/5 rounded" />
                  <div className="h-2 w-1/2 bg-gray-100 dark:bg-white/5 rounded" />
                </div>
              </div>
            )) : recentActivity.map((act) => (
              <div key={act.id} className="flex items-start gap-3 group">
                <div className={`w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 ${act.color} group-hover:scale-110 transition-transform`}>
                  <i className={`${act.icon} text-xs`} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-gray-700 dark:text-slate-300 truncate">{act.text}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent orders table ── */}
      <div className="bg-white dark:bg-[#080e24] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-gradient-to-b from-orange-500 to-amber-400 rounded-full" />
            <h3 className="font-bold text-gray-800 dark:text-white">Pedidos Recientes</h3>
          </div>
          <span className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-slate-500 rounded-lg font-medium">5 más recientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5">
                {['ID', 'Fecha', 'Estado', 'Pago', 'Total'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600 ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-300 dark:text-slate-700">Cargando...</td></tr>
              ) : recentOrders.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-300 dark:text-slate-700">Sin pedidos aún</td></tr>
              ) : recentOrders.map(order => (
                <tr key={order.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-orange-500/5 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-xs text-gray-600 dark:text-orange-400/70">PED-{String(order.id).padStart(6, '0')}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-slate-500 text-xs">{formatDate(order.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>{statusLabel(order.status)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-slate-500 text-xs capitalize">{order.payment_provider || 'manual'}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-gray-800 dark:text-white">€{orderTotal(order).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invoice status ── */}
      <div className="bg-white dark:bg-[#080e24] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-yellow-400 rounded-full" />
          <h3 className="font-bold text-gray-800 dark:text-white">Estado de Facturas</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Pendientes', value: stats?.pendingInvoices || 0, icon: 'ri-time-line',         bg: 'bg-amber-50 dark:bg-amber-500/8',   border: 'border-amber-100 dark:border-amber-500/15', iconBg: 'bg-amber-100 dark:bg-amber-500/20', iconColor: 'text-amber-600 dark:text-amber-400', textColor: 'text-amber-700 dark:text-amber-400', numColor: 'text-amber-800 dark:text-amber-300' },
            { label: 'Cobradas',   value: stats?.cobradas        || 0, icon: 'ri-check-double-line', bg: 'bg-green-50 dark:bg-green-500/8',    border: 'border-green-100 dark:border-green-500/15',  iconBg: 'bg-green-100 dark:bg-green-500/20',  iconColor: 'text-green-600 dark:text-green-400',  textColor: 'text-green-700 dark:text-green-400',  numColor: 'text-green-800 dark:text-green-300' },
            { label: 'Vencidas',   value: stats?.vencidas        || 0, icon: 'ri-alert-line',        bg: 'bg-red-50 dark:bg-red-500/8',        border: 'border-red-100 dark:border-red-500/15',      iconBg: 'bg-red-100 dark:bg-red-500/20',      iconColor: 'text-red-600 dark:text-red-400',      textColor: 'text-red-700 dark:text-red-400',      numColor: 'text-red-800 dark:text-red-300' },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-4 p-4 ${item.bg} rounded-xl border ${item.border}`}>
              <div className={`w-11 h-11 flex items-center justify-center ${item.iconBg} rounded-xl flex-shrink-0`}>
                <i className={`${item.icon} text-lg ${item.iconColor}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${item.textColor}`}>{item.label}</p>
                <p className={`text-3xl font-black ${item.numColor}`}>{item.value}</p>
              </div>
            </div>
          ))}
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