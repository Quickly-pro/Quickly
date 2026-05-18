import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useProfile } from '@/hooks/useProfile';

interface Employee {
  id: number;
  name: string;
  role: string;
  avatar_url?: string;
  hours_this_month: number;
}

interface Shift {
  id: number;
  employee_id: number;
  week_start_date: string;
  day_index: number;
  shift_type: string;
  hours: number;
}

interface SwapRequest {
  id: number;
  requester_employee_id: number;
  requester_day_index: number;
  requester_shift_type: string;
  target_employee_id: number;
  target_day_index: number;
  target_shift_type: string;
  week_start_date: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  requester_name?: string;
  target_name?: string;
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FULL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const shiftLabels: Record<string, string> = {
  morning: 'M',
  evening: 'T',
  night: 'N',
  free: 'Día libre',
  '': '',
};

const shiftColors: Record<string, string> = {
  morning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  evening: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  night: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  free: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',
  '': 'bg-transparent',
};

const shiftBgHover: Record<string, string> = {
  morning: 'hover:bg-amber-200 dark:hover:bg-amber-900/50',
  evening: 'hover:bg-sky-200 dark:hover:bg-sky-900/50',
  night: 'hover:bg-rose-200 dark:hover:bg-rose-900/50',
  free: 'hover:bg-gray-200 dark:hover:bg-slate-600',
  '': 'hover:bg-gray-50 dark:hover:bg-slate-800',
};

const shiftCycle = ['', 'morning', 'evening', 'night', 'free'];

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getWeekDates(baseMonday: Date) {
  return Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(baseMonday);
    date.setDate(baseMonday.getDate() + i);
    return date;
  });
}

function getWeekLabel(monday: Date): string {
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const weekNum = Math.ceil(monday.getDate() / 7);
  return `Semana ${weekNum}: ${monthNames[monday.getMonth()]} ${monday.getFullYear()}`;
}

function shiftTypeToLabel(type: string): string {
  switch (type) {
    case 'morning': return 'Mañana';
    case 'evening': return 'Tarde';
    case 'night': return 'Noche';
    case 'free': return 'Día libre';
    default: return 'Sin asignar';
  }
}

export default function Cuadrante() {
  const { isEmpresa } = useRole();
  const { profile } = useProfile();
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [showColorCode, setShowColorCode] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendOk, setSendOk] = useState(false);

  // Swap modal states
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapFromEmployee, setSwapFromEmployee] = useState<Employee | null>(null);
  const [swapFromDayIndex, setSwapFromDayIndex] = useState<number>(0);
  const [swapFromShiftType, setSwapFromShiftType] = useState<string>('');
  const [swapToEmployeeId, setSwapToEmployeeId] = useState<number | ''>('');
  const [swapToDayIndex, setSwapToDayIndex] = useState<number>(0);
  const [swapSubmitting, setSwapSubmitting] = useState(false);

  // Pending swaps panel
  const [showPendingSwaps, setShowPendingSwaps] = useState(false);

  const baseMonday = useMemo(() => {
    const today = new Date();
    const monday = getMondayOfWeek(today);
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseMonday), [baseMonday]);
  const weekStartStr = useMemo(() => formatDateISO(baseMonday), [baseMonday]);
  const weekLabel = useMemo(() => getWeekLabel(baseMonday), [baseMonday]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load employees
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .order('name');
      if (empError) throw empError;
      setEmployees(empData || []);

      // Load shifts for this week
      const { data: shiftData, error: shiftError } = await supabase
        .from('shift_schedules')
        .select('*')
        .eq('week_start_date', weekStartStr);
      if (shiftError) throw shiftError;
      setShifts(shiftData || []);

      // Load swap requests for this week
      const { data: swapData, error: swapError } = await supabase
        .from('shift_swaps')
        .select('*')
        .eq('week_start_date', weekStartStr)
        .order('created_at', { ascending: false });
      if (swapError) throw swapError;

      // Enrich swap requests with names
      const enrichedSwaps = (swapData || []).map((swap: SwapRequest) => ({
        ...swap,
        requester_name: (empData || []).find((e: Employee) => e.id === swap.requester_employee_id)?.name || 'Desconocido',
        target_name: (empData || []).find((e: Employee) => e.id === swap.target_employee_id)?.name || 'Desconocido',
      }));
      setSwapRequests(enrichedSwaps);
    } catch (err) {
      console.error('Error loading cuadrante data:', err);
    } finally {
      setLoading(false);
    }
  }, [weekStartStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const displayedEmployees = useMemo(() => {
    if (isEmpresa) return employees;
    if (!profile.full_name) return [];
    const me = employees.find(e => e.name === profile.full_name);
    return me ? [me] : [];
  }, [employees, isEmpresa, profile.full_name]);

  const mySwaps = useMemo(() => {
    if (isEmpresa) return swapRequests;
    if (!profile.full_name || !displayedEmployees.length) return [];
    const myId = displayedEmployees[0]?.id;
    return swapRequests.filter(s => s.requester_employee_id === myId || s.target_employee_id === myId);
  }, [swapRequests, isEmpresa, profile.full_name, displayedEmployees]);

  const getShift = (employeeId: number, dayIndex: number): Shift | undefined =>
    shifts.find(s => s.employee_id === employeeId && s.day_index === dayIndex);

  const cycleShift = async (employeeId: number, dayIndex: number) => {
    const existing = getShift(employeeId, dayIndex);
    const currentType = existing?.shift_type || '';
    const nextIndex = (shiftCycle.indexOf(currentType) + 1) % shiftCycle.length;
    const nextType = shiftCycle[nextIndex];
    const hours = nextType === 'free' || nextType === '' ? 0 : 8;

    try {
      if (existing) {
        if (nextType === '') {
          await supabase.from('shift_schedules').delete().eq('id', existing.id);
        } else {
          await supabase.from('shift_schedules').update({ shift_type: nextType, hours }).eq('id', existing.id);
        }
      } else if (nextType !== '') {
        await supabase.from('shift_schedules').insert({
          employee_id: employeeId,
          week_start_date: weekStartStr,
          day_index: dayIndex,
          shift_type: nextType,
          hours,
        });
      }
      loadData();
    } catch (err) {
      console.error('Error updating shift:', err);
    }
  };

  const openSwapModal = (employee: Employee, dayIndex: number) => {
    const shift = getShift(employee.id, dayIndex);
    if (!shift || shift.shift_type === '') return;
    setSwapFromEmployee(employee);
    setSwapFromDayIndex(dayIndex);
    setSwapFromShiftType(shift.shift_type);
    setSwapToEmployeeId('');
    setSwapToDayIndex(0);
    setShowSwapModal(true);
  };

  const submitSwapRequest = async () => {
    if (!swapFromEmployee || swapToEmployeeId === '') return;
    setSwapSubmitting(true);

    try {
      const targetShift = getShift(Number(swapToEmployeeId), swapToDayIndex);
      const targetShiftType = targetShift?.shift_type || '';

      await supabase.from('shift_swaps').insert({
        requester_employee_id: swapFromEmployee.id,
        requester_day_index: swapFromDayIndex,
        requester_shift_type: swapFromShiftType,
        target_employee_id: Number(swapToEmployeeId),
        target_day_index: swapToDayIndex,
        target_shift_type: targetShiftType,
        week_start_date: weekStartStr,
        status: 'pending',
      });

      setShowSwapModal(false);
      loadData();
    } catch (err) {
      console.error('Error creating swap request:', err);
    } finally {
      setSwapSubmitting(false);
    }
  };

  const respondToSwap = async (swapId: number, accept: boolean) => {
    const swap = swapRequests.find(s => s.id === swapId);
    if (!swap) return;

    try {
      if (accept) {
        const reqShift = shifts.find(
          s => s.employee_id === swap.requester_employee_id && s.day_index === swap.requester_day_index
        );
        const tgtShift = shifts.find(
          s => s.employee_id === swap.target_employee_id && s.day_index === swap.target_day_index
        );

        if (reqShift) {
          const tgtHours = swap.target_shift_type === 'free' || swap.target_shift_type === '' ? 0 : 8;
          if (swap.target_shift_type === '') {
            await supabase.from('shift_schedules').delete().eq('id', reqShift.id);
          } else {
            await supabase.from('shift_schedules').update({
              shift_type: swap.target_shift_type,
              hours: tgtHours,
            }).eq('id', reqShift.id);
          }
        } else if (swap.target_shift_type !== '') {
          await supabase.from('shift_schedules').insert({
            employee_id: swap.requester_employee_id,
            week_start_date: weekStartStr,
            day_index: swap.requester_day_index,
            shift_type: swap.target_shift_type,
            hours: swap.target_shift_type === 'free' ? 0 : 8,
          });
        }

        if (tgtShift) {
          const reqHours = swap.requester_shift_type === 'free' || swap.requester_shift_type === '' ? 0 : 8;
          if (swap.requester_shift_type === '') {
            await supabase.from('shift_schedules').delete().eq('id', tgtShift.id);
          } else {
            await supabase.from('shift_schedules').update({
              shift_type: swap.requester_shift_type,
              hours: reqHours,
            }).eq('id', tgtShift.id);
          }
        } else if (swap.requester_shift_type !== '') {
          await supabase.from('shift_schedules').insert({
            employee_id: swap.target_employee_id,
            week_start_date: weekStartStr,
            day_index: swap.target_day_index,
            shift_type: swap.requester_shift_type,
            hours: swap.requester_shift_type === 'free' ? 0 : 8,
          });
        }
      }

      await supabase.from('shift_swaps').update({
        status: accept ? 'accepted' : 'rejected',
      }).eq('id', swapId);

      loadData();
    } catch (err) {
      console.error('Error responding to swap:', err);
    }
  };

  const handleSendCuadrante = () => {
    if (displayedEmployees.length === 0) return;
    const scheduleData = displayedEmployees.map(emp => ({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      days: Array.from({ length: 7 }).map((_, i) => {
        const shift = getShift(emp.id, i);
        return {
          day: FULL_DAYS[i],
          date: weekDates[i].getDate(),
          shift: shift?.shift_type || '',
          label: shiftLabels[shift?.shift_type || ''] || '—',
        };
      }),
      totalHours: weeklyHours(emp.id),
    }));
    const newEntry = {
      id: Date.now(),
      weekLabel,
      weekStartStr,
      sentAt: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      employees: scheduleData,
    };
    try {
      const existing = JSON.parse(localStorage.getItem('cuadrante-sent') || '[]');
      localStorage.setItem('cuadrante-sent', JSON.stringify([newEntry, ...existing].slice(0, 20)));
    } catch { /* ignore */ }
    setSendOk(true);
    setTimeout(() => setSendOk(false), 3500);
  };

  const addEmployee = async () => {
    if (!newEmployeeName.trim()) return;
    try {
      await supabase.from('employees').insert({
        name: newEmployeeName,
        role: newEmployeeRole || 'Empleado',
      });
      setNewEmployeeName('');
      setNewEmployeeRole('');
      setShowAddEmployee(false);
      loadData();
    } catch (err) {
      console.error('Error adding employee:', err);
    }
  };

  const removeEmployee = async (id: number) => {
    try {
      await supabase.from('employees').delete().eq('id', id);
      loadData();
    } catch (err) {
      console.error('Error removing employee:', err);
    }
  };

  const weeklyHours = (employeeId: number) => {
    return shifts
      .filter(s => s.employee_id === employeeId)
      .reduce((sum, s) => sum + (s.hours || 0), 0);
  };

  const pendingSwapsCount = mySwaps.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <i className="ri-calendar-check-line text-2xl text-gray-700 dark:text-slate-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Turnos</h1>
            {!isEmpresa && (
              <p className="text-sm text-gray-500 dark:text-slate-400">Tu horario semanal</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg bg-gray-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${viewMode === 'weekly' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
            >
              Semanal
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${viewMode === 'monthly' ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
            >
              Mensual
            </button>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-left-s-line" />
              </div>
            </button>
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
              {weekLabel}
            </span>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line" />
              </div>
            </button>
          </div>

          {/* Pending swaps button */}
          <button
            onClick={() => setShowPendingSwaps(!showPendingSwaps)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap
              ${pendingSwapsCount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}
            `}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-swap-line" />
            </div>
            Intercambios
            {pendingSwapsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingSwapsCount}
              </span>
            )}
          </button>

          {isEmpresa && (
            <button
              onClick={() => setShowAddEmployee(true)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line" />
              </div>
              Empleado
            </button>
          )}
        </div>
      </div>

      {/* Empleado solo: aviso si no está en la lista */}
      {!isEmpresa && !loading && displayedEmployees.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-center">
          <div className="w-10 h-10 mx-auto mb-2 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <i className="ri-user-search-line text-lg text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">No encontramos tu horario</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Contacta con la empresa para que te añadan al cuadrante.
          </p>
        </div>
      )}

      {/* Pending swaps panel */}
      {showPendingSwaps && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
              {isEmpresa ? 'Solicitudes de intercambio' : 'Mis intercambios'}
            </h3>
            <button onClick={() => setShowPendingSwaps(false)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600">
              <i className="ri-close-line" />
            </button>
          </div>
          {mySwaps.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">No hay solicitudes de intercambio para esta semana.</p>
          ) : (
            <div className="space-y-2">
              {mySwaps.map((swap) => (
                <div
                  key={swap.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all
                    ${swap.status === 'pending'
                      ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                      : swap.status === 'accepted'
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-slate-100">
                      <span className="font-semibold">{swap.requester_name}</span>{' '}
                      quiere intercambiar su{' '}
                      <span className="font-medium">{shiftTypeToLabel(swap.requester_shift_type)}</span>{' '}
                      del <span className="font-medium">{FULL_DAYS[swap.requester_day_index]}</span>{' '}
                      con <span className="font-semibold">{swap.target_name}</span>{' '}
                      ({swap.target_shift_type ? shiftTypeToLabel(swap.target_shift_type) : 'sin turno'} del{' '}
                      <span className="font-medium">{FULL_DAYS[swap.target_day_index]}</span>)
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Estado:{' '}
                      <span className={`font-medium ${
                        swap.status === 'pending' ? 'text-orange-600 dark:text-orange-400' :
                        swap.status === 'accepted' ? 'text-emerald-600 dark:text-emerald-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {swap.status === 'pending' ? 'Pendiente' : swap.status === 'accepted' ? 'Aceptado' : 'Rechazado'}
                      </span>
                    </p>
                  </div>
                  {swap.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => respondToSwap(swap.id, true)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => respondToSwap(swap.id, false)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Color code popup */}
      {showColorCode && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Código de color</h3>
            <button onClick={() => setShowColorCode(false)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600">
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/30" />
              <span className="text-xs text-gray-600 dark:text-slate-400">Mañana (M)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-sky-100 dark:bg-sky-900/30" />
              <span className="text-xs text-gray-600 dark:text-slate-400">Tarde (T)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-rose-100 dark:bg-rose-900/30" />
              <span className="text-xs text-gray-600 dark:text-slate-400">Noche (N)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-gray-100 dark:bg-slate-700" />
              <span className="text-xs text-gray-600 dark:text-slate-400">Día libre</span>
            </div>
          </div>
        </div>
      )}

      {/* Send cuadrante success toast */}
      {sendOk && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
          <div className="w-7 h-7 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex-shrink-0">
            <i className="ri-check-double-line text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold">Cuadrante enviado correctamente</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Cada empleado puede consultarlo en su sección <strong>Documentos → Mi cuadrante</strong>.</p>
          </div>
        </div>
      )}

      {/* Add employee modal */}
      {isEmpresa && showAddEmployee && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Añadir empleado</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nombre del empleado"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
            <input
              type="text"
              placeholder="Puesto (ej: Conductor)"
              value={newEmployeeRole}
              onChange={(e) => setNewEmployeeRole(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addEmployee}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
            >
              Añadir
            </button>
            <button
              onClick={() => { setShowAddEmployee(false); setNewEmployeeName(''); setNewEmployeeRole(''); }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Swap modal */}
      {showSwapModal && swapFromEmployee && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                Intercambiar turno
              </h3>
              <button
                onClick={() => setShowSwapModal(false)}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                <span className="font-semibold text-gray-800 dark:text-slate-100">{swapFromEmployee.name}</span>{' '}
                quiere intercambiar su{' '}
                <span className="font-medium">{shiftTypeToLabel(swapFromShiftType)}</span>{' '}
                del <span className="font-medium">{FULL_DAYS[swapFromDayIndex]} {weekDates[swapFromDayIndex].getDate()}</span>
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Compañero
                </label>
                <select
                  value={swapToEmployeeId}
                  onChange={(e) => setSwapToEmployeeId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                >
                  <option value="">Selecciona un compañero</option>
                  {employees
                    .filter(e => e.id !== swapFromEmployee.id)
                    .map(e => (
                      <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Día a intercambiar
                </label>
                <select
                  value={swapToDayIndex}
                  onChange={(e) => setSwapToDayIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
                >
                  {DAYS.map((day, i) => (
                    <option key={i} value={i}>
                      {FULL_DAYS[i]} {weekDates[i].getDate()} — {shiftTypeToLabel(getShift(Number(swapToEmployeeId) || 0, i)?.shift_type || '')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={submitSwapRequest}
                disabled={swapToEmployeeId === '' || swapSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {swapSubmitting ? 'Enviando...' : 'Solicitar intercambio'}
              </button>
              <button
                onClick={() => setShowSwapModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly view placeholder */}
      {viewMode === 'monthly' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <i className="ri-calendar-2-line text-2xl text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">Vista mensual</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">La vista mensual del cuadrante está disponible próximamente.</p>
          <button
            onClick={() => setViewMode('weekly')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all"
          >
            Volver a vista semanal
          </button>
        </div>
      )}

      {/* Schedule grid */}
      {viewMode === 'weekly' && <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
            <div className="w-6 h-6 mx-auto mb-2 animate-spin border-2 border-gray-300 border-t-blue-500 rounded-full" />
            Cargando turnos...
          </div>
        ) : displayedEmployees.length === 0 ? (
          isEmpresa ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
              No hay empleados. Añade uno para empezar.
            </div>
          ) : null
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Days header */}
              <div className="flex border-b border-gray-200 dark:border-slate-700">
                <div className="w-52 h-12 bg-gray-50 dark:bg-slate-800/50 border-r border-gray-200 dark:border-slate-700 flex items-center px-4 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    {isEmpresa ? 'Empleado' : 'Tus datos'}
                  </span>
                </div>
                {DAYS.map((day, i) => (
                  <div key={day} className="w-28 h-12 border-r border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">{FULL_DAYS[i]}</span>
                    <span className={`text-sm font-bold ${i === 4 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-slate-200'}`}>
                      {weekDates[i].getDate()}
                    </span>
                  </div>
                ))}
                <div className="w-24 h-12 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400">Total</span>
                </div>
                {isEmpresa && (
                  <div className="w-48 h-12 flex items-center px-3 flex-shrink-0">
                    <button
                      onClick={handleSendCuadrante}
                      disabled={displayedEmployees.length === 0}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                    >
                      <i className="ri-send-plane-line text-xs" />
                      Enviar cuadrante
                    </button>
                  </div>
                )}
              </div>

              {/* Employee rows */}
              {displayedEmployees.map((emp) => (
                <div key={emp.id} className="flex border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Employee info */}
                  <div className="w-52 h-14 border-r border-gray-200 dark:border-slate-700 flex items-center gap-3 px-4 flex-shrink-0">
                    {emp.avatar_url ? (
                      <img src={emp.avatar_url} alt={emp.name || ''} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {(emp.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{emp.name || 'Sin nombre'}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{emp.role || ''}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">{weeklyHours(emp.id)}h / 40h</p>
                    </div>
                    {isEmpresa && (
                      <button
                        onClick={() => removeEmployee(emp.id)}
                        className="ml-auto w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Eliminar empleado"
                      >
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    )}
                  </div>

                  {/* Day cells */}
                  {DAYS.map((_, dayIdx) => {
                    const shift = getShift(emp.id, dayIdx);
                    const type = shift?.shift_type || '';
                    return (
                      <div
                        key={dayIdx}
                        className={`w-28 h-14 border-r border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center transition-all flex-shrink-0 group relative
                          ${shiftColors[type]}`}
                      >
                        {/* Click to change shift */}
                        {isEmpresa && (
                          <button
                            onClick={() => cycleShift(emp.id, dayIdx)}
                            className={`absolute inset-0 w-full h-full cursor-pointer transition-all ${shiftBgHover[type] || ''}`}
                            title="Cambiar turno"
                          />
                        )}

                        {/* Shift content */}
                        <div className="relative z-10 flex flex-col items-center">
                          {type === '' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center">
                              <i className="ri-add-line text-xs text-gray-400" />
                            </div>
                          ) : type === 'free' ? (
                            <span className="text-xs font-medium">{shiftLabels[type]}</span>
                          ) : (
                            <span className="text-sm font-bold">{shiftLabels[type]}</span>
                          )}
                        </div>

                        {/* Swap button - appears on hover if there's a shift */}
                        {type !== '' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openSwapModal(emp, dayIdx);
                            }}
                            className="absolute z-20 bottom-0.5 right-0.5 w-5 h-5 rounded bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Intercambiar turno"
                          >
                            <i className="ri-swap-line text-[10px] text-gray-600 dark:text-slate-300" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Total hours */}
                  <div className="w-24 h-14 flex items-center justify-center flex-shrink-0">
                    <span className={`text-sm font-bold ${weeklyHours(emp.id) > 40 ? 'text-red-500' : 'text-gray-700 dark:text-slate-200'}`}>
                      {weeklyHours(emp.id)}h
                    </span>
                  </div>
                  {isEmpresa && <div className="w-48 h-14 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>}

      {/* Footer */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowColorCode(!showColorCode)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-all"
        >
          Ver código de color
        </button>
      </div>

      <div className="text-xs text-gray-500 dark:text-slate-400">
        {isEmpresa
          ? `Mostrando ${displayedEmployees.length} empleados — Haz clic en cualquier celda para cambiar el turno.`
          : 'Tu horario semanal. Pasa el ratón sobre un turno para solicitar un intercambio.'}
      </div>
    </div>
  );
}
