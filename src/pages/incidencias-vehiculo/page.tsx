import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useClickOutside } from '@/hooks/useClickOutside';
import PremiumGate from '@/components/feature/PremiumGate';
import ImageWithFallback from '@/components/base/ImageWithFallback';

/* ---------- Print report helpers ---------- */
function openVehicleReport(vehicleName: string, incidents: VehicleIncident[], repairs: VehicleRepair[], totalCost: number) {
  const incs = incidents.filter(i => i.vehicle === vehicleName);
  const reps = repairs.filter(r => {
    const inc = incidents.find(i => i.id === r.incident_id);
    return inc?.vehicle === vehicleName;
  });
  const openInc = incs.filter(i => i.status === 'abierta' || i.status === 'en_reparacion');
  const resolvedInc = incs.filter(i => i.status === 'resuelta');
  const incCost = incs.reduce((s, i) => s + Number(i.cost || 0), 0);
  const repCost = reps.reduce((s, r) => s + Number(r.cost || 0), 0);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Informe Vehículo — ${vehicleName}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #333; background: #fff; }
  h1 { font-size: 22px; margin-bottom: 4px; color: #111; }
  .sub { color: #888; font-size: 12px; margin-bottom: 24px; }
  .meta { display: flex; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
  .meta-box { background: #f8f9fa; border-radius: 8px; padding: 12px 16px; min-width: 120px; }
  .meta-box label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .meta-box value { display: block; font-size: 18px; font-weight: 700; margin-top: 4px; color: #222; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
  th { text-align: left; background: #f4f4f5; padding: 8px 10px; font-weight: 600; color: #555; border-bottom: 2px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
  .badge-abierta { background: #fef2f2; color: #dc2626; }
  .badge-en_reparacion { background: #fffbeb; color: #d97706; }
  .badge-resuelta { background: #f0fdf4; color: #16a34a; }
  .section-title { font-size: 14px; font-weight: 700; margin: 28px 0 10px; color: #111; }
  .total-row { font-weight: 700; color: #111; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <h1>${vehicleName}</h1>
  <p class="sub">Informe de incidencias y reparaciones · Generado el ${new Date().toLocaleDateString('es-ES')}</p>

  <div class="meta">
    <div class="meta-box"><label>Total incidencias</label><value>${incs.length}</value></div>
    <div class="meta-box"><label>Abiertas / Pendientes</label><value style="color:#dc2626">${openInc.length}</value></div>
    <div class="meta-box"><label>Resueltas</label><value style="color:#16a34a">${resolvedInc.length}</value></div>
    <div class="meta-box"><label>Coste total</label><value>€${totalCost.toFixed(2)}</value></div>
    <div class="meta-box"><label>Reparaciones</label><value>${reps.length}</value></div>
  </div>

  <div class="section-title">Incidencias</div>
  <table>
    <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Conductor</th><th>Estado</th><th>Coste</th></tr></thead>
    <tbody>
      ${incs.length === 0 ? '<tr><td colspan="6" style="color:#999">Sin incidencias registradas</td></tr>' : incs.map(i => `
        <tr>
          <td>${i.date || '—'}</td>
          <td>${i.type || '—'}</td>
          <td>${i.description || '—'}</td>
          <td>${i.driver || '—'}</td>
          <td><span class="badge badge-${i.status || 'abierta'}">${i.status === 'abierta' ? 'Abierta' : i.status === 'en_reparacion' ? 'En reparación' : 'Resuelta'}</span></td>
          <td>${i.cost !== null ? '€' + Number(i.cost).toFixed(2) : '—'}</td>
        </tr>
      `).join('')}
      <tr class="total-row"><td colspan="5">Coste total incidencias</td><td>€${incCost.toFixed(2)}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Historial de reparaciones</div>
  <table>
    <thead><tr><th>Fecha</th><th>Descripción</th><th>Mecánico / Taller</th><th>Piezas</th><th>Coste</th></tr></thead>
    <tbody>
      ${reps.length === 0 ? '<tr><td colspan="5" style="color:#999">Sin reparaciones registradas</td></tr>' : reps.map(r => `
        <tr>
          <td>${r.date || '—'}</td>
          <td>${r.description || '—'}</td>
          <td>${r.mechanic || '—'}</td>
          <td>${r.parts_used || '—'}</td>
          <td>${r.cost !== null ? '€' + Number(r.cost).toFixed(2) : '—'}</td>
        </tr>
      `).join('')}
      <tr class="total-row"><td colspan="4">Coste total reparaciones</td><td>€${repCost.toFixed(2)}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Resumen financiero</div>
  <table>
    <thead><tr><th>Concepto</th><th>Importe</th></tr></thead>
    <tbody>
      <tr><td>Coste incidencias</td><td>€${incCost.toFixed(2)}</td></tr>
      <tr><td>Coste reparaciones</td><td>€${repCost.toFixed(2)}</td></tr>
      <tr class="total-row"><td>Total</td><td>€${(incCost + repCost).toFixed(2)}</td></tr>
    </tbody>
  </table>

  <p style="margin-top:40px; font-size:11px; color:#aaa; text-align:center;">Generado por Quickly · ${new Date().toLocaleDateString('es-ES')}</p>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }
}

/* ---------- End print helpers ---------- */

interface VehicleIncident {
  id: number;
  vehicle: string | null;
  driver: string | null;
  date: string | null;
  type: string | null;
  description: string | null;
  status: string | null;
  cost: number | null;
  photo: string | null;
  created_at: string;
}

interface VehicleRepair {
  id: number;
  incident_id: number;
  date: string | null;
  description: string | null;
  cost: number | null;
  mechanic: string | null;
  parts_used: string | null;
  created_at: string;
}

export default function IncidenciasVehiculo() {
  const [incidents, setIncidents] = useState<VehicleIncident[]>([]);
  const [allRepairs, setAllRepairs] = useState<VehicleRepair[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle: '', driver: '', date: '', type: '', description: '', status: 'abierta', cost: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useClickOutside(modalRef, () => { setModalOpen(false); clearPhoto(); }, modalOpen);

  // Detail + Repair History
  const [detailIncident, setDetailIncident] = useState<VehicleIncident | null>(null);
  const [detailRepairs, setDetailRepairs] = useState<VehicleRepair[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const detailModalRef = useRef<HTMLDivElement>(null);

  // Add repair modal
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairForm, setRepairForm] = useState({
    date: '', description: '', cost: '', mechanic: '', parts_used: '',
  });
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const repairModalRef = useRef<HTMLDivElement>(null);
  useClickOutside(repairModalRef, () => { setShowRepairModal(false); }, showRepairModal);

  // Photo upload
  const [incidentPhoto, setIncidentPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: incData }, { data: repData }] = await Promise.all([
      supabase.from('vehicle_incidents').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('vehicle_repairs').select('*').order('date', { ascending: false }),
    ]);
    setIncidents(incData || []);
    setAllRepairs(repData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const processPhoto = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setIncidentPhoto(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPhoto(file);
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processPhoto(file);
  };

  const clearPhoto = () => {
    setIncidentPhoto(null);
    setPhotoName('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Detail with repairs
  const openDetail = async (incident: VehicleIncident) => {
    setDetailIncident(incident);
    setShowDetail(true);
    setDetailLoading(true);
    const { data } = await supabase
      .from('vehicle_repairs')
      .select('*')
      .eq('incident_id', incident.id)
      .order('date', { ascending: false });
    setDetailRepairs(data || []);
    setDetailLoading(false);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setDetailIncident(null);
    setDetailRepairs([]);
  };
  useClickOutside(detailModalRef, closeDetail, showDetail);

  const addRepair = async () => {
    if (!detailIncident || !repairForm.description) return;
    setRepairSubmitting(true);
    const { error } = await supabase.from('vehicle_repairs').insert({
      incident_id: detailIncident.id,
      date: repairForm.date || null,
      description: repairForm.description,
      cost: repairForm.cost ? Number(repairForm.cost) : null,
      mechanic: repairForm.mechanic || null,
      parts_used: repairForm.parts_used || null,
    });
    setRepairSubmitting(false);
    if (!error) {
      setShowRepairModal(false);
      setRepairForm({ date: '', description: '', cost: '', mechanic: '', parts_used: '' });
      openDetail(detailIncident);
      fetchData();
    }
  };

  const deleteRepair = async (repairId: number) => {
    await supabase.from('vehicle_repairs').delete().eq('id', repairId);
    if (detailIncident) openDetail(detailIncident);
  };

  const updateIncidentStatus = async (id: number, status: string) => {
    await supabase.from('vehicle_incidents').update({ status }).eq('id', id);
    fetchData();
    if (detailIncident && detailIncident.id === id) {
      setDetailIncident({ ...detailIncident, status });
    }
  };

  // Filters
  const allVehicles = Array.from(new Set(incidents.map(i => i.vehicle).filter(Boolean)));

  const filtered = incidents.filter((i) => {
    const matchSearch = !search ||
      i.vehicle?.toLowerCase().includes(search.toLowerCase()) ||
      i.driver?.toLowerCase().includes(search.toLowerCase()) ||
      i.type?.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || i.status === statusFilter;
    const matchVehicle = !vehicleFilter || i.vehicle === vehicleFilter;
    return matchSearch && matchStatus && matchVehicle;
  });

  const openCount = incidents.filter((i) => i.status === 'abierta').length;
  const inProgressCount = incidents.filter((i) => i.status === 'en_reparacion').length;
  const totalCost = incidents.reduce((s, i) => s + Number(i.cost || 0), 0);

  const getStatusStyle = (status: string | null) => {
    switch (status) {
      case 'abierta': return 'bg-red-50 text-red-600 border-red-200';
      case 'en_reparacion': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'resuelta': return 'bg-green-50 text-green-600 border-green-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getStatusDot = (status: string | null) => {
    switch (status) {
      case 'abierta': return 'bg-red-500';
      case 'en_reparacion': return 'bg-amber-500';
      case 'resuelta': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const handleCreate = async () => {
    if (!form.vehicle || !form.type) return;
    setSubmitting(true);
    await supabase.from('vehicle_incidents').insert({
      vehicle: form.vehicle,
      driver: form.driver || null,
      date: form.date || null,
      type: form.type,
      description: form.description || null,
      status: form.status,
      cost: form.cost ? Number(form.cost) : null,
      photo: incidentPhoto || null,
    });
    setSubmitting(false);
    setModalOpen(false);
    setForm({ vehicle: '', driver: '', date: '', type: '', description: '', status: 'abierta', cost: '' });
    clearPhoto();
    fetchData();
  };

  return (
    <PremiumGate>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Incidencias de Vehículo</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Gestión de averías y problemas de la flota con historial de reparaciones</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all whitespace-nowrap"
        >
          <i className="ri-add-line" />
          Nueva incidencia
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Abiertas</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{openCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">En Reparación</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{inProgressCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Coste Total</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">€{totalCost.toFixed(2)}</p>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex-1 flex items-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2 min-w-[200px]">
          <div className="w-4 h-4 flex items-center justify-center mr-2">
            <i className="ri-search-line text-gray-400 text-sm" />
          </div>
          <input
            type="text"
            placeholder="Buscar vehículo, conductor, tipo o descripción..."
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
          {allVehicles.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none min-w-[160px]"
        >
          <option value="">Todos los estados</option>
          <option value="abierta">Abierta</option>
          <option value="en_reparacion">En reparación</option>
          <option value="resuelta">Resuelta</option>
        </select>
        {(search || statusFilter || vehicleFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setVehicleFilter(''); }}
            className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 whitespace-nowrap"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Vehicle summary cards */}
      {allVehicles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {allVehicles.slice(0, 4).map((v) => {
            const count = incidents.filter((i) => i.vehicle === v).length;
            const open = incidents.filter((i) => i.vehicle === v && i.status === 'abierta').length;
            const cost = incidents.filter((i) => i.vehicle === v).reduce((s, i) => s + Number(i.cost || 0), 0);
            return (
              <div
                key={v}
                className={`text-left p-3 rounded-xl border transition-all ${
                  vehicleFilter === v
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                    : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
                }`}
              >
                <button
                  onClick={() => setVehicleFilter(v === vehicleFilter ? '' : v)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                      <i className="ri-car-line text-gray-500 text-sm" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">{v}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{count} <span className="text-xs font-normal text-gray-400">incid.</span></p>
                  {open > 0 && <span className="text-xs text-red-500">{open} abiertas</span>}
                  <p className="text-xs text-gray-400 mt-0.5">€{cost.toFixed(0)} coste</p>
                </button>
                <button
                  onClick={() => openVehicleReport(v, incidents, allRepairs, cost)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-300 transition-all"
                >
                  <i className="ri-file-pdf-line" />
                  Informe PDF
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-slate-400">Cargando incidencias...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-car-line text-gray-400 text-xl" />
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">No hay incidencias registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Vehículo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Conductor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Descripción</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Coste</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Foto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-800 dark:text-slate-100 whitespace-nowrap">{i.date || '—'}</td>
                    <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium">{i.vehicle || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{i.driver || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{i.type || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 max-w-xs truncate">{i.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(i.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(i.status)}`} />
                        {i.status || 'Desconocido'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium">{i.cost !== null ? `€${Number(i.cost).toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3">
                      {i.photo ? (
                        <button
                          onClick={() => window.open(i.photo!, '_blank')}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100"
                        >
                          <i className="ri-image-line" />
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(i)}
                        className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                      >
                        Ver historial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail + Repair History Modal */}
      {showDetail && detailIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div ref={detailModalRef} className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                  <i className="ri-car-line text-orange-500" />
                  {detailIncident.vehicle || 'Incidencia sin vehículo'}
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {detailIncident.type} · {detailIncident.date || 'Sin fecha'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(detailIncident.status)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(detailIncident.status)}`} />
                  {detailIncident.status}
                </span>
                <button onClick={closeDetail} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                  <i className="ri-close-line" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Incident info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Conductor</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{detailIncident.driver || '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Coste estimado</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                    {detailIncident.cost !== null ? `€${Number(detailIncident.cost).toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>

              {detailIncident.description && (
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Descripción</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{detailIncident.description}</p>
                </div>
              )}

              {detailIncident.photo && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Foto de la incidencia</p>
                  <ImageWithFallback
                    src={detailIncident.photo}
                    alt="Incidencia"
                    className="w-full h-48 object-cover rounded-xl"
                    fallbackClassName="w-full h-48 rounded-xl"
                  />
                </div>
              )}

              {/* Status actions */}
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-slate-500 mr-2">Cambiar estado:</span>
                {['abierta', 'en_reparacion', 'resuelta'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateIncidentStatus(detailIncident.id, s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      detailIncident.status === s
                        ? getStatusStyle(s) + ' ring-1 ring-offset-1'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300'
                    }`}
                  >
                    {s === 'abierta' ? 'Abierta' : s === 'en_reparacion' ? 'En reparación' : 'Resuelta'}
                  </button>
                ))}
              </div>

              {/* Repair History */}
              <div className="border-t border-gray-100 dark:border-slate-700 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    <i className="ri-tools-line text-orange-500" />
                    Historial de reparaciones
                  </h4>
                  <button
                    onClick={() => setShowRepairModal(true)}
                    className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 flex items-center gap-1"
                  >
                    <i className="ri-add-line" />
                    Añadir reparación
                  </button>
                </div>

                {detailLoading ? (
                  <div className="py-6 text-center">
                    <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Cargando historial...</p>
                  </div>
                ) : detailRepairs.length === 0 ? (
                  <div className="py-6 text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-2">
                      <i className="ri-tools-line text-gray-400 text-lg" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Sin reparaciones registradas</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Añade la primera reparación con el botón de arriba</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailRepairs.map((r) => (
                      <div key={r.id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded">{r.date || 'Sin fecha'}</span>
                              {r.mechanic && (
                                <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                                  <i className="ri-user-line" /> {r.mechanic}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-slate-200">{r.description}</p>
                            {r.parts_used && (
                              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                                <i className="ri-settings-3-line" /> Piezas: {r.parts_used}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {r.cost !== null && (
                              <p className="text-sm font-bold text-orange-600">€{Number(r.cost).toFixed(2)}</p>
                            )}
                            <button
                              onClick={() => deleteRepair(r.id)}
                              className="text-xs text-red-400 hover:text-red-600 mt-1"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 px-1">
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {detailRepairs.length} reparación{detailRepairs.length > 1 ? 'es' : ''}
                      </span>
                      <span className="text-sm font-bold text-orange-600">
                        Total: €{detailRepairs.reduce((s, r) => s + Number(r.cost || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Repair Modal */}
      {showRepairModal && detailIncident && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div ref={repairModalRef} className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-slate-100">Añadir reparación</h3>
              <button onClick={() => setShowRepairModal(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Fecha</label>
                  <input
                    type="date"
                    value={repairForm.date}
                    onChange={(e) => setRepairForm({ ...repairForm, date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Coste (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={repairForm.cost}
                    onChange={(e) => setRepairForm({ ...repairForm, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Mecánico / Taller</label>
                <input
                  type="text"
                  value={repairForm.mechanic}
                  onChange={(e) => setRepairForm({ ...repairForm, mechanic: e.target.value })}
                  placeholder="Nombre del mecánico o taller"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Descripción *</label>
                <textarea
                  value={repairForm.description}
                  onChange={(e) => setRepairForm({ ...repairForm, description: e.target.value })}
                  placeholder="Describe la reparación realizada..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Piezas utilizadas</label>
                <input
                  type="text"
                  value={repairForm.parts_used}
                  onChange={(e) => setRepairForm({ ...repairForm, parts_used: e.target.value })}
                  placeholder="Ej: Filtro de aceite, pastillas de freno..."
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setShowRepairModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={addRepair}
                disabled={!repairForm.description || repairSubmitting}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {repairSubmitting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar reparación'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Incident Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div ref={modalRef} className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-slate-100">Nueva Incidencia de Vehículo</h3>
              <button onClick={() => { setModalOpen(false); clearPhoto(); }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Vehículo *</label>
                  <input
                    type="text"
                    value={form.vehicle}
                    onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                    placeholder="Ej: Furgón 1"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Conductor</label>
                  <input
                    type="text"
                    value={form.driver}
                    onChange={(e) => setForm({ ...form, driver: e.target.value })}
                    placeholder="Nombre"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                  >
                    <option value="abierta">Abierta</option>
                    <option value="en_reparacion">En reparación</option>
                    <option value="resuelta">Resuelta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Tipo *</label>
                <input
                  type="text"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="Ej: Pinchazo, Avería motor, Choque..."
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe la incidencia con detalle..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Coste estimado (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                />
              </div>

              {/* Photo upload */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Foto de la incidencia</label>
                {incidentPhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                    <ImageWithFallback
                      src={incidentPhoto}
                      alt="Preview"
                      className="w-full h-32 object-cover"
                      fallbackText="I"
                      fallbackSize="md"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{photoName}</span>
                      <button type="button" onClick={clearPhoto} className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80">
                        <i className="ri-close-line text-sm" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    onDrop={handlePhotoDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingPhoto(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingPhoto(false); }}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
                      ${isDraggingPhoto ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500'}`}
                  >
                    <div className="w-8 h-8 mx-auto flex items-center justify-center mb-1">
                      <i className="ri-camera-line text-gray-400 dark:text-slate-500 text-xl" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra o haz clic para subir foto</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">JPG, PNG hasta 5MB</p>
                    <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => { setModalOpen(false); clearPhoto(); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.vehicle || !form.type || submitting}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </PremiumGate>
  );
}