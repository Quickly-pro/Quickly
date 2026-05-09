import { useMemo } from 'react';

interface StatRingProps {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: string;
}

function StatRing({ label, value, total, color, icon }: StatRingProps) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 32;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
      <div className="relative w-[72px] h-[72px] flex-shrink-0">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-gray-100 dark:text-slate-700"
          />
          <circle
            cx="36"
            cy="36"
            r="32"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-800 dark:text-slate-100">{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${icon} text-sm`} style={{ color }} />
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-slate-400">{label}</span>
        </div>
        <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{value}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">de {total}</p>
      </div>
    </div>
  );
}

interface TrendStatProps {
  label: string;
  value: string;
  trend: number;
  trendLabel: string;
  color: string;
  icon: string;
}

function TrendStat({ label, value, trend, trendLabel, color, icon }: TrendStatProps) {
  const isUp = trend >= 0;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-slate-400">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '14' }}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${icon} text-lg`} style={{ color }} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{value}</p>
        <div className={`flex items-center gap-1 mt-1 ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={`${isUp ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-sm`} />
          </div>
          <span className="text-sm font-semibold">{isUp ? '+' : ''}{trend}%</span>
          <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">{trendLabel}</span>
        </div>
      </div>
    </div>
  );
}

interface HorizontalBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: string;
}

function HorizontalBar({ label, value, max, color, icon }: HorizontalBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '14' }}>
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={`${icon} text-sm`} style={{ color }} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-gray-600 dark:text-slate-400 font-medium">{label}</span>
          <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{value}</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  stats: any;
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const statsData = useMemo(() => {
    if (!stats) return null;
    return {
      routesCompleted: stats.completedRoutes || 0,
      routesPending: stats.pendingStops || 0,
      routesTotal: (stats.completedRoutes || 0) + (stats.pendingStops || 0),
      invoicesPending: stats.pendingInvoices || 0,
      invoicesPaid: stats.cobradas || 0,
      invoicesTotal: (stats.pendingInvoices || 0) + (stats.cobradas || 0) + (stats.vencidas || 0),
      openIncidents: stats.openIncidents || 0,
      incidentsTotal: stats.totalIncidents || 0,
      clients: stats.totalClients || 0,
      employees: stats.totalEmployees || 0,
      totalOrders: stats.totalOrders || 0,
      activeOrders: stats.activeOrders || 0,
      pendingTotal: stats.pendingTotal || 0,
      cobradasTotal: stats.cobradasTotal || 0,
    };
  }, [stats]);

  if (!statsData || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 h-32">
            <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded mb-3" />
            <div className="h-8 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const revenueTrend = statsData.cobradasTotal > 0
    ? Math.round((statsData.cobradasTotal / (statsData.cobradasTotal + statsData.pendingTotal)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI trend cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TrendStat
          label="Ingresos Cobrados"
          value={`€${statsData.cobradasTotal.toLocaleString()}`}
          trend={revenueTrend}
          trendLabel="vs. pendiente"
          color="#10b981"
          icon="ri-wallet-3-line"
        />
        <TrendStat
          label="Pedidos Totales"
          value={String(statsData.totalOrders)}
          trend={statsData.activeOrders > 0 ? Math.round((statsData.activeOrders / statsData.totalOrders) * 100) : 0}
          trendLabel="activos"
          color="#f97316"
          icon="ri-shopping-bag-3-line"
        />
        <TrendStat
          label="Clientes Activos"
          value={String(statsData.clients)}
          trend={12}
          trendLabel="vs. mes pasado"
          color="#3b82f6"
          icon="ri-user-star-line"
        />
        <TrendStat
          label="Empleados"
          value={String(statsData.employees)}
          trend={3}
          trendLabel="vs. mes pasado"
          color="#8b5cf6"
          icon="ri-team-line"
        />
      </div>

      {/* Ring progress stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatRing
          label="Rutas Completadas"
          value={statsData.routesCompleted}
          total={statsData.routesTotal}
          color="#10b981"
          icon="ri-route-line"
        />
        <StatRing
          label="Facturas Pagadas"
          value={statsData.invoicesPaid}
          total={statsData.invoicesTotal}
          color="#f59e0b"
          icon="ri-bill-line"
        />
        <StatRing
          label="Incidencias Cerradas"
          value={(statsData.incidentsTotal || 0) - (statsData.openIncidents || 0)}
          total={statsData.incidentsTotal}
          color="#ef4444"
          icon="ri-error-warning-line"
        />
      </div>

      {/* Horizontal bar stats */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">Desempeño por Categoría</h3>
          <span className="text-xs text-gray-400 dark:text-slate-500">Datos en tiempo real</span>
        </div>
        <div className="space-y-5">
          <HorizontalBar
            label="Pedidos Completados"
            value={statsData.totalOrders - statsData.activeOrders}
            max={statsData.totalOrders}
            color="#10b981"
            icon="ri-checkbox-circle-line"
          />
          <HorizontalBar
            label="Rutas Activas"
            value={statsData.routesPending}
            max={statsData.routesTotal}
            color="#f97316"
            icon="ri-truck-line"
          />
          <HorizontalBar
            label="Stock Bajo"
            value={stats.lowStock || 0}
            max={20}
            color="#ef4444"
            icon="ri-alert-line"
          />
          <HorizontalBar
            label="Pedidos Activos"
            value={statsData.activeOrders}
            max={statsData.totalOrders}
            color="#3b82f6"
            icon="ri-loader-2-line"
          />
        </div>
      </div>
    </div>
  );
}
