import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { playNotificationSound } from '@/utils/sound';
import { supabase } from '@/lib/supabase';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useNotificationsContext } from '@/context/NotificationsContext';
import Modal from '@/components/base/Modal';
import { useRole } from '@/hooks/useRole';
import { useProfile } from '@/hooks/useProfile';
import ImageWithFallback from '@/components/base/ImageWithFallback';
import ChatWidget from '@/components/feature/ChatWidget';

const incidentTypes = [
  { value: 'Pinchazo',       label: '🔧 Pinchazo / Rueda' },
  { value: 'Avería Motor',   label: '🔩 Avería de motor' },
  { value: 'Frenos',         label: '⚠️ Problema de frenos' },
  { value: 'Eléctrico',      label: '⚡ Fallo eléctrico' },
  { value: 'Remolque',       label: '🚛 Problema con remolque' },
  { value: 'Carga',          label: '📦 Incidencia en la carga' },
  { value: 'Accidente',      label: '💥 Accidente de tráfico' },
  { value: 'Documentación',  label: '📋 Documentación / ADR' },
  { value: 'Combustible',    label: '⛽ Sin combustible' },
  { value: 'Mecánica',       label: '🔨 Avería mecánica general' },
  { value: 'Otro',           label: '❓ Otro' },
];

const productIncidentTypes = [
  { value: 'Rotura', label: 'Rotura / Deterioro' },
  { value: 'Caducidad', label: 'Caducidad vencida' },
  { value: 'Dano_transporte', label: 'Daño en transporte' },
  { value: 'Defecto_fabrica', label: 'Defecto de fábrica' },
  { value: 'Faltante', label: 'Producto faltante' },
  { value: 'Otro', label: 'Otro' },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  abierta: { label: 'Abierta', color: 'bg-red-50 text-red-600' },
  en_proceso: { label: 'En Proceso', color: 'bg-amber-50 text-amber-600' },
  resuelta: { label: 'Resuelta', color: 'bg-green-50 text-green-600' },
};

export default function Incidencias() {
  const { isEmpresa, isEmpleado, isCliente } = useRole();
  const { profile } = useProfile();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'fuel' | 'products'>('vehicles');
  const [showNewIncident, setShowNewIncident] = useState(false);
  const [showNewFuel, setShowNewFuel] = useState(false);
  const [showIncidentDetail, setShowIncidentDetail] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [showFuelDetail, setShowFuelDetail] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState<any | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [fuelTickets, setFuelTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [submittingFuel, setSubmittingFuel] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [incidentError, setIncidentError] = useState('');
  const [fuelError, setFuelError] = useState('');
  const [monthlySummary, setMonthlySummary] = useState({
    incidents: 0, open: 0, inProgress: 0, resolved: 0,
    fuelCost: 0, fuelLiters: 0, fuelTickets: 0,
  });
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<string[]>([]);
  const { addNotification } = useNotificationsContext();
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [newIncident, setNewIncident] = useState({ vehicle: '', type: 'Pinchazo', description: '', assigned_to: '' });
  const [newFuel, setNewFuel] = useState({ vehicle: '', employee: '', liters: '', cost: '', station: '' });

  // ── Productos ──────────────────────────────────────────────────────────
  const [productIncidents, setProductIncidents] = useState<any[]>([]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [productError, setProductError] = useState('');
  const [newProduct, setNewProduct] = useState({ product_name: '', type: 'Rotura', description: '' });
  const [productPhoto, setProductPhoto] = useState<string | null>(null);
  const [productPhotoName, setProductPhotoName] = useState('');
  const [isDraggingProductPhoto, setIsDraggingProductPhoto] = useState(false);
  const productPhotoInputRef = useRef<HTMLInputElement>(null);
  const newProductRef = useRef<HTMLDivElement>(null);
  const productDetailRef = useRef<HTMLDivElement>(null);

  const showSuccessToast = (msg: string) => {
    setSuccessToast(msg);
    playNotificationSound('success');
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const newIncidentRef = useRef<HTMLDivElement>(null);
  const incidentDetailRef = useRef<HTMLDivElement>(null);
  const fuelDetailRef = useRef<HTMLDivElement>(null);
  const newFuelRef = useRef<HTMLDivElement>(null);
  useClickOutside(newIncidentRef, () => { setShowNewIncident(false); clearIncidentPhoto(); }, showNewIncident);
  useClickOutside(incidentDetailRef, () => { setShowIncidentDetail(false); setSelectedIncident(null); }, showIncidentDetail);
  useClickOutside(fuelDetailRef, () => { setShowFuelDetail(false); setSelectedFuel(null); }, showFuelDetail);
  useClickOutside(newFuelRef, () => { setShowNewFuel(false); clearFuelPhoto(); }, showNewFuel);
  useClickOutside(newProductRef, () => { setShowNewProduct(false); clearProductPhoto(); }, showNewProduct);
  useClickOutside(productDetailRef, () => { setShowProductDetail(false); setSelectedProduct(null); }, showProductDetail);

  // Para clientes: ir directamente al tab de productos
  useEffect(() => { if (isCliente) setActiveTab('products'); }, [isCliente]);

  // Incident photo upload
  const [incidentPhoto, setIncidentPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fuel photo upload
  const [fuelPhoto, setFuelPhoto] = useState<string | null>(null);
  const [fuelPhotoName, setFuelPhotoName] = useState('');
  const [isDraggingFuelPhoto, setIsDraggingFuelPhoto] = useState(false);
  const fuelPhotoInputRef = useRef<HTMLInputElement>(null);

  const filteredIncidents = useMemo(() => {
    let data = [...incidents];
    if (selectedVehicleFilter !== 'all') {
      data = data.filter(i => i.vehicle === selectedVehicleFilter);
    }
    if (selectedStatusFilter !== 'all') {
      data = data.filter(i => i.status === selectedStatusFilter);
    }
    if (selectedTypeFilter !== 'all') {
      data = data.filter(i => i.type === selectedTypeFilter);
    }
    if (incidentSearch.trim()) {
      const q = incidentSearch.toLowerCase();
      data = data.filter(i =>
        i.vehicle?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.type?.toLowerCase().includes(q) ||
        i.assigned_to?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [incidents, selectedVehicleFilter, selectedStatusFilter, selectedTypeFilter, incidentSearch]);

  const filteredFuelTickets = useMemo(() => {
    if (isEmpresa) return fuelTickets;
    return fuelTickets.filter(f => f.employee === profile.full_name);
  }, [fuelTickets, isEmpresa, profile.full_name]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: incData }, { data: fuelData }, { data: prodData }] = await Promise.all([
      supabase.from('vehicle_incidents').select('*').order('id', { ascending: false }),
      supabase.from('fuel_tickets').select('*').order('id', { ascending: false }),
      supabase.from('product_incidents').select('*').order('id', { ascending: false }),
    ]);
    if (incData) {
      setIncidents(incData);
      const months = [...new Set(incData.map((i: any) => i.date?.slice(0, 7)).filter(Boolean))].sort().reverse();
      const vehicles = [...new Set(incData.map((i: any) => i.vehicle).filter(Boolean))].sort();
      setAvailableMonths(prev => {
        const merged = [...new Set([...prev, ...months])].sort().reverse();
        return merged;
      });
      setAvailableVehicles(prev => {
        const merged = [...new Set([...prev, ...vehicles])].sort();
        return merged;
      });
    }
    if (fuelData) {
      setFuelTickets(fuelData);
      const months = [...new Set(fuelData.map((f: any) => f.date?.slice(0, 7)).filter(Boolean))].sort().reverse();
      const vehicles = [...new Set(fuelData.map((f: any) => f.vehicle).filter(Boolean))].sort();
      setAvailableMonths(prev => {
        const merged = [...new Set([...prev, ...months])].sort().reverse();
        return merged;
      });
      setAvailableVehicles(prev => {
        const merged = [...new Set([...prev, ...vehicles])].sort();
        return merged;
      });
    }
    if (prodData) setProductIncidents(prodData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Recalculate monthly summary when filters or data change
  useEffect(() => {
    const monthIncidents = incidents.filter((i: any) =>
      i.date?.startsWith(selectedMonth) &&
      (selectedVehicleFilter === 'all' || i.vehicle === selectedVehicleFilter)
    );
    const monthFuel = fuelTickets.filter((f: any) =>
      f.date?.startsWith(selectedMonth) &&
      (selectedVehicleFilter === 'all' || f.vehicle === selectedVehicleFilter)
    );
    setMonthlySummary({
      incidents: monthIncidents.length,
      open: monthIncidents.filter(i => i.status === 'abierta').length,
      inProgress: monthIncidents.filter(i => i.status === 'en_proceso').length,
      resolved: monthIncidents.filter(i => i.status === 'resuelta').length,
      fuelCost: monthFuel.reduce((sum, f) => sum + Number(f.cost || 0), 0),
      fuelLiters: monthFuel.reduce((sum, f) => sum + Number(f.liters || 0), 0),
      fuelTickets: monthFuel.length,
    });
  }, [incidents, fuelTickets, selectedMonth, selectedVehicleFilter]);

  const processIncidentPhoto = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar los 5MB'); return; }
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setIncidentPhoto(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const handleIncidentPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processIncidentPhoto(file);
  };

  const handleIncidentPhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processIncidentPhoto(file);
  };

  const clearIncidentPhoto = () => { setIncidentPhoto(null); setPhotoName(''); if (photoInputRef.current) photoInputRef.current.value = ''; };

  const processFuelPhoto = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar los 5MB'); return; }
    setFuelPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFuelPhoto(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const handleFuelPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFuelPhoto(file);
  };

  const handleFuelPhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFuelPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processFuelPhoto(file);
  };

  const clearFuelPhoto = () => { setFuelPhoto(null); setFuelPhotoName(''); if (fuelPhotoInputRef.current) fuelPhotoInputRef.current.value = ''; };

  const processProductPhoto = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar los 5MB'); return; }
    setProductPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setProductPhoto(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };
  const clearProductPhoto = () => { setProductPhoto(null); setProductPhotoName(''); if (productPhotoInputRef.current) productPhotoInputRef.current.value = ''; };

  const addProductIncident = async () => {
    setProductError('');
    if (!newProduct.product_name.trim()) { setProductError('El nombre del producto es obligatorio'); return; }
    if (!newProduct.description.trim()) { setProductError('La descripción es obligatoria'); return; }
    setSubmittingProduct(true);
    const { error } = await supabase.from('product_incidents').insert([{
      ...newProduct,
      status: 'abierta',
      date: new Date().toISOString().split('T')[0],
      photo: productPhoto || null,
      reported_by: profile.full_name || '',
    }]);
    setSubmittingProduct(false);
    if (error) {
      setProductError('Error al registrar: ' + error.message);
    } else {
      addNotification('Nueva incidencia de producto', `${newProduct.product_name} — ${newProduct.type}`, 'system');
      showSuccessToast(`✅ Incidencia de "${newProduct.product_name}" registrada`);
      setShowNewProduct(false);
      setNewProduct({ product_name: '', type: 'Rotura', description: '' });
      clearProductPhoto();
      fetchData();
    }
  };

  const updateProductStatus = async (id: number, newStatus: string) => {
    const { error } = await supabase.from('product_incidents').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setSelectedProduct((prev: any) => prev ? { ...prev, status: newStatus } : null);
      fetchData();
    }
  };

  const addIncident = async () => {
    setIncidentError('');
    if (!newIncident.vehicle.trim()) { setIncidentError('El vehículo es obligatorio'); return; }
    if (!newIncident.description.trim()) { setIncidentError('La descripción es obligatoria'); return; }
    setSubmittingIncident(true);
    const { error } = await supabase.from('vehicle_incidents').insert([{
      ...newIncident,
      status: 'abierta',
      date: new Date().toISOString().split('T')[0],
      cost: 0,
      photo: incidentPhoto || null,
    }]);
    setSubmittingIncident(false);
    if (error) {
      setIncidentError('Error al registrar: ' + error.message);
    } else {
      addNotification(
        'Nueva incidencia registrada',
        `Incidencia ${newIncident.type} de ${newIncident.vehicle} registrada con estado Abierta`,
        'system'
      );
      showSuccessToast(`✅ Incidencia de ${newIncident.vehicle} registrada correctamente`);
      setShowNewIncident(false);
      setNewIncident({ vehicle: '', type: 'Pinchazo', description: '', assigned_to: '' });
      clearIncidentPhoto();
      fetchData();
    }
  };

  const addFuelTicket = async () => {
    setFuelError('');
    if (!newFuel.vehicle.trim()) { setFuelError('El vehículo es obligatorio'); return; }
    if (!newFuel.liters || Number(newFuel.liters) <= 0) { setFuelError('Los litros deben ser mayores a 0'); return; }
    if (!newFuel.cost || Number(newFuel.cost) <= 0) { setFuelError('El costo debe ser mayor a 0'); return; }
    setSubmittingFuel(true);
    const now = new Date();
    const { error } = await supabase.from('fuel_tickets').insert([{
      ...newFuel,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      liters: Number(newFuel.liters),
      cost: Number(newFuel.cost),
      invoice_photo: fuelPhoto || null,
    }]);
    setSubmittingFuel(false);
    if (error) {
      setFuelError('Error al guardar: ' + error.message);
    } else {
      addNotification(
        'Nuevo ticket de combustible',
        `Ticket de ${newFuel.vehicle}: ${newFuel.liters}L por €${Number(newFuel.cost).toFixed(2)}`,
        'system'
      );
      showSuccessToast(`⛽ Ticket de combustible de ${newFuel.vehicle} guardado`);
      setShowNewFuel(false);
      setNewFuel({ vehicle: '', employee: '', liters: '', cost: '', station: '' });
      clearFuelPhoto();
      fetchData();
    }
  };

  const updateIncidentStatus = async (id: number, newStatus: string) => {
    const oldStatus = selectedIncident?.status;
    setUpdatingStatus(true);
    const { error } = await supabase.from('vehicle_incidents').update({ status: newStatus }).eq('id', id);
    setUpdatingStatus(false);
    if (!error) {
      setSelectedIncident((prev: any) => prev ? { ...prev, status: newStatus } : null);
      if (oldStatus && oldStatus !== newStatus) {
        const vehicle = selectedIncident?.vehicle || 'Vehículo';
        const statusLabels: Record<string, string> = { abierta: 'Abierta', en_proceso: 'En Proceso', resuelta: 'Resuelta' };
        addNotification(
          'Estado de incidencia actualizado',
          `La incidencia de ${vehicle} pasó de ${statusLabels[oldStatus] || oldStatus} a ${statusLabels[newStatus] || newStatus}`,
          'system'
        );
      }
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Success toast */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-green-500 text-white px-4 py-3 rounded-xl shadow-lg animate-[slideIn_0.3s_ease-out] min-w-[280px]">
          <i className="ri-checkbox-circle-line text-xl flex-shrink-0" />
          <p className="text-sm font-medium">{successToast}</p>
          <button onClick={() => setSuccessToast(null)} className="ml-auto w-5 h-5 flex items-center justify-center opacity-70 hover:opacity-100">
            <i className="ri-close-line" />
          </button>
        </div>
      )}
      {/* Monthly Summary Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-bar-chart-box-line text-orange-500" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
              Resumen Mensual
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none"
            >
              {availableMonths.map((m) => {
                const [year, month] = m.split('-');
                const date = new Date(Number(year), Number(month) - 1);
                return (
                  <option key={m} value={m}>
                    {date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </option>
                );
              })}
              {availableMonths.length === 0 && (
                <option value={selectedMonth}>
                  {new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </option>
              )}
            </select>
            <select
              value={selectedVehicleFilter}
              onChange={(e) => setSelectedVehicleFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none"
            >
              <option value="all">Todas las furgonetas</option>
              {availableVehicles.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Incidencias</p>
            <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{monthlySummary.incidents}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-3 border border-red-100 dark:border-red-900/20">
            <p className="text-xs text-red-500 dark:text-red-400">Abiertas</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{monthlySummary.open}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-100 dark:border-amber-900/20">
            <p className="text-xs text-amber-500 dark:text-amber-400">En Proceso</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{monthlySummary.inProgress}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-100 dark:border-green-900/20">
            <p className="text-xs text-green-500 dark:text-green-400">Resueltas</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{monthlySummary.resolved}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3 border border-orange-100 dark:border-orange-900/20">
            <p className="text-xs text-orange-500 dark:text-orange-400">Combustible €</p>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">€{monthlySummary.fuelCost.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-100 dark:border-blue-900/20">
            <p className="text-xs text-blue-500 dark:text-blue-400">Litros</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{monthlySummary.fuelLiters.toFixed(1)} L</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Incidencias y Tickets</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Flota completa — furgonetas, camiones, trailers y vehículos industriales</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isCliente && (
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5
                ${activeTab === 'vehicles' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <i className="ri-truck-line" /> Vehículos
            </button>
          )}
          {!isCliente && (
            <button
              onClick={() => setActiveTab('fuel')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5
                ${activeTab === 'fuel' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              <i className="ri-gas-station-line" /> Combustible
            </button>
          )}
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5
              ${activeTab === 'products' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            <i className="ri-box-3-line" /> Productos
          </button>
        </div>
      </div>

      {activeTab === 'vehicles' && (
        <>
          {/* Stats + New button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">Abiertas</p>
                <p className="text-xl font-bold text-red-600">{incidents.filter(i => i.status === 'abierta').length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">En Proceso</p>
                <p className="text-xl font-bold text-amber-600">{incidents.filter(i => i.status === 'en_proceso').length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">Resueltas</p>
                <p className="text-xl font-bold text-green-600">{incidents.filter(i => i.status === 'resuelta').length}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewIncident(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line" />
              </div>
              Nueva Incidencia
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <div className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <i className="ri-search-line text-gray-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar incidencia..."
                value={incidentSearch}
                onChange={e => setIncidentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              />
            </div>
            <select
              value={selectedVehicleFilter}
              onChange={e => setSelectedVehicleFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
            >
              <option value="all">Todos los vehículos</option>
              {availableVehicles.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
            >
              <option value="all">Todos los estados</option>
              <option value="abierta">Abierta</option>
              <option value="en_proceso">En Proceso</option>
              <option value="resuelta">Resuelta</option>
            </select>
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
            >
              <option value="all">Todos los tipos</option>
              {incidentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {(selectedVehicleFilter !== 'all' || selectedStatusFilter !== 'all' || selectedTypeFilter !== 'all' || incidentSearch.trim()) && (
              <button
                onClick={() => { setSelectedVehicleFilter('all'); setSelectedStatusFilter('all'); setSelectedTypeFilter('all'); setIncidentSearch(''); }}
                className="px-3 py-2 text-xs text-orange-600 hover:text-orange-700 whitespace-nowrap"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIncidents.map((incident) => (
              <div key={incident.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-gray-800 dark:text-slate-100">{incident.vehicle}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[incident.status]?.color || 'bg-gray-50 text-gray-600'}`}>
                    {statusConfig[incident.status]?.label || incident.status}
                  </span>
                </div>
                <div className="mb-3">
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">{incident.type}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-300 mb-3">{incident.description}</p>
                {incident.photo && (
                  <div className="mb-3">
                    <button
                      onClick={() => window.open(incident.photo, '_blank')}
                      className="block w-full overflow-hidden rounded-lg border border-gray-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 transition-all"
                      title="Click para abrir en grande"
                    >
                      <img
                        src={incident.photo}
                        alt={`Foto incidencia ${incident.id}`}
                        className="w-full h-32 object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
                  <span>{incident.date}</span>
                  {incident.cost > 0 && <span className="font-medium text-gray-600 dark:text-slate-300">€{Number(incident.cost).toFixed(2)}</span>}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-slate-500">{incident.assigned_to || 'Sin asignar'}</span>
                  <button
                    onClick={() => { setSelectedIncident(incident); setShowIncidentDetail(true); }}
                    className="text-xs text-orange-600 hover:underline whitespace-nowrap"
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'fuel' && (
        <>
          <div className="flex items-center justify-between">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">Total Hoy</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">
                €{filteredFuelTickets.filter(f => f.date === new Date().toISOString().split('T')[0]).reduce((sum, f) => sum + Number(f.cost), 0).toFixed(2)}
              </p>
            </div>
            <button
              onClick={() => setShowNewFuel(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line" />
              </div>
              Nuevo Ticket
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Vehículo</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Empleado</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Hora</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Estación</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Litros</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Costo</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFuelTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-100">{ticket.vehicle}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{ticket.employee}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{ticket.date}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{ticket.time}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{ticket.station}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-200">{ticket.liters} L</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-100">€{Number(ticket.cost).toFixed(2)}</td>
                      <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {ticket.invoice_photo ? (
                          <button
                            onClick={() => window.open(ticket.invoice_photo, '_blank')}
                            className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 hover:border-orange-400 transition-all flex-shrink-0"
                            title="Click para abrir en grande"
                          >
                            <img
                              src={ticket.invoice_photo}
                              alt={`Factura ${ticket.id}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500 w-8 text-center">—</span>
                        )}
                        <button
                          onClick={() => { setSelectedFuel(ticket); setShowFuelDetail(true); }}
                          className="text-xs text-orange-600 hover:underline whitespace-nowrap"
                        >
                          Ver detalle
                        </button>
                      </div>
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Productos ─────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">Abiertas</p>
                <p className="text-xl font-bold text-red-600">{productIncidents.filter(p => p.status === 'abierta').length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">En Proceso</p>
                <p className="text-xl font-bold text-amber-600">{productIncidents.filter(p => p.status === 'en_proceso').length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">Resueltas</p>
                <p className="text-xl font-bold text-green-600">{productIncidents.filter(p => p.status === 'resuelta').length}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewProduct(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <i className="ri-add-line" /> Nueva Incidencia
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : productIncidents.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-12 text-center">
              <div className="w-14 h-14 mx-auto bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-3">
                <i className="ri-box-3-line text-orange-400 text-2xl" />
              </div>
              <p className="text-gray-500 dark:text-slate-400 text-sm">No hay incidencias de producto registradas</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">Haz clic en "Nueva Incidencia" para registrar una</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productIncidents.map((prod) => (
                <div key={prod.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                        <i className="ri-box-3-line text-orange-500 text-sm" />
                      </div>
                      <span className="font-semibold text-sm text-gray-800 dark:text-slate-100 truncate">{prod.product_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${statusConfig[prod.status]?.color || 'bg-gray-50 text-gray-600'}`}>
                      {statusConfig[prod.status]?.label || prod.status}
                    </span>
                  </div>
                  <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs mb-2">
                    {productIncidentTypes.find(t => t.value === prod.type)?.label || prod.type}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-slate-300 mb-3 line-clamp-2">{prod.description}</p>
                  {prod.photo && (
                    <button onClick={() => window.open(prod.photo, '_blank')} className="block w-full overflow-hidden rounded-lg border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all mb-3">
                      <img src={prod.photo} alt="Foto" className="w-full h-28 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    </button>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 mt-1 pt-3 border-t border-gray-50 dark:border-slate-800">
                    <span>{prod.date}</span>
                    <button onClick={() => { setSelectedProduct(prod); setShowProductDetail(true); }} className="text-orange-600 hover:underline">
                      Ver detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* New Incident Modal */}
      <Modal
        isOpen={showNewIncident}
        onClose={() => { setShowNewIncident(false); clearIncidentPhoto(); }}
        title="Nueva Incidencia de Vehículo"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Vehículo</label>
            <input type="text" placeholder="Ej: Camión TIR, Trailer, Furgoneta, Moto..." value={newIncident.vehicle} onChange={e => setNewIncident({...newIncident, vehicle: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Tipo de incidencia</label>
            <select value={newIncident.type} onChange={e => setNewIncident({...newIncident, type: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
              {incidentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Descripción</label>
            <textarea value={newIncident.description} onChange={e => setNewIncident({...newIncident, description: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none resize-none" rows={3} placeholder="Describe la incidencia..." maxLength={500} />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Asignado a</label>
            <input type="text" placeholder="Taller o responsable..." value={newIncident.assigned_to} onChange={e => setNewIncident({...newIncident, assigned_to: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
          </div>
          {/* Incident Photo Upload */}
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Foto de la incidencia</label>
            {incidentPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                <img src={incidentPhoto} alt="Preview" className="w-full h-32 object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{photoName}</span>
                  <button type="button" onClick={clearIncidentPhoto} className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80">
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => photoInputRef.current?.click()}
                onDrop={handleIncidentPhotoDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingPhoto(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingPhoto(false); }}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
                  ${isDraggingPhoto ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-500'}`}
              >
                <div className="w-8 h-8 mx-auto flex items-center justify-center mb-1">
                  <i className="ri-camera-line text-gray-400 dark:text-slate-500 text-xl" />
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra o haz clic para subir foto</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">JPG, PNG hasta 5MB</p>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handleIncidentPhotoSelect} className="hidden" />
              </div>
            )}
          </div>
          {incidentError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className="ri-error-warning-line" /></div>
              {incidentError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => { setShowNewIncident(false); setIncidentError(''); clearIncidentPhoto(); }} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 whitespace-nowrap">Cancelar</button>
            <button onClick={addIncident} disabled={submittingIncident} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap">
              {submittingIncident ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Registrando...</>
              ) : (
                <><div className="w-4 h-4 flex items-center justify-center"><i className="ri-check-line" /></div> Registrar</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Incident Detail Modal */}
      <Modal
        isOpen={showIncidentDetail && !!selectedIncident}
        onClose={() => { setShowIncidentDetail(false); setSelectedIncident(null); }}
        title="Detalle de Incidencia"
        size="lg"
      >
        {selectedIncident && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Vehículo</span>
              <span className="font-semibold text-gray-800 dark:text-slate-100">{selectedIncident.vehicle}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Estado</span>
              <div className="flex items-center gap-2">
                {updatingStatus && (
                  <div className="w-4 h-4 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
                )}
                <select
                  value={selectedIncident.status}
                  onChange={(e) => updateIncidentStatus(selectedIncident.id, e.target.value)}
                  disabled={updatingStatus}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border outline-none cursor-pointer transition-all
                    ${selectedIncident.status === 'abierta' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : ''}
                    ${selectedIncident.status === 'en_proceso' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' : ''}
                    ${selectedIncident.status === 'resuelta' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : ''}
                    disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <option value="abierta">Abierta</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="resuelta">Resuelta</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Tipo</span>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">{selectedIncident.type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Fecha</span>
              <span className="text-sm text-gray-700 dark:text-slate-200">{selectedIncident.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Asignado a</span>
              <span className="text-sm text-gray-700 dark:text-slate-200">{selectedIncident.assigned_to || 'Sin asignar'}</span>
            </div>
            {selectedIncident.cost > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-slate-400">Costo</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">€{Number(selectedIncident.cost).toFixed(2)}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-slate-400 block mb-1">Descripción</span>
              <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 rounded-lg p-3 border border-gray-100 dark:border-slate-700">
                {selectedIncident.description}
              </p>
            </div>
            {selectedIncident.photo && (
              <div>
                <span className="text-sm text-gray-500 dark:text-slate-400 block mb-2">Foto de la incidencia</span>
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                  <ImageWithFallback
                    src={selectedIncident.photo}
                    alt="Foto incidencia"
                    className="w-full h-48 object-cover"
                    fallbackText={selectedIncident.vehicle?.charAt(0) || 'I'}
                    fallbackSize="lg"
                  />
                </div>
                <button onClick={() => window.open(selectedIncident.photo, '_blank')} className="mt-2 text-xs text-orange-600 hover:underline flex items-center gap-1.5">
                  <i className="ri-external-link-line" /> Abrir imagen en nueva pestaña
                </button>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => { setShowIncidentDetail(false); setSelectedIncident(null); }} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 whitespace-nowrap">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Fuel Ticket Detail Modal */}
      <Modal
        isOpen={showFuelDetail && !!selectedFuel}
        onClose={() => { setShowFuelDetail(false); setSelectedFuel(null); }}
        title="Detalle de Ticket de Combustible"
        size="lg"
      >
        {selectedFuel && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Vehículo</span>
              <span className="font-semibold text-gray-800 dark:text-slate-100">{selectedFuel.vehicle}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Empleado</span>
              <span className="text-sm text-gray-700 dark:text-slate-200">{selectedFuel.employee || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Fecha y hora</span>
              <span className="text-sm text-gray-700 dark:text-slate-200">{selectedFuel.date} {selectedFuel.time}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Estación</span>
              <span className="text-sm text-gray-700 dark:text-slate-200">{selectedFuel.station || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Litros</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{selectedFuel.liters} L</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Costo</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">€{Number(selectedFuel.cost).toFixed(2)}</span>
            </div>
            {selectedFuel.invoice_photo && (
              <div>
                <span className="text-sm text-gray-500 dark:text-slate-400 block mb-2">Foto del ticket / factura</span>
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                  <ImageWithFallback
                    src={selectedFuel.invoice_photo}
                    alt="Foto ticket"
                    className="w-full h-48 object-cover"
                    fallbackText={selectedFuel.vehicle?.charAt(0) || 'T'}
                    fallbackSize="lg"
                  />
                </div>
                <button onClick={() => window.open(selectedFuel.invoice_photo, '_blank')} className="mt-2 text-xs text-orange-600 hover:underline flex items-center gap-1.5">
                  <i className="ri-external-link-line" /> Abrir imagen en nueva pestaña
                </button>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => { setShowFuelDetail(false); setSelectedFuel(null); }} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 whitespace-nowrap">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Fuel Modal */}
      <Modal
        isOpen={showNewFuel}
        onClose={() => { setShowNewFuel(false); clearFuelPhoto(); }}
        title="Nuevo Ticket de Combustible"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Vehículo</label>
              <input type="text" placeholder="Ej: F-01" value={newFuel.vehicle} onChange={e => setNewFuel({...newFuel, vehicle: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Empleado</label>
              <input type="text" placeholder="Nombre..." value={newFuel.employee} onChange={e => setNewFuel({...newFuel, employee: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Litros</label>
              <input type="number" placeholder="0.00" value={newFuel.liters} onChange={e => setNewFuel({...newFuel, liters: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Costo (€)</label>
              <input type="number" placeholder="0.00" value={newFuel.cost} onChange={e => setNewFuel({...newFuel, cost: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Estación de servicio</label>
            <input type="text" placeholder="Ej: BP, Repsol, Cepsa, depósito empresa..." value={newFuel.station} onChange={e => setNewFuel({...newFuel, station: e.target.value})} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
          </div>
          {/* Fuel Photo Upload */}
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Foto del ticket / factura</label>
            {fuelPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                <img src={fuelPhoto} alt="Preview" className="w-full h-32 object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{fuelPhotoName}</span>
                  <button type="button" onClick={clearFuelPhoto} className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80">
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fuelPhotoInputRef.current?.click()}
                onDrop={handleFuelPhotoDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFuelPhoto(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingFuelPhoto(false); }}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
                  ${isDraggingFuelPhoto ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-500'}`}
              >
                <div className="w-8 h-8 mx-auto flex items-center justify-center mb-1">
                  <i className="ri-camera-line text-gray-400 dark:text-slate-500 text-xl" />
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra o haz clic para subir foto</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">JPG, PNG hasta 5MB</p>
                <input ref={fuelPhotoInputRef} type="file" accept="image/*" onChange={handleFuelPhotoSelect} className="hidden" />
              </div>
            )}
          </div>
          {fuelError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className="ri-error-warning-line" /></div>
              {fuelError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => { setShowNewFuel(false); setFuelError(''); clearFuelPhoto(); }} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 whitespace-nowrap">Cancelar</button>
            <button onClick={addFuelTicket} disabled={submittingFuel} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap">
              {submittingFuel ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
              ) : (
                <><div className="w-4 h-4 flex items-center justify-center"><i className="ri-check-line" /></div> Guardar Ticket</>
              )}
            </button>
          </div>
        </div>
      </Modal>
      {/* ── Modal: Nueva incidencia de producto ──────────────────────────── */}
      <Modal isOpen={showNewProduct} onClose={() => { setShowNewProduct(false); clearProductPhoto(); }} title="Nueva Incidencia de Producto" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Nombre del producto</label>
            <input type="text" placeholder="Ej: Caja de tomates cherry" value={newProduct.product_name}
              onChange={e => setNewProduct({ ...newProduct, product_name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Tipo de incidencia</label>
            <select value={newProduct.type} onChange={e => setNewProduct({ ...newProduct, type: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
              {productIncidentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Descripción</label>
            <textarea value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none resize-none"
              rows={3} placeholder="Describe el problema con el producto..." maxLength={500} />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Foto del producto</label>
            {productPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                <img src={productPhoto} alt="Preview" className="w-full h-32 object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{productPhotoName}</span>
                  <button type="button" onClick={clearProductPhoto} className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80">
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => productPhotoInputRef.current?.click()}
                onDrop={e => { e.preventDefault(); setIsDraggingProductPhoto(false); const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith('image/')) processProductPhoto(f); }}
                onDragOver={e => { e.preventDefault(); setIsDraggingProductPhoto(true); }}
                onDragLeave={e => { e.preventDefault(); setIsDraggingProductPhoto(false); }}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
                  ${isDraggingProductPhoto ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-500'}`}
              >
                <i className="ri-camera-line text-gray-400 dark:text-slate-500 text-2xl mb-1 block" />
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra o haz clic para subir foto</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">JPG, PNG hasta 5MB</p>
                <input ref={productPhotoInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) processProductPhoto(f); }} className="hidden" />
              </div>
            )}
          </div>
          {productError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <i className="ri-error-warning-line flex-shrink-0" /> {productError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => { setShowNewProduct(false); setProductError(''); clearProductPhoto(); }}
              className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 whitespace-nowrap">
              Cancelar
            </button>
            <button onClick={addProductIncident} disabled={submittingProduct}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2 whitespace-nowrap">
              {submittingProduct
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Registrando...</>
                : <><i className="ri-check-line" /> Registrar</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Detalle de incidencia de producto ──────────────────────── */}
      <Modal isOpen={showProductDetail && !!selectedProduct} onClose={() => { setShowProductDetail(false); setSelectedProduct(null); }} title="Detalle de Incidencia de Producto" size="lg">
        {selectedProduct && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Producto</span>
              <span className="font-semibold text-gray-800 dark:text-slate-100">{selectedProduct.product_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Tipo</span>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">
                {productIncidentTypes.find(t => t.value === selectedProduct.type)?.label || selectedProduct.type}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Estado</span>
              {isEmpresa || isEmpleado ? (
                <select value={selectedProduct.status} onChange={e => updateProductStatus(selectedProduct.id, e.target.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border outline-none cursor-pointer transition-all
                    ${selectedProduct.status === 'abierta' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : ''}
                    ${selectedProduct.status === 'en_proceso' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' : ''}
                    ${selectedProduct.status === 'resuelta' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : ''}`}>
                  <option value="abierta">Abierta</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="resuelta">Resuelta</option>
                </select>
              ) : (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[selectedProduct.status]?.color || 'bg-gray-50 text-gray-600'}`}>
                  {statusConfig[selectedProduct.status]?.label || selectedProduct.status}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-slate-400">Fecha</span>
              <span className="text-sm text-gray-700 dark:text-slate-200">{selectedProduct.date}</span>
            </div>
            {selectedProduct.reported_by && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-slate-400">Reportado por</span>
                <span className="text-sm text-gray-700 dark:text-slate-200">{selectedProduct.reported_by}</span>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-slate-400 block mb-1">Descripción</span>
              <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 rounded-lg p-3 border border-gray-100 dark:border-slate-700">{selectedProduct.description}</p>
            </div>
            {selectedProduct.photo && (
              <div>
                <span className="text-sm text-gray-500 dark:text-slate-400 block mb-2">Foto del producto</span>
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                  <ImageWithFallback src={selectedProduct.photo} alt="Foto producto" className="w-full h-48 object-cover"
                    fallbackText={selectedProduct.product_name?.charAt(0) || 'P'} fallbackSize="lg" />
                </div>
                <button onClick={() => window.open(selectedProduct.photo, '_blank')} className="mt-2 text-xs text-orange-600 hover:underline flex items-center gap-1.5">
                  <i className="ri-external-link-line" /> Abrir en nueva pestaña
                </button>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => { setShowProductDetail(false); setSelectedProduct(null); }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 whitespace-nowrap">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ChatWidget />
    </div>
  );
}