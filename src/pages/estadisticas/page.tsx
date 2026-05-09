import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import PremiumGate from '@/components/feature/PremiumGate';

// ============ DATA BY YEAR ============
const DATA_BY_YEAR: Record<number, {
  salesData: { month: string; ventas: number; objetivo: number }[];
  fuelData: { month: string; litros: number; costo: number }[];
  hoursData: { employee: string; horas: number; extras: number }[];
  weeklySalesTrend: { semana: string; ventas: number; anterior: number }[];
  trendByCategory: { categoria: string; actual: number; anterior: number; crecimiento: number }[];
  productCategoryData: { name: string; ventas: number }[];
}> = {
  2024: {
    salesData: [
      { month: 'Ene', ventas: 28500, objetivo: 28000 },
      { month: 'Feb', ventas: 31200, objetivo: 30000 },
      { month: 'Mar', ventas: 27800, objetivo: 32000 },
      { month: 'Abr', ventas: 34100, objetivo: 35000 },
      { month: 'May', ventas: 36800, objetivo: 37000 },
      { month: 'Jun', ventas: 32900, objetivo: 38000 },
    ],
    fuelData: [
      { month: 'Ene', litros: 920, costo: 1350 },
      { month: 'Feb', litros: 1050, costo: 1580 },
      { month: 'Mar', litros: 890, costo: 1320 },
      { month: 'Abr', litros: 980, costo: 1460 },
      { month: 'May', litros: 1150, costo: 1720 },
      { month: 'Jun', litros: 820, costo: 1220 },
    ],
    hoursData: [
      { employee: 'Carlos', horas: 160, extras: 8 },
      { employee: 'Ana', horas: 152, extras: 4 },
      { employee: 'Miguel', horas: 148, extras: 0 },
      { employee: 'Laura', horas: 164, extras: 12 },
      { employee: 'Pedro', horas: 168, extras: 16 },
    ],
    weeklySalesTrend: [
      { semana: 'S1', ventas: 7200, anterior: 6500 },
      { semana: 'S2', ventas: 7800, anterior: 7100 },
      { semana: 'S3', ventas: 8300, anterior: 7400 },
      { semana: 'S4', ventas: 8900, anterior: 7800 },
      { semana: 'S5', ventas: 8600, anterior: 8200 },
      { semana: 'S6', ventas: 9400, anterior: 8500 },
      { semana: 'S7', ventas: 9800, anterior: 9100 },
      { semana: 'S8', ventas: 10200, anterior: 9500 },
    ],
    trendByCategory: [
      { categoria: 'Aceites', actual: 7200, anterior: 6800, crecimiento: 6 },
      { categoria: 'Lacteos', actual: 6100, anterior: 5900, crecimiento: 3 },
      { categoria: 'Bebidas', actual: 6900, anterior: 6300, crecimiento: 10 },
      { categoria: 'Harinas', actual: 3800, anterior: 3600, crecimiento: 6 },
      { categoria: 'Vinos', actual: 4300, anterior: 4000, crecimiento: 8 },
      { categoria: 'Cafe', actual: 2400, anterior: 2100, crecimiento: 14 },
    ],
    productCategoryData: [
      { name: 'Aceites', ventas: 7200 },
      { name: 'Lacteos', ventas: 6100 },
      { name: 'Bebidas', ventas: 6900 },
      { name: 'Harinas', ventas: 3800 },
      { name: 'Vinos', ventas: 4300 },
      { name: 'Cafe', ventas: 2400 },
    ],
  },
  2025: {
    salesData: [
      { month: 'Ene', ventas: 32500, objetivo: 30000 },
      { month: 'Feb', ventas: 38100, objetivo: 35000 },
      { month: 'Mar', ventas: 29400, objetivo: 35000 },
      { month: 'Abr', ventas: 45280, objetivo: 40000 },
      { month: 'May', ventas: 41200, objetivo: 40000 },
      { month: 'Jun', ventas: 38900, objetivo: 42000 },
    ],
    fuelData: [
      { month: 'Ene', litros: 980, costo: 1470 },
      { month: 'Feb', litros: 1100, costo: 1650 },
      { month: 'Mar', litros: 950, costo: 1425 },
      { month: 'Abr', litros: 1050, costo: 1575 },
      { month: 'May', litros: 1200, costo: 1800 },
      { month: 'Jun', litros: 890, costo: 1335 },
    ],
    hoursData: [
      { employee: 'Carlos', horas: 168, extras: 12 },
      { employee: 'Ana', horas: 160, extras: 8 },
      { employee: 'Miguel', horas: 152, extras: 0 },
      { employee: 'Laura', horas: 176, extras: 16 },
      { employee: 'Pedro', horas: 180, extras: 20 },
    ],
    weeklySalesTrend: [
      { semana: 'S1', ventas: 8200, anterior: 7400 },
      { semana: 'S2', ventas: 9100, anterior: 7800 },
      { semana: 'S3', ventas: 8700, anterior: 8500 },
      { semana: 'S4', ventas: 10200, anterior: 9100 },
      { semana: 'S5', ventas: 9500, anterior: 8900 },
      { semana: 'S6', ventas: 11200, anterior: 9800 },
      { semana: 'S7', ventas: 10800, anterior: 10200 },
      { semana: 'S8', ventas: 12500, anterior: 10500 },
    ],
    trendByCategory: [
      { categoria: 'Aceites', actual: 8500, anterior: 7200, crecimiento: 18 },
      { categoria: 'Lacteos', actual: 6200, anterior: 6100, crecimiento: 2 },
      { categoria: 'Bebidas', actual: 7800, anterior: 6900, crecimiento: 13 },
      { categoria: 'Harinas', actual: 3400, anterior: 3800, crecimiento: -11 },
      { categoria: 'Vinos', actual: 5600, anterior: 4300, crecimiento: 30 },
      { categoria: 'Cafe', actual: 2100, anterior: 2400, crecimiento: -13 },
    ],
    productCategoryData: [
      { name: 'Aceites', ventas: 8500 },
      { name: 'Lacteos', ventas: 6200 },
      { name: 'Bebidas', ventas: 7800 },
      { name: 'Harinas', ventas: 3400 },
      { name: 'Vinos', ventas: 5600 },
      { name: 'Cafe', ventas: 2100 },
    ],
  },
  2026: {
    salesData: [
      { month: 'Ene', ventas: 34200, objetivo: 32000 },
      { month: 'Feb', ventas: 39500, objetivo: 37000 },
      { month: 'Mar', ventas: 31800, objetivo: 36000 },
      { month: 'Abr', ventas: 47100, objetivo: 43000 },
      { month: 'May', ventas: 43800, objetivo: 42000 },
      { month: 'Jun', ventas: 41500, objetivo: 44000 },
    ],
    fuelData: [
      { month: 'Ene', litros: 1050, costo: 1580 },
      { month: 'Feb', litros: 1180, costo: 1770 },
      { month: 'Mar', litros: 1020, costo: 1530 },
      { month: 'Abr', litros: 1120, costo: 1680 },
      { month: 'May', litros: 1280, costo: 1920 },
      { month: 'Jun', litros: 960, costo: 1440 },
    ],
    hoursData: [
      { employee: 'Carlos', horas: 174, extras: 14 },
      { employee: 'Ana', horas: 166, extras: 10 },
      { employee: 'Miguel', horas: 158, extras: 2 },
      { employee: 'Laura', horas: 182, extras: 18 },
      { employee: 'Pedro', horas: 188, extras: 24 },
    ],
    weeklySalesTrend: [
      { semana: 'S1', ventas: 9200, anterior: 8200 },
      { semana: 'S2', ventas: 10100, anterior: 9100 },
      { semana: 'S3', ventas: 9500, anterior: 8700 },
      { semana: 'S4', ventas: 11200, anterior: 10200 },
      { semana: 'S5', ventas: 10500, anterior: 9500 },
      { semana: 'S6', ventas: 12300, anterior: 11200 },
      { semana: 'S7', ventas: 11800, anterior: 10800 },
      { semana: 'S8', ventas: 13600, anterior: 12500 },
    ],
    trendByCategory: [
      { categoria: 'Aceites', actual: 9200, anterior: 8500, crecimiento: 8 },
      { categoria: 'Lacteos', actual: 6800, anterior: 6200, crecimiento: 10 },
      { categoria: 'Bebidas', actual: 8500, anterior: 7800, crecimiento: 9 },
      { categoria: 'Harinas', actual: 3100, anterior: 3400, crecimiento: -9 },
      { categoria: 'Vinos', actual: 6400, anterior: 5600, crecimiento: 14 },
      { categoria: 'Cafe', actual: 2300, anterior: 2100, crecimiento: 10 },
    ],
    productCategoryData: [
      { name: 'Aceites', ventas: 9200 },
      { name: 'Lacteos', ventas: 6800 },
      { name: 'Bebidas', ventas: 8500 },
      { name: 'Harinas', ventas: 3100 },
      { name: 'Vinos', ventas: 6400 },
      { name: 'Cafe', ventas: 2300 },
    ],
  },
};

const clientStatusData = [
  { name: 'Activos', value: 156 },
  { name: 'Vacaciones', value: 12 },
  { name: 'Ausentes', value: 8 },
  { name: 'Paro Temporal', value: 5 },
  { name: 'No Servicio', value: 10 },
];

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'];

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendCard({
  label, value, trend, trendLabel, color, icon, sparkData, sparkKey,
}: {
  label: string; value: string; trend: number; trendLabel: string; color: string; icon: string;
  sparkData: any[]; sparkKey: string;
}) {
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
      <div className="flex items-end justify-between">
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
        <Sparkline data={sparkData} dataKey={sparkKey} color={color} />
      </div>
    </div>
  );
}

function YearSelector({
  selectedYear, onChange,
}: { selectedYear: number; onChange: (y: number) => void }) {
  const years = [2024, 2025, 2026];
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
      {years.map(y => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
            ${selectedYear === y ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

export default function Estadisticas() {
  const [activePeriod, setActivePeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState(2025);

  const data = DATA_BY_YEAR[selectedYear];
  const prevYearData = DATA_BY_YEAR[selectedYear - 1];

  // Compute year totals for comparison
  const totalSales = data.salesData.reduce((sum, d) => sum + d.ventas, 0);
  const totalSalesPrev = prevYearData?.salesData.reduce((sum, d) => sum + d.ventas, 0) ?? 0;
  const salesChange = totalSalesPrev ? Math.round(((totalSales - totalSalesPrev) / totalSalesPrev) * 100) : 0;

  const totalFuel = data.fuelData.reduce((sum, d) => sum + d.litros, 0);
  const totalFuelPrev = prevYearData?.fuelData.reduce((sum, d) => sum + d.litros, 0) ?? 0;
  const fuelChange = totalFuelPrev ? Math.round(((totalFuel - totalFuelPrev) / totalFuelPrev) * 100) : 0;

  const totalHours = data.hoursData.reduce((sum, d) => sum + d.horas + d.extras, 0);
  const totalHoursPrev = prevYearData?.hoursData.reduce((sum, d) => sum + d.horas + d.extras, 0) ?? 0;
  const hoursChange = totalHoursPrev ? Math.round(((totalHours - totalHoursPrev) / totalHoursPrev) * 100) : 0;

  const totalClients = 191;
  const totalClientsPrev = 180;
  const clientsChange = Math.round(((totalClients - totalClientsPrev) / totalClientsPrev) * 100);

  // Year-over-year comparison chart data
  const yoySalesData = useMemo(() => {
    if (!prevYearData) return [];
    return data.salesData.map((d, i) => ({
      month: d.month,
      actual: d.ventas,
      anterior: prevYearData.salesData[i]?.ventas ?? 0,
    }));
  }, [data, prevYearData]);

  // Year-over-year fuel data
  const yoyFuelData = useMemo(() => {
    if (!prevYearData) return [];
    return data.fuelData.map((d, i) => ({
      month: d.month,
      actual: d.litros,
      anterior: prevYearData.fuelData[i]?.litros ?? 0,
    }));
  }, [data, prevYearData]);

  return (
    <PremiumGate>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Estadisticas y Reportes</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Analisis avanzado de todos los datos del negocio</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <YearSelector selectedYear={selectedYear} onChange={setSelectedYear} />
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
              {[
                { key: 'month', label: 'Mensual' },
                { key: 'quarter', label: 'Trimestral' },
                { key: 'year', label: 'Anual' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActivePeriod(p.key as typeof activePeriod)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                    ${activePeriod === p.key ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards with Sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <TrendCard
            label="Ventas Totales"
            value={`€${totalSales.toLocaleString()}`}
            trend={salesChange}
            trendLabel={`vs ${selectedYear - 1}`}
            color="#10b981"
            icon="ri-money-euro-circle-line"
            sparkData={data.weeklySalesTrend}
            sparkKey="ventas"
          />
          <TrendCard
            label="Combustible"
            value={`${totalFuel.toLocaleString()}L`}
            trend={fuelChange}
            trendLabel={`vs ${selectedYear - 1}`}
            color="#3b82f6"
            icon="ri-gas-station-line"
            sparkData={data.fuelData}
            sparkKey="litros"
          />
          <TrendCard
            label="Horas Trabajadas"
            value={`${totalHours}h`}
            trend={hoursChange}
            trendLabel={`vs ${selectedYear - 1}`}
            color="#10b981"
            icon="ri-time-line"
            sparkData={data.hoursData}
            sparkKey="horas"
          />
          <TrendCard
            label="Clientes Activos"
            value={String(totalClients)}
            trend={clientsChange}
            trendLabel={`vs ${selectedYear - 1}`}
            color="#8b5cf6"
            icon="ri-team-line"
            sparkData={data.weeklySalesTrend.map((s, i) => ({ idx: i, val: 180 + i * 2 }))}
            sparkKey="val"
          />
        </div>

        {/* ========== YEAR-OVER-YEAR COMPARISON ========== */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-slate-100">Comparativa {selectedYear} vs {selectedYear - 1}</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Evolucion interanual por mes</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-[10px] text-gray-500 dark:text-slate-400">{selectedYear}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-slate-600" />
                <span className="text-[10px] text-gray-500 dark:text-slate-400">{selectedYear - 1}</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yoySalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [`€${value.toLocaleString()}`, name === 'actual' ? `${selectedYear}` : `${selectedYear - 1}`]}
                  contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }}
                />
                <Legend />
                <Bar dataKey="actual" fill="#f97316" radius={[6, 6, 0, 0]} name={String(selectedYear)} />
                <Bar dataKey="anterior" fill={document.documentElement.classList.contains('dark') ? '#475569' : '#e2e8f0'} radius={[6, 6, 0, 0]} name={String(selectedYear - 1)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Sales Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Ventas Mensuales vs Objetivo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }} />
                  <Legend />
                  <Bar dataKey="ventas" fill="#f97316" radius={[6, 6, 0, 0]} name="Ventas" />
                  <Bar dataKey="objetivo" fill={document.documentElement.classList.contains('dark') ? '#475569' : '#e5e7eb'} radius={[6, 6, 0, 0]} name="Objetivo" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fuel Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Consumo de Combustible</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.fuelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }} />
                  <Legend />
                  <Area type="monotone" dataKey="litros" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Litros" />
                  <Area type="monotone" dataKey="costo" stroke="#f97316" fill="#f97316" fillOpacity={0.1} name="Costo (€)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hours Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Horas Trabajadas por Empleado</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'} />
                  <XAxis dataKey="employee" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }} />
                  <Legend />
                  <Bar dataKey="horas" fill="#10b981" radius={[6, 6, 0, 0]} name="Horas normales" />
                  <Bar dataKey="extras" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Horas extras" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Client Status */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Estado de Clientes</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={clientStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {clientStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 flex-wrap">
              {clientStatusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-xs text-gray-600 dark:text-slate-300">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product Categories */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Ventas por Categoria de Producto</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.productCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }} />
                <Line type="monotone" dataKey="ventas" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5 }} name="Ventas (€)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Weekly Sales Trend */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-slate-100">Tendencia de Ventas Semanales</h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Comparativa con periodo anterior</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">Actual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-slate-600" />
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">Anterior</span>
                </div>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.weeklySalesTrend}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'} />
                  <XAxis dataKey="semana" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`€${value.toLocaleString()}`, name === 'ventas' ? 'Ventas actuales' : 'Ventas anteriores']}
                    contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }}
                  />
                  <Area type="monotone" dataKey="ventas" stroke="#f97316" strokeWidth={3} fill="url(#colorVentas)" name="ventas" />
                  <Area type="monotone" dataKey="anterior" stroke={document.documentElement.classList.contains('dark') ? '#64748b' : '#cbd5e1'} strokeWidth={2} strokeDasharray="6 4" fill="transparent" name="anterior" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend by Category */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-slate-100">Crecimiento por Categoria</h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Actual vs periodo anterior</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trendByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'} horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} />
                  <YAxis type="category" dataKey="categoria" axisLine={false} tickLine={false} tick={{ fill: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#9ca3af', fontSize: 12 }} width={80} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`€${value.toLocaleString()}`, name === 'actual' ? 'Ventas actuales' : 'Ventas anteriores']}
                    contentStyle={{ borderRadius: 12, border: '1px solid ' + (document.documentElement.classList.contains('dark') ? '#334155' : '#f3f4f6'), fontSize: 13, backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#1f2937' }}
                  />
                  <Legend />
                  <Bar dataKey="actual" fill="#f97316" radius={[0, 4, 4, 0]} name="Ventas actuales" barSize={16} />
                  <Bar dataKey="anterior" fill={document.documentElement.classList.contains('dark') ? '#475569' : '#e2e8f0'} radius={[0, 4, 4, 0]} name="Ventas anteriores" barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Growth table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100">Resumen de Crecimiento por Categoria</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">Categoria</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">Ventas actuales</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">Ventas anterior</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">Crecimiento</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {data.trendByCategory.map((cat) => {
                  const isUp = cat.crecimiento >= 0;
                  return (
                    <tr key={cat.categoria} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3 text-gray-800 dark:text-slate-100 font-medium">{cat.categoria}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-slate-300 text-right">€{cat.actual.toLocaleString()}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-slate-400 text-right">€{cat.anterior.toLocaleString()}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {isUp ? '+' : ''}{cat.crecimiento}%
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isUp ? 'bg-green-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(Math.abs(cat.crecimiento), 100)}%` }}
                            />
                          </div>
                          <i className={`${isUp ? 'ri-arrow-up-line text-green-500' : 'ri-arrow-down-line text-red-500'} text-xs`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PremiumGate>
  );
}