import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import PremiumGate from '@/components/feature/PremiumGate';
import { supabase } from '@/lib/supabase';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'];
const STATUS_LABELS: Record<string, string> = {
  activo: 'Activos', ausente: 'Ausentes', vacaciones: 'Vacaciones', paro_temporal: 'Paro Temporal', no_servicio: 'No Servicio',
};

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
        {sparkData.length > 0 && <Sparkline data={sparkData} dataKey={sparkKey} color={color} />}
      </div>
    </div>
  );
}

function YearSelector({ selectedYear, onChange, years }: { selectedYear: number; onChange: (y: number) => void; years: number[] }) {
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

const pct = (curr: number, prev: number) => (prev ? Math.round(((curr - prev) / prev) * 100) : 0);

export default function Estadisticas() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [fuelTickets, setFuelTickets] = useState<any[]>([]);
  const [timeRecords, setTimeRecords] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: inv }, { data: fuel }, { data: time }, { data: cl }] = await Promise.all([
      supabase.from('invoices').select('id, amount, date, client, status'),
      supabase.from('fuel_tickets').select('id, liters, cost, date'),
      supabase.from('time_tracking').select('employee, total_hours, date'),
      supabase.from('clients').select('id, status'),
    ]);
    setInvoices(inv || []);
    setFuelTickets(fuel || []);
    setTimeRecords(time || []);
    setClients(cl || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const years = useMemo(() => {
    const ys = new Set<number>([currentYear]);
    invoices.forEach(i => { if (i.date) ys.add(new Date(i.date).getFullYear()); });
    return Array.from(ys).sort((a, b) => a - b).slice(-3);
  }, [invoices, currentYear]);

  const byYear = (dateStr: string | null, year: number) => !!dateStr && new Date(dateStr).getFullYear() === year;

  const monthlyFor = useCallback((year: number) => {
    const invMap = new Map<string, number>(); MONTHS.forEach(m => invMap.set(m, 0));
    invoices.filter(i => byYear(i.date, year)).forEach(i => {
      const m = MONTHS[new Date(i.date).getMonth()];
      invMap.set(m, (invMap.get(m) || 0) + Number(i.amount || 0));
    });

    const fuelMap = new Map<string, { litros: number; costo: number }>();
    MONTHS.forEach(m => fuelMap.set(m, { litros: 0, costo: 0 }));
    fuelTickets.filter(f => byYear(f.date, year)).forEach(f => {
      const m = MONTHS[new Date(f.date).getMonth()];
      const curr = fuelMap.get(m)!;
      fuelMap.set(m, { litros: curr.litros + Number(f.liters || 0), costo: curr.costo + Number(f.cost || 0) });
    });

    return {
      salesData: MONTHS.map(m => ({ month: m, ventas: Math.round(invMap.get(m) || 0) })),
      fuelData: MONTHS.map(m => ({ month: m, litros: Math.round(fuelMap.get(m)!.litros), costo: Math.round(fuelMap.get(m)!.costo) })),
    };
  }, [invoices, fuelTickets]);

  const current = useMemo(() => monthlyFor(selectedYear), [monthlyFor, selectedYear]);
  const previous = useMemo(() => monthlyFor(selectedYear - 1), [monthlyFor, selectedYear]);

  const totalSales = current.salesData.reduce((s, d) => s + d.ventas, 0);
  const totalSalesPrev = previous.salesData.reduce((s, d) => s + d.ventas, 0);
  const totalFuel = current.fuelData.reduce((s, d) => s + d.litros, 0);
  const totalFuelPrev = previous.fuelData.reduce((s, d) => s + d.litros, 0);

  const hoursByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    timeRecords.filter(t => byYear(t.date, selectedYear) && t.employee).forEach(t => {
      map.set(t.employee, (map.get(t.employee) || 0) + Number(t.total_hours || 0));
    });
    return Array.from(map.entries()).map(([employee, horas]) => ({ employee, horas: Math.round(horas) })).sort((a, b) => b.horas - a.horas).slice(0, 8);
  }, [timeRecords, selectedYear]);

  const hoursByEmployeePrev = useMemo(() => {
    const map = new Map<string, number>();
    timeRecords.filter(t => byYear(t.date, selectedYear - 1) && t.employee).forEach(t => {
      map.set(t.employee, (map.get(t.employee) || 0) + Number(t.total_hours || 0));
    });
    return Array.from(map.values()).reduce((s, v) => s + v, 0);
  }, [timeRecords, selectedYear]);

  const totalHours = hoursByEmployee.reduce((s, d) => s + d.horas, 0);

  const clientStatusData = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach(c => { const s = c.status || 'activo'; map.set(s, (map.get(s) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name: STATUS_LABELS[name] || name, value }));
  }, [clients]);

  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    invoices.filter(i => byYear(i.date, selectedYear)).forEach(i => {
      const c = i.client || 'Sin nombre';
      map.set(c, (map.get(c) || 0) + Number(i.amount || 0));
    });
    return Array.from(map.entries()).map(([name, ventas]) => ({ name, ventas: Math.round(ventas) })).sort((a, b) => b.ventas - a.ventas).slice(0, 8);
  }, [invoices, selectedYear]);

  const yoySalesData = useMemo(() => current.salesData.map((d, i) => ({
    month: d.month, actual: d.ventas, anterior: previous.salesData[i]?.ventas ?? 0,
  })), [current, previous]);

  const weeklyFromMonthly = useMemo(() => {
    // Aproximación de tendencia semanal a partir del acumulado mensual real
    let acc = 0, accPrev = 0;
    return current.salesData.slice(0, 8).map((d, i) => {
      acc += d.ventas / 4;
      accPrev += (previous.salesData[i]?.ventas || 0) / 4;
      return { semana: `S${i + 1}`, ventas: Math.round(acc), anterior: Math.round(accPrev) };
    });
  }, [current, previous]);

  return (
    <PremiumGate>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Estadísticas y Reportes</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Calculado a partir de tus facturas, combustible y fichajes reales{loading && ' (cargando...)'}
            </p>
          </div>
          <YearSelector selectedYear={selectedYear} onChange={setSelectedYear} years={years} />
        </div>

        {!loading && invoices.length === 0 && fuelTickets.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-center">
            <i className="ri-bar-chart-line text-2xl text-amber-500 mb-2 block" />
            <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Aún no hay suficientes datos</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Los gráficos se irán llenando según crees facturas, tickets de combustible y fichajes.</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <TrendCard label="Ventas Totales" value={`€${totalSales.toLocaleString()}`} trend={pct(totalSales, totalSalesPrev)} trendLabel={`vs ${selectedYear - 1}`} color="#10b981" icon="ri-money-euro-circle-line" sparkData={weeklyFromMonthly} sparkKey="ventas" />
          <TrendCard label="Combustible" value={`${totalFuel.toLocaleString()}L`} trend={pct(totalFuel, totalFuelPrev)} trendLabel={`vs ${selectedYear - 1}`} color="#3b82f6" icon="ri-gas-station-line" sparkData={current.fuelData} sparkKey="litros" />
          <TrendCard label="Horas Trabajadas" value={`${totalHours}h`} trend={pct(totalHours, hoursByEmployeePrev)} trendLabel={`vs ${selectedYear - 1}`} color="#10b981" icon="ri-time-line" sparkData={hoursByEmployee} sparkKey="horas" />
          <TrendCard label="Clientes" value={String(clients.length)} trend={0} trendLabel="total" color="#8b5cf6" icon="ri-team-line" sparkData={[]} sparkKey="value" />
        </div>

        {/* YoY */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-slate-100">Comparativa {selectedYear} vs {selectedYear - 1}</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Facturación real por mes</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yoySalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number, name: string) => [`€${value.toLocaleString()}`, name === 'actual' ? `${selectedYear}` : `${selectedYear - 1}`]} />
                <Legend />
                <Bar dataKey="actual" fill="#f97316" radius={[6, 6, 0, 0]} name={String(selectedYear)} />
                <Bar dataKey="anterior" fill="#e2e8f0" radius={[6, 6, 0, 0]} name={String(selectedYear - 1)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Ventas Mensuales</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={current.salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="ventas" fill="#f97316" radius={[6, 6, 0, 0]} name="Ventas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Consumo de Combustible</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={current.fuelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="litros" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Litros" />
                  <Area type="monotone" dataKey="costo" stroke="#f97316" fill="#f97316" fillOpacity={0.1} name="Costo (€)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Horas Trabajadas por Empleado</h3>
            <div className="h-64">
              {hoursByEmployee.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">Sin fichajes registrados este año</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursByEmployee}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="employee" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="horas" fill="#10b981" radius={[6, 6, 0, 0]} name="Horas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Estado de Clientes</h3>
            <div className="h-64">
              {clientStatusData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">Sin clientes registrados</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={clientStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                      {clientStatusData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-center gap-4 flex-wrap">
              {clientStatusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-gray-600 dark:text-slate-300">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top clients */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Top Clientes por Facturación ({selectedYear})</h3>
          <div className="h-64">
            {topClients.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-slate-500">Sin facturas este año</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => [`€${v.toLocaleString()}`, 'Facturado']} />
                  <Bar dataKey="ventas" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Weekly trend */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-slate-100">Tendencia de Ventas</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Acumulado real por periodo, comparado con el año anterior</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyFromMonthly}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="semana" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(value: number, name: string) => [`€${value.toLocaleString()}`, name === 'ventas' ? 'Actual' : 'Anterior']} />
                <Area type="monotone" dataKey="ventas" stroke="#f97316" strokeWidth={3} fill="url(#colorVentas)" name="ventas" />
                <Area type="monotone" dataKey="anterior" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 4" fill="transparent" name="anterior" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PremiumGate>
  );
}
