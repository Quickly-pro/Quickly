import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/hooks/useTheme';

export default function GuestDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const gridStroke = isDark ? '#334155' : '#e5e7eb';
  const tickFill = isDark ? '#94a3b8' : '#9ca3af';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#f3f4f6';
  const tooltipText = isDark ? '#e2e8f0' : '#1f2937';

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const [{ data: clients }, { data: routes }, { data: invoices }, { data: orders }] = await Promise.all([
      supabase.from('clients').select('id'),
      supabase.from('routes').select('id'),
      supabase.from('invoices').select('id, amount, created_at'),
      supabase.from('order_headers').select('id'),
    ]);

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyMap = new Map<string, number>();
    months.forEach(m => monthlyMap.set(m, 0));
    (invoices || []).forEach((inv: any) => {
      const d = new Date(inv.created_at || Date.now());
      monthlyMap.set(months[d.getMonth()], (monthlyMap.get(months[d.getMonth()]) || 0) + Number(inv.amount || 0));
    });
    const revenueData = months.map(m => ({ name: m, importe: Math.round(monthlyMap.get(m) || 0) }));

    setStats({
      totalClients: clients?.length || 0,
      activeRoutes: routes?.length || 0,
      totalOrders: orders?.length || 0,
    });
    setMonthlyRevenue(revenueData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="space-y-6">
      {/* Hero Banner for guests */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Bienvenido a Quickly</h1>
            <p className="text-sm text-white/80 mt-1 max-w-md">
              Gestión completa de repartos y logística. Conecta tu empresa, empleados y clientes en una sola plataforma.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              to="/login"
              className="px-4 py-2 bg-white text-orange-600 rounded-lg font-medium text-sm hover:bg-white/90 transition-all"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="px-4 py-2 bg-orange-700 text-white rounded-lg font-medium text-sm hover:bg-orange-800 transition-all"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </div>

      {/* Public Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-700 mb-2" />
              <div className="h-6 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <i className="ri-user-3-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{stats?.totalClients || 0}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Clientes activos</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <i className="ri-route-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{stats?.activeRoutes || 0}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Rutas gestionadas</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                <i className="ri-shopping-cart-2-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{stats?.totalOrders || 0}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Pedidos procesados</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                <i className="ri-sparkling-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">IA</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Asistente incluido</p>
            </div>
          </>
        )}
      </div>

      {/* Revenue Chart (public) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">Ingresos Mensuales (€)</h3>
          <span className="text-xs text-gray-400 dark:text-slate-500">Demo público</span>
        </div>
        <div className="h-56">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Cargando...</div>
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

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: 'ri-map-2-line', title: 'Rutas Inteligentes', desc: 'Optimiza tus rutas de reparto en tiempo real con geolocalización.', color: 'bg-green-50 text-green-600' },
          { icon: 'ri-shopping-cart-2-line', title: 'Gestión de Pedidos', desc: 'Controla el ciclo completo de tus pedidos desde recepción hasta entrega.', color: 'bg-orange-50 text-orange-600' },
          { icon: 'ri-bill-line', title: 'Facturación', desc: 'Genera y gestiona facturas automáticamente desde tus pedidos.', color: 'bg-blue-50 text-blue-600' },
          { icon: 'ri-team-line', title: 'Clientes', desc: 'Base de datos completa de clientes con historial de compras.', color: 'bg-purple-50 text-purple-600' },
          { icon: 'ri-chat-3-line', title: 'Chat Interno', desc: 'Comunicación instantánea entre empleados y empresa.', color: 'bg-pink-50 text-pink-600' },

        ].map((feat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
            <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${feat.color} mb-3`}>
              <i className={`${feat.icon} text-lg`} />
            </div>
            <h4 className="font-medium text-gray-800 dark:text-slate-100 mb-1">{feat.title}</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400">{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}