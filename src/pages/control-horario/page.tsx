import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useRole } from '@/hooks/useRole';
import Modal from '@/components/base/Modal';

interface TimeEntry {
  id: number;
  employee: string;
  date: string;
  check_in: string;
  check_out: string | null;
  total_hours: number | null;
  created_at: string;
}

export default function ControlHorario() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ employee: '', date: '', check_in: '', check_out: '' });
  const [submitting, setSubmitting] = useState(false);
  const { isEmpresa } = useRole();
  const modalRef = useRef<HTMLDivElement>(null);
  useClickOutside(modalRef, () => setModalOpen(false), modalOpen);

  const fetchData = async () => {
    setLoading(true);
    const [eRes, empRes] = await Promise.all([
      supabase.from('time_tracking').select('*').order('date', { ascending: false }).limit(50),
      supabase.from('employees').select('name').order('name'),
    ]);
    setEntries(eRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = entries.filter((e) => {
    const matchSearch = !search || e.employee?.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || e.date === dateFilter;
    return matchSearch && matchDate;
  });

  const totalToday = entries
    .filter((e) => e.date === new Date().toISOString().split('T')[0])
    .reduce((s, e) => s + (e.total_hours || 0), 0);

  const activeNow = entries.filter((e) => e.date === new Date().toISOString().split('T')[0] && e.check_in && !e.check_out).length;

  const handleCreate = async () => {
    if (!form.employee || !form.date || !form.check_in) return;
    setSubmitting(true);
    const checkIn = new Date(`${form.date}T${form.check_in}`);
    const total = form.check_out
      ? (new Date(`${form.date}T${form.check_out}`).getTime() - checkIn.getTime()) / 3600000
      : null;

    await supabase.from('time_tracking').insert({
      employee: form.employee,
      date: form.date,
      check_in: form.check_in,
      check_out: form.check_out || null,
      total_hours: total,
    });
    setSubmitting(false);
    setModalOpen(false);
    setForm({ employee: '', date: '', check_in: '', check_out: '' });
    fetchData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Control Horario</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Registro de fichajes de empleados</p>
        </div>
        {isEmpresa && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all whitespace-nowrap"
          >
            <i className="ri-add-line" />
            Registrar fichaje
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Fichajes Hoy</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">{entries.filter((e) => e.date === new Date().toISOString().split('T')[0]).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">En Turno Ahora</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{activeNow}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Horas Hoy</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">{totalToday.toFixed(1)}h</p>
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
            placeholder="Buscar empleado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-gray-700 dark:text-slate-200 outline-none w-full"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none"
        />
        {(search || dateFilter) && (
          <button
            onClick={() => { setSearch(''); setDateFilter(''); }}
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
            <p className="text-sm text-gray-500 dark:text-slate-400">Cargando fichajes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-time-line text-gray-400 text-xl" />
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">No hay fichajes registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Empleado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Entrada</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Salida</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Horas</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium">{entry.employee || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{entry.date || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{entry.check_in || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{entry.check_out || <span className="text-orange-500 text-xs">Sin salida</span>}</td>
                    <td className="px-4 py-3 text-gray-800 dark:text-slate-100 font-medium">
                      {entry.total_hours !== null ? `${entry.total_hours.toFixed(1)}h` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {!entry.check_out ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-medium">
                          Completado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen && isEmpresa}
        onClose={() => setModalOpen(false)}
        title="Registrar Fichaje"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Empleado</label>
            <select
              value={form.employee}
              onChange={(e) => setForm({ ...form, employee: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            >
              <option value="">Seleccionar...</option>
              {employees.map((emp) => (
                <option key={emp.name} value={emp.name}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Entrada</label>
              <input
                type="time"
                value={form.check_in}
                onChange={(e) => setForm({ ...form, check_in: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Salida</label>
              <input
                type="time"
                value={form.check_out}
                onChange={(e) => setForm({ ...form, check_out: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => setModalOpen(false)}
            className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!form.employee || !form.date || !form.check_in || submitting}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all disabled:opacity-50"
          >
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
