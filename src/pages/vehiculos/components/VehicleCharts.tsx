import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

interface MaintenanceRecord {
  id: number;
  vehicle_name: string;
  maintenance_type: string;
  scheduled_date: string;
  cost_estimate: number;
  status: string;
}

interface IncidentRecord {
  id: number;
  vehicle: string | null;
  cost: number | null;
}

interface RepairRecord {
  id: number;
  incident_id: number;
  cost: number | null;
}

const COLORS = ['#f97316', '#10b981', '#6366f1', '#ef4444', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899'];

const maintenanceLabels: Record<string, string> = {
  cambio_aceite: 'Aceite',
  revision_itv: 'ITV',
  cambio_neumaticos: 'Neumáticos',
  revision_general: 'General',
  cambio_filtros: 'Filtros',
  frenos: 'Frenos',
};

export default function VehicleCharts({
  maintenance,
  incidents,
  repairs,
}: {
  maintenance: MaintenanceRecord[];
  incidents: IncidentRecord[];
  repairs: RepairRecord[];
}) {
  // 1. Cost per vehicle (maintenance estimate + incident cost + repair cost)
  const costByVehicle = useMemo(() => {
    const map: Record<string, number> = {};
    maintenance.forEach((m) => {
      map[m.vehicle_name] = (map[m.vehicle_name] || 0) + Number(m.cost_estimate || 0);
    });
    incidents.forEach((i) => {
      if (i.vehicle) map[i.vehicle] = (map[i.vehicle] || 0) + Number(i.cost || 0);
    });
    repairs.forEach((r) => {
      const inc = incidents.find((i) => i.id === r.incident_id);
      if (inc?.vehicle) {
        map[inc.vehicle] = (map[inc.vehicle] || 0) + Number(r.cost || 0);
      }
    });
    return Object.entries(map)
      .map(([name, cost]) => ({ name, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost);
  }, [maintenance, incidents, repairs]);

  // 2. Maintenance count by type
  const typeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    maintenance.forEach((m) => {
      const key = maintenanceLabels[m.maintenance_type] || m.maintenance_type;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [maintenance]);

  // 3. Cost evolution by month (scheduled_date)
  const evolutionData = useMemo(() => {
    const map: Record<string, number> = {};
    maintenance.forEach((m) => {
      const d = new Date(m.scheduled_date + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + Number(m.cost_estimate || 0);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, cost]) => ({ month, cost: Math.round(cost * 100) / 100 }));
  }, [maintenance]);

  // 4. Status distribution
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    maintenance.forEach((m) => {
      map[m.status] = (map[m.status] || 0) + 1;
    });
    const labels: Record<string, string> = {
      programado: 'Programado',
      pendiente: 'Pendiente',
      completado: 'Completado',
      vencido: 'Vencido',
    };
    return Object.entries(map).map(([status, value]) => ({ name: labels[status] || status, value }));
  }, [maintenance]);

  return (
    <div className="space-y-6">
      {/* Row 1: Cost per vehicle + Type distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <i className="ri-money-euro-circle-line text-orange-500" />
            Coste total por vehículo (€)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costByVehicle} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={50} stroke="#888" />
                <YAxis tick={{ fontSize: 11 }} stroke="#888" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }}
                  formatter={(val: number) => [`€${val.toFixed(2)}`, 'Coste']}
                />
                <Bar dataKey="cost" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <i className="ri-pie-chart-line text-orange-500" />
            Distribución por tipo de mantenimiento
          </h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                  fontSize={11}
                >
                  {typeDistribution.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`${val}`, 'Cantidad']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Cost evolution + Status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <i className="ri-line-chart-line text-orange-500" />
            Evolución de costes mensuales (€)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#888" />
                <YAxis tick={{ fontSize: 11 }} stroke="#888" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }}
                  formatter={(val: number) => [`€${val.toFixed(2)}`, 'Coste']}
                />
                <Area type="monotone" dataKey="cost" stroke="#f97316" fill="#f97316" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <i className="ri-bar-chart-grouped-line text-orange-500" />
            Estado de mantenimientos
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#888" />
                <YAxis tick={{ fontSize: 11 }} stroke="#888" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }}
                  formatter={(val: number) => [`${val}`, 'Cantidad']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry) => {
                    const colorMap: Record<string, string> = {
                      Programado: '#3b82f6',
                      Pendiente: '#f59e0b',
                      Completado: '#10b981',
                      Vencido: '#ef4444',
                    };
                    return <Cell key={entry.name} fill={colorMap[entry.name] || '#888'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}