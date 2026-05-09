import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotificationsContext } from '@/context/NotificationsContext';
import Modal from '@/components/base/Modal';
import VehicleCharts from './components/VehicleCharts';

interface Vehicle {
  name: string;
  totalKm: number;
  incidents: number;
  openIncidents: number;
  totalRepairCost: number;
  maintenanceCount: number;
  overdueMaintenance: number;
  color: string;
  driver: string;
  plate?: string;
  year?: number;
}

interface MaintenanceRecord {
  id: number;
  vehicle_name: string;
  maintenance_type: string;
  description: string | null;
  scheduled_date: string;
  scheduled_km: number | null;
  current_km: number;
  status: string;
  cost_estimate: number;
  mechanic: string | null;
  completed_date: string | null;
  completed_km: number | null;
  notes: string | null;
  created_at: string;
  recurrence_km: number | null;
  recurrence_months: number | null;
  alert_email: string | null;
  parent_maintenance_id: number | null;
}

const maintenanceTypeConfig: Record<string, { label: string; color: string; icon: string }> = {
  cambio_aceite: { label: 'Cambio de aceite', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: 'ri-oil-line' },
  revision_itv: { label: 'Revisión ITV', color: 'bg-red-50 text-red-600 border-red-200', icon: 'ri-shield-check-line' },
  cambio_neumaticos: { label: 'Neumáticos', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: 'ri-shape-line' },
  revision_general: { label: 'Revisión general', color: 'bg-green-50 text-green-600 border-green-200', icon: 'ri-settings-3-line' },
  cambio_filtros: { label: 'Filtros', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: 'ri-filter-line' },
  frenos: { label: 'Frenos', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: 'ri-stop-circle-line' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  programado: { label: 'Programado', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  pendiente: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  completado: { label: 'Completado', color: 'bg-green-50 text-green-600 border-green-200' },
  vencido: { label: 'Vencido', color: 'bg-red-50 text-red-600 border-red-200' },
};

const vehicleColors = ['#f97316', '#10b981', '#6366f1', '#ef4444', '#8b5cf6', '#14b8a6'];
const vehicleDrivers = ['Carlos Ruiz', 'María López', 'Antonio García', 'Laura Sánchez', 'Pedro Martínez', 'Ana Fernández'];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export default function Vehiculos() {
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotificationsContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetail, setShowDetail] = useState<MaintenanceRecord | null>(null);
  const [editModal, setEditModal] = useState<MaintenanceRecord | null>(null);

  const [form, setForm] = useState({
    vehicle_name: '',
    maintenance_type: 'cambio_aceite',
    description: '',
    scheduled_date: '',
    scheduled_km: '',
    current_km: '',
    cost_estimate: '',
    mechanic: '',
    notes: '',
    recurrence_km: '',
    recurrence_months: '',
    alert_email: '',
  });

  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCharts, setShowCharts] = useState(false);

  // Email alert state (simulated)
  const [showEmailAlert, setShowEmailAlert] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [mRes, iRes, rRes] = await Promise.all([
      supabase.from('vehicle_maintenance').select('*').order('scheduled_date', { ascending: true }),
      supabase.from('vehicle_incidents').select('*'),
      supabase.from('vehicle_repairs').select('*'),
    ]);
    setMaintenance(mRes.data || []);
    setIncidents(iRes.data || []);
    setRepairs(rRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto notifications for maintenance
  const checkedNotificationsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!maintenance.length) return;
    maintenance.forEach((m) => {
      if (checkedNotificationsRef.current.has(m.id)) return;
      const days = daysUntil(m.scheduled_date);
      if (m.status !== 'completado' && days <= 3 && days >= 0) {
        addNotification(
          `Mantenimiento próximo: ${m.vehicle_name}`,
          `${maintenanceTypeConfig[m.maintenance_type]?.label || m.maintenance_type} en ${days === 0 ? 'hoy' : days + ' días'} (${formatDate(m.scheduled_date)})`,
          'maintenance'
        );
        // Simulated email alert
        if (m.alert_email) {
          addNotification(
            `Email enviado a ${m.alert_email}`,
            `Recordatorio: ${m.vehicle_name} — ${maintenanceTypeConfig[m.maintenance_type]?.label || m.maintenance_type} el ${formatDate(m.scheduled_date)}`,
            'email'
          );
          setShowEmailAlert(`Email enviado a ${m.alert_email}: recordatorio de ${m.vehicle_name}`);
          setTimeout(() => setShowEmailAlert(null), 6000);
        }
        checkedNotificationsRef.current.add(m.id);
      } else if (m.status !== 'completado' && days < 0) {
        addNotification(
          `Mantenimiento vencido: ${m.vehicle_name}`,
          `${maintenanceTypeConfig[m.maintenance_type]?.label || m.maintenance_type} venció el ${formatDate(m.scheduled_date)}`,
          'maintenance'
        );
        supabase.from('vehicle_maintenance').update({ status: 'vencido' }).eq('id', m.id);
        checkedNotificationsRef.current.add(m.id);
      }
    });
  }, [maintenance, addNotification]);

  const vehicleNames = Array.from(new Set(maintenance.map((m) => m.vehicle_name)));
  const vehicles: Vehicle[] = vehicleNames.map((name, idx) => {
    const vMaint = maintenance.filter((m) => m.vehicle_name === name);
    const vIncidents = incidents.filter((i) => i.vehicle === name);
    const vRepairs = repairs.filter((r) => {
      const inc = incidents.find((i) => i.id === r.incident_id);
      return inc?.vehicle === name;
    });
    const openInc = vIncidents.filter((i) => i.status === 'abierta' || i.status === 'en_reparacion');
    const overdue = vMaint.filter((m) => m.status !== 'completado' && daysUntil(m.scheduled_date) < 0).length;
    return {
      name,
      totalKm: Math.max(...vMaint.map((m) => m.current_km), 0),
      incidents: vIncidents.length,
      openIncidents: openInc.length,
      totalRepairCost: vRepairs.reduce((s, r) => s + Number(r.cost || 0), 0) + vIncidents.reduce((s, i) => s + Number(i.cost || 0), 0),
      maintenanceCount: vMaint.length,
      overdueMaintenance: overdue,
      color: vehicleColors[idx % vehicleColors.length],
      driver: vehicleDrivers[idx % vehicleDrivers.length],
      plate: `-${String.fromCharCode(66 + idx)}-${String(1000 + idx * 234).slice(1)}`,
      year: 2021 + (idx % 5),
    };
  });

  const filteredMaintenance = maintenance.filter((m) => {
    const matchVehicle = !vehicleFilter || m.vehicle_name === vehicleFilter;
    const matchStatus = !statusFilter || m.status === statusFilter;
    const matchType = !typeFilter || m.maintenance_type === typeFilter;
    const matchSearch = !search ||
      m.vehicle_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.mechanic || '').toLowerCase().includes(search.toLowerCase());
    return matchVehicle && matchStatus && matchType && matchSearch;
  });

  const handleAdd = async () => {
    if (!form.vehicle_name || !form.scheduled_date) return;
    const { error } = await supabase.from('vehicle_maintenance').insert({
      vehicle_name: form.vehicle_name,
      maintenance_type: form.maintenance_type,
      description: form.description || null,
      scheduled_date: form.scheduled_date,
      scheduled_km: form.scheduled_km ? Number(form.scheduled_km) : null,
      current_km: form.current_km ? Number(form.current_km) : 0,
      cost_estimate: form.cost_estimate ? Number(form.cost_estimate) : 0,
      mechanic: form.mechanic || null,
      notes: form.notes || null,
      status: 'programado',
      recurrence_km: form.recurrence_km ? Number(form.recurrence_km) : null,
      recurrence_months: form.recurrence_months ? Number(form.recurrence_months) : null,
      alert_email: form.alert_email || null,
    });
    if (!error) {
      setShowAddModal(false);
      setForm({
        vehicle_name: '', maintenance_type: 'cambio_aceite', description: '', scheduled_date: '',
        scheduled_km: '', current_km: '', cost_estimate: '', mechanic: '', notes: '',
        recurrence_km: '', recurrence_months: '', alert_email: '',
      });
      fetchData();
      addNotification('Mantenimiento programado', `${form.vehicle_name}: ${maintenanceTypeConfig[form.maintenance_type]?.label || form.maintenance_type} para el ${form.scheduled_date}`, 'maintenance');
    }
  };

  const updateStatus = async (id: number, status: string) => {
    const updates: any = { status };
    if (status === 'completado') {
      updates.completed_date = new Date().toISOString().split('T')[0];
    }
    await supabase.from('vehicle_maintenance').update(updates).eq('id', id);

    // Auto-recurrence: create next maintenance when completed
    if (status === 'completado') {
      const completed = maintenance.find((m) => m.id === id);
      if (completed) {
        const nextDate = completed.recurrence_months ? addMonths(completed.scheduled_date, completed.recurrence_months) : '';
        const nextKm = completed.recurrence_km ? (completed.current_km || 0) + completed.recurrence_km : null;
        if (nextDate || nextKm) {
          await supabase.from('vehicle_maintenance').insert({
            vehicle_name: completed.vehicle_name,
            maintenance_type: completed.maintenance_type,
            description: `Recurrente (generado automáticamente tras completar el anterior)`,
            scheduled_date: nextDate || completed.scheduled_date,
            scheduled_km: nextKm,
            current_km: completed.current_km,
            cost_estimate: completed.cost_estimate,
            mechanic: completed.mechanic,
            status: 'programado',
            recurrence_km: completed.recurrence_km,
            recurrence_months: completed.recurrence_months,
            alert_email: completed.alert_email,
            parent_maintenance_id: completed.id,
          });
          addNotification(
            'Mantenimiento recurrente creado',
            `${completed.vehicle_name}: siguiente ${maintenanceTypeConfig[completed.maintenance_type]?.label || completed.maintenance_type} programado para ${nextDate ? formatDate(nextDate) : (nextKm ? nextKm.toLocaleString() + ' km' : 'próxima fecha')}`,
            'maintenance'
          );
        }
      }
    }

    fetchData();
    if (showDetail && showDetail.id === id) {
      setShowDetail({ ...showDetail, status, completed_date: updates.completed_date || showDetail.completed_date });
    }
  };

  const deleteMaintenance = async (id: number) => {
    await supabase.from('vehicle_maintenance').delete().eq('id', id);
    setShowDetail(null);
    fetchData();
  };

  const totalCostEstimate = maintenance.reduce((s, m) => s + Number(m.cost_estimate || 0), 0);
  const pendingCount = maintenance.filter((m) => m.status !== 'completado').length;
  const overdueCount = maintenance.filter((m) => m.status !== 'completado' && daysUntil(m.scheduled_date) < 0).length;

  return (
    <div className="space-y-6">
      {/* Email alert toast */}
      {showEmailAlert && (
        <div className="fixed top-4 right-4 z-[100] bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-[slideIn_0.3s_ease-out] max-w-sm">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="ri-mail-send-line text-sm" />
          </div>
          <div>
            <p className="text-sm font-medium">{showEmailAlert}</p>
            <p className="text-xs text-white/70">Alerta enviada automáticamente</p>
          </div>
          <button onClick={() => setShowEmailAlert(null)} className="ml-2 text-white/70 hover:text-white">
            <i className="ri-close-line" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Dashboard de Vehículos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Mantenimiento preventivo, estado de la flota y gestión de reparaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCharts((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              showCharts ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-bar-chart-2-line" /></div>
            {showCharts ? 'Ocultar gráficos' : 'Ver gráficos'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
            Programar mantenimiento
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <i className="ri-car-line text-orange-500 text-sm" />
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Vehículos</span>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{vehicles.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <i className="ri-calendar-check-line text-blue-500 text-sm" />
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <i className="ri-alert-line text-red-500 text-sm" />
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Vencidos</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <i className="ri-money-euro-circle-line text-green-500 text-sm" />
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Coste estimado</span>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">€{totalCostEstimate.toFixed(0)}</p>
        </div>
      </div>

      {/* Charts */}
      {showCharts && (
        <div className="animate-[fadeIn_0.3s_ease-out]">
          <VehicleCharts maintenance={maintenance} incidents={incidents} repairs={repairs} />
        </div>
      )}

      {/* Vehicle Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <i className="ri-truck-line text-orange-500" />
          Estado de la flota
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div
              key={v.name}
              onClick={() => setVehicleFilter(v.name === vehicleFilter ? '' : v.name)}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-4 cursor-pointer transition-all
                ${vehicleFilter === v.name
                  ? 'border-orange-300 dark:border-orange-700 ring-1 ring-orange-200 dark:ring-orange-800'
                  : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
                }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: v.color + '20', color: v.color }}>
                  <i className="ri-truck-line text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{v.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{v.plate} · {v.year}</p>
                </div>
                {v.overdueMaintenance > 0 && (
                  <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full text-[10px] font-bold">
                    {v.overdueMaintenance} venc.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500">KM</p>
                  <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{v.totalKm.toLocaleString()}</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500">Incid.</p>
                  <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{v.incidents}</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500">Mant.</p>
                  <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{v.maintenanceCount}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 dark:text-slate-500 flex items-center gap-1">
                  <i className="ri-user-line" /> {v.driver}
                </span>
                <span className="text-gray-400 dark:text-slate-500">
                  Coste: €{v.totalRepairCost.toFixed(0)}
                </span>
              </div>

              {v.openIncidents > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, (v.openIncidents / Math.max(v.incidents, 1)) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-red-500 font-medium">{v.openIncidents} abiertas</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex-1 flex items-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2 min-w-[200px]">
          <div className="w-4 h-4 flex items-center justify-center mr-2">
            <i className="ri-search-line text-gray-400 text-sm" />
          </div>
          <input
            type="text"
            placeholder="Buscar mantenimiento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-gray-700 dark:text-slate-200 outline-none w-full"
          />
        </div>
        <select
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none min-w-[160px]"
        >
          <option value="">Todos los vehículos</option>
          {vehicleNames.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none min-w-[160px]"
        >
          <option value="">Todos los estados</option>
          <option value="programado">Programado</option>
          <option value="pendiente">Pendiente</option>
          <option value="completado">Completado</option>
          <option value="vencido">Vencido</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none min-w-[160px]"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(maintenanceTypeConfig).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        {(search || vehicleFilter || statusFilter || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setVehicleFilter(''); setStatusFilter(''); setTypeFilter(''); }}
            className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 whitespace-nowrap"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Maintenance Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-slate-400">Cargando mantenimiento...</p>
          </div>
        ) : filteredMaintenance.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-tools-line text-gray-400 text-xl" />
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">No hay mantenimientos registrados</p>
            <button onClick={() => setShowAddModal(true)} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              Programar el primero
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Vehículo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Descripción</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">KM</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Coste</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Recurrente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Mecánico</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenance.map((m) => {
                  const days = daysUntil(m.scheduled_date);
                  const typeCfg = maintenanceTypeConfig[m.maintenance_type] || { label: m.maintenance_type, color: 'bg-gray-50 text-gray-600 border-gray-200', icon: 'ri-tools-line' };
                  const statusCfg = statusConfig[m.status] || { label: m.status, color: 'bg-gray-50 text-gray-600 border-gray-200' };
                  return (
                    <tr key={m.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium whitespace-nowrap">{m.vehicle_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${typeCfg.color}`}>
                          <i className={typeCfg.icon} />
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300 max-w-xs truncate">{m.description || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-700 dark:text-slate-200">{formatDate(m.scheduled_date)}</span>
                        {m.status !== 'completado' && (
                          <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${days < 0 ? 'bg-red-100 text-red-600' : days <= 3 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {days < 0 ? `${Math.abs(days)}d venc.` : days === 0 ? 'Hoy' : `${days}d`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {m.scheduled_km ? `${m.current_km.toLocaleString()} / ${m.scheduled_km.toLocaleString()}` : `${m.current_km.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'completado' ? 'bg-green-500' : m.status === 'vencido' ? 'bg-red-500' : m.status === 'pendiente' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium whitespace-nowrap">€{Number(m.cost_estimate).toFixed(2)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.recurrence_months || m.recurrence_km ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded text-[10px] font-medium">
                            <i className="ri-refresh-line" />
                            {m.recurrence_months ? `${m.recurrence_months}m` : ''} {m.recurrence_km ? `${m.recurrence_km}km` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap">{m.mechanic || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowDetail(m)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-100"
                            title="Ver detalle"
                          >
                            <i className="ri-eye-line text-sm" />
                          </button>
                          <button
                            onClick={() => setEditModal(m)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-500 hover:bg-gray-100"
                            title="Editar"
                          >
                            <i className="ri-pencil-line text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (maintenanceTypeConfig[showDetail.maintenance_type]?.color || '').split(' ')[0] }}>
                  <i className={`${maintenanceTypeConfig[showDetail.maintenance_type]?.icon || 'ri-tools-line'} text-sm`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100">{maintenanceTypeConfig[showDetail.maintenance_type]?.label || showDetail.maintenance_type}</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{showDetail.vehicle_name}</p>
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Fecha programada</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{formatDate(showDetail.scheduled_date)}</p>
                  {showDetail.status !== 'completado' && (
                    <p className={`text-xs mt-0.5 ${daysUntil(showDetail.scheduled_date) < 0 ? 'text-red-500' : daysUntil(showDetail.scheduled_date) <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {daysUntil(showDetail.scheduled_date) < 0 ? `Vencido hace ${Math.abs(daysUntil(showDetail.scheduled_date))} días` : daysUntil(showDetail.scheduled_date) === 0 ? 'Hoy' : `En ${daysUntil(showDetail.scheduled_date)} días`}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Coste estimado</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">€{Number(showDetail.cost_estimate).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Kilometraje</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                    {showDetail.scheduled_km ? `${showDetail.current_km.toLocaleString()} / ${showDetail.scheduled_km.toLocaleString()} km` : `${showDetail.current_km.toLocaleString()} km`}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Mecánico / Taller</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{showDetail.mechanic || '—'}</p>
                </div>
              </div>

              {/* Recurrence info */}
              {(showDetail.recurrence_months || showDetail.recurrence_km || showDetail.alert_email) && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-1.5 font-medium flex items-center gap-1">
                    <i className="ri-refresh-line" /> Configuración recurrente
                  </p>
                  <div className="space-y-1">
                    {showDetail.recurrence_months && (
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">Cada {showDetail.recurrence_months} meses</p>
                    )}
                    {showDetail.recurrence_km && (
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">Cada {showDetail.recurrence_km.toLocaleString()} km</p>
                    )}
                    {showDetail.alert_email && (
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <i className="ri-mail-line" /> Alertas a: {showDetail.alert_email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {showDetail.description && (
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Descripción</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{showDetail.description}</p>
                </div>
              )}

              {showDetail.notes && (
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Notas</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{showDetail.notes}</p>
                </div>
              )}

              <div className="flex gap-2 flex-wrap pt-2">
                <span className="text-xs text-gray-400 dark:text-slate-500 mr-2 self-center">Cambiar estado:</span>
                {['programado', 'pendiente', 'completado'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(showDetail.id, s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      showDetail.status === s
                        ? statusConfig[s].color + ' ring-1 ring-offset-1'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    }`}
                  >
                    {statusConfig[s].label}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  onClick={() => deleteMaintenance(showDetail.id)}
                  className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => { setShowDetail(null); setEditModal(showDetail); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                >
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Maintenance Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Programar mantenimiento" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Vehículo *</label>
              <input
                type="text"
                value={form.vehicle_name}
                onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })}
                placeholder="Ej: Furgoneta A1"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Tipo *</label>
              <select
                value={form.maintenance_type}
                onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              >
                {Object.entries(maintenanceTypeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Descripción</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalles del mantenimiento..."
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Fecha programada *</label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">KM programado</label>
              <input
                type="number"
                value={form.scheduled_km}
                onChange={(e) => setForm({ ...form, scheduled_km: e.target.value })}
                placeholder="Ej: 50000"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">KM actual</label>
              <input
                type="number"
                value={form.current_km}
                onChange={(e) => setForm({ ...form, current_km: e.target.value })}
                placeholder="Ej: 43800"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Coste estimado (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.cost_estimate}
                onChange={(e) => setForm({ ...form, cost_estimate: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Mecánico / Taller</label>
            <input
              type="text"
              value={form.mechanic}
              onChange={(e) => setForm({ ...form, mechanic: e.target.value })}
              placeholder="Nombre del taller o mecánico"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>

          {/* Recurrence section */}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-800">
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
              <i className="ri-refresh-line" /> Mantenimiento recurrente (opcional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Cada X meses</label>
                <input
                  type="number"
                  value={form.recurrence_months}
                  onChange={(e) => setForm({ ...form, recurrence_months: e.target.value })}
                  placeholder="Ej: 6"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Cada X km</label>
                <input
                  type="number"
                  value={form.recurrence_km}
                  onChange={(e) => setForm({ ...form, recurrence_km: e.target.value })}
                  placeholder="Ej: 15000"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Email de alerta</label>
              <input
                type="email"
                value={form.alert_email}
                onChange={(e) => setForm({ ...form, alert_email: e.target.value })}
                placeholder="taller@ejemplo.com"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
              <p className="text-[10px] text-indigo-400 dark:text-indigo-500 mt-1">Recibirá un recordatorio cuando el mantenimiento esté próximo</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Notas adicionales</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observaciones, piezas necesarias, etc."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>
            <button
              onClick={handleAdd}
              disabled={!form.vehicle_name || !form.scheduled_date}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              Programar
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editModal && (
        <EditMaintenanceModal
          record={editModal}
          onClose={() => setEditModal(null)}
          onSaved={fetchData}
          addNotification={addNotification}
        />
      )}
    </div>
  );
}

function EditMaintenanceModal({ record, onClose, onSaved, addNotification }: {
  record: MaintenanceRecord;
  onClose: () => void;
  onSaved: () => void;
  addNotification: (t: string, m: string, ty: string) => void;
}) {
  const [form, setForm] = useState({
    vehicle_name: record.vehicle_name,
    maintenance_type: record.maintenance_type,
    description: record.description || '',
    scheduled_date: record.scheduled_date,
    scheduled_km: record.scheduled_km?.toString() || '',
    current_km: record.current_km.toString(),
    cost_estimate: record.cost_estimate.toString(),
    mechanic: record.mechanic || '',
    notes: record.notes || '',
    recurrence_km: record.recurrence_km?.toString() || '',
    recurrence_months: record.recurrence_months?.toString() || '',
    alert_email: record.alert_email || '',
  });

  const handleSave = async () => {
    const { error } = await supabase.from('vehicle_maintenance').update({
      vehicle_name: form.vehicle_name,
      maintenance_type: form.maintenance_type,
      description: form.description || null,
      scheduled_date: form.scheduled_date,
      scheduled_km: form.scheduled_km ? Number(form.scheduled_km) : null,
      current_km: Number(form.current_km) || 0,
      cost_estimate: form.cost_estimate ? Number(form.cost_estimate) : 0,
      mechanic: form.mechanic || null,
      notes: form.notes || null,
      recurrence_km: form.recurrence_km ? Number(form.recurrence_km) : null,
      recurrence_months: form.recurrence_months ? Number(form.recurrence_months) : null,
      alert_email: form.alert_email || null,
    }).eq('id', record.id);
    if (!error) {
      onClose();
      onSaved();
      addNotification('Mantenimiento actualizado', `${form.vehicle_name} actualizado correctamente`, 'maintenance');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">Editar mantenimiento</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"><i className="ri-close-line" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Vehículo</label>
              <input type="text" value={form.vehicle_name} onChange={e => setForm({...form, vehicle_name: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Tipo</label>
              <select value={form.maintenance_type} onChange={e => setForm({...form, maintenance_type: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
                {Object.entries(maintenanceTypeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Descripción</label>
            <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Fecha programada</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm({...form, scheduled_date: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">KM programado</label>
              <input type="number" value={form.scheduled_km} onChange={e => setForm({...form, scheduled_km: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">KM actual</label>
              <input type="number" value={form.current_km} onChange={e => setForm({...form, current_km: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Coste estimado (€)</label>
              <input type="number" step="0.01" value={form.cost_estimate} onChange={e => setForm({...form, cost_estimate: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Mecánico / Taller</label>
            <input type="text" value={form.mechanic} onChange={e => setForm({...form, mechanic: e.target.value})} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
          </div>

          {/* Edit recurrence */}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-800">
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
              <i className="ri-refresh-line" /> Recurrencia
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Cada X meses</label>
                <input type="number" value={form.recurrence_months} onChange={e => setForm({...form, recurrence_months: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Cada X km</label>
                <input type="number" value={form.recurrence_km} onChange={e => setForm({...form, recurrence_km: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Email de alerta</label>
              <input type="email" value={form.alert_email} onChange={e => setForm({...form, alert_email: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Notas</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} maxLength={500} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Guardar cambios</button>
          </div>
        </div>
      </div>
    </div>
  );
}