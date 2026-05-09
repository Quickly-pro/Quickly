import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useClickOutside } from '@/hooks/useClickOutside';
import PremiumGate from '@/components/feature/PremiumGate';
import ImageWithFallback from '@/components/base/ImageWithFallback';

interface FuelTicket {
  id: number;
  vehicle: string | null;
  employee: string | null;
  date: string | null;
  time: string | null;
  liters: number | null;
  cost: number | null;
  station: string | null;
  invoice_photo: string | null;
  created_at: string;
}

export default function Combustible() {
  const [tickets, setTickets] = useState<FuelTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle: '', employee: '', date: '', time: '', liters: '', cost: '', station: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useClickOutside(modalRef, () => { setModalOpen(false); clearPhoto(); }, modalOpen);

  // Photo upload state for fuel ticket
  const [fuelPhoto, setFuelPhoto] = useState<string | null>(null);
  const [fuelPhotoName, setFuelPhotoName] = useState('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const fuelPhotoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('fuel_tickets').select('*').order('date', { ascending: false }).limit(50);
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPhoto(file);
  };

  const processPhoto = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }
    setFuelPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFuelPhoto(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processPhoto(file);
  };

  const clearPhoto = () => {
    setFuelPhoto(null);
    setFuelPhotoName('');
    if (fuelPhotoInputRef.current) fuelPhotoInputRef.current.value = '';
  };

  const filtered = tickets.filter((t) => {
    const matchSearch = !search ||
      t.vehicle?.toLowerCase().includes(search.toLowerCase()) ||
      t.employee?.toLowerCase().includes(search.toLowerCase()) ||
      t.station?.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !dateFrom || (t.date && t.date >= dateFrom);
    const matchTo = !dateTo || (t.date && t.date <= dateTo);
    return matchSearch && matchFrom && matchTo;
  });

  const totalLiters = filtered.reduce((s, t) => s + Number(t.liters || 0), 0);
  const totalCost = filtered.reduce((s, t) => s + Number(t.cost || 0), 0);
  const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

  const handleCreate = async () => {
    if (!form.date || !form.liters) return;
    setSubmitting(true);
    await supabase.from('fuel_tickets').insert({
      vehicle: form.vehicle || null,
      employee: form.employee || null,
      date: form.date,
      time: form.time || null,
      liters: Number(form.liters),
      cost: form.cost ? Number(form.cost) : null,
      station: form.station || null,
      invoice_photo: fuelPhoto || null,
    });
    setSubmitting(false);
    setModalOpen(false);
    setForm({ vehicle: '', employee: '', date: '', time: '', liters: '', cost: '', station: '' });
    clearPhoto();
    fetchData();
  };

  return (
    <PremiumGate>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Combustible</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Registro de repostajes y consumo</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all whitespace-nowrap"
          >
            <i className="ri-add-line" />
            Nuevo repostaje
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Total Litros</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">{totalLiters.toFixed(1)}L</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Gasto Total</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">€{totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Precio Medio</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">€{avgPrice.toFixed(3)}/L</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Repostajes</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">{filtered.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
            <div className="w-4 h-4 flex items-center justify-center mr-2">
              <i className="ri-search-line text-gray-400 text-sm" />
            </div>
            <input
              type="text"
              placeholder="Buscar vehículo, empleado o estación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-gray-700 dark:text-slate-200 outline-none w-full"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none"
            />
          </div>
          {(search || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-slate-400">Cargando repostajes...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-gas-station-line text-gray-400 text-xl" />
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">No hay repostajes registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Vehículo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Conductor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Estación</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Litros</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Coste</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">€/L</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium whitespace-nowrap">{t.date || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{t.vehicle || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{t.employee || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{t.station || '—'}</td>
                      <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium">{t.liters !== null ? `${t.liters}L` : '—'}</td>
                      <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium">{t.cost !== null ? `€${Number(t.cost).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                        {t.liters && t.cost ? `€${(Number(t.cost) / Number(t.liters)).toFixed(3)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {t.invoice_photo ? (
                          <button
                            onClick={() => window.open(t.invoice_photo!, '_blank')}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100"
                          >
                            <i className="ri-image-line" />
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal with photo upload */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div ref={modalRef} className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 dark:text-slate-100">Nuevo Repostaje</h3>
                <button onClick={() => { setModalOpen(false); clearPhoto(); }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600">
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Vehículo</label>
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
                      value={form.employee}
                      onChange={(e) => setForm({ ...form, employee: e.target.value })}
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
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Hora</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Litros *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.liters}
                      onChange={(e) => setForm({ ...form, liters: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Coste (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.cost}
                      onChange={(e) => setForm({ ...form, cost: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Estación</label>
                  <input
                    type="text"
                    value={form.station}
                    onChange={(e) => setForm({ ...form, station: e.target.value })}
                    placeholder="Nombre de la gasolinera"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                  />
                </div>

                {/* Photo upload */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Foto del ticket / factura</label>
                  {fuelPhoto ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                      <ImageWithFallback
                        src={fuelPhoto}
                        alt="Preview"
                        className="w-full h-32 object-cover"
                        fallbackText="T"
                        fallbackSize="md"
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{fuelPhotoName}</span>
                        <button
                          type="button"
                          onClick={clearPhoto}
                          className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80"
                        >
                          <i className="ri-close-line text-sm" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fuelPhotoInputRef.current?.click()}
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
                      <input
                        ref={fuelPhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
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
                  disabled={!form.date || !form.liters || submitting}
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