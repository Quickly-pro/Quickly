import { useState, useEffect, useCallback, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import Modal from '@/components/base/Modal';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useProfile } from '@/hooks/useProfile';

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  reparto: { label: 'Reparto', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: 'ri-truck-line' },
  comercial: { label: 'Comercial', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: 'ri-briefcase-line' },
  mantenimiento: { label: 'Mantenimiento', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: 'ri-tools-line' },
  mantenimiento_vehiculo: { label: 'Mant. Vehículo', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: 'ri-car-washing-line' },
  festivo: { label: 'Festivo', color: 'bg-red-50 text-red-600 border-red-200', icon: 'ri-calendar-event-line' },
};

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const weekDaysFull = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const hoursRange = Array.from({ length: 17 }, (_, i) => 6 + i); // 06:00 to 22:00

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day; // shift so Monday is first
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEventHour(time: string): number {
  if (!time) return -1;
  return parseInt(time.split(':')[0], 10);
}

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [events, setEvents] = useState<any[]>([]);
  const [maintenanceEvents, setMaintenanceEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', type: 'reparto', time: '', description: '' });
  const [draggingEventId, setDraggingEventId] = useState<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const newEventRef = useRef<HTMLDivElement>(null);
  useClickOutside(newEventRef, () => setShowNewEvent(false), showNewEvent);

  const { isEmpresa } = useRole();
  const { addNotification } = useNotificationsContext();
  const { profile } = useProfile();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  // Week view data
  const weekStart = getWeekStart(currentDate);
  const weekDaysArr = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let start: string;
    let end: string;
    if (viewMode === 'month') {
      start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      end = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    } else if (viewMode === 'week') {
      start = formatDateISO(weekStart);
      end = formatDateISO(addDays(weekStart, 6));
    } else {
      start = formatDateISO(currentDate);
      end = formatDateISO(currentDate);
    }

    const [eventsRes, maintRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date')
        .order('time'),
      supabase
        .from('vehicle_maintenance')
        .select('*')
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .order('scheduled_date')
    ]);

    const calEvents = eventsRes.data || [];
    const maintEvents = (maintRes.data || []).map((m: any) => ({
      id: `maint-${m.id}`,
      title: `${m.vehicle_name} — ${m.description || m.maintenance_type}`,
      date: m.scheduled_date,
      type: 'mantenimiento_vehiculo',
      time: '09:00',
      description: `Tipo: ${m.maintenance_type} · Estado: ${m.status} · Coste: €${Number(m.cost_estimate).toFixed(2)}${m.mechanic ? ' · Taller: ' + m.mechanic : ''}`,
      _source: 'maintenance',
      _raw: m,
    }));

    if (!eventsRes.error) setEvents([...calEvents, ...maintEvents]);
    if (!maintRes.error) setMaintenanceEvents(maintEvents);
    setLoading(false);
  }, [year, month, daysInMonth, viewMode, weekStart, currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-notify upcoming maintenance
  const notifiedMaintenanceRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!maintenanceEvents.length) return;
    maintenanceEvents.forEach((evt) => {
      if (notifiedMaintenanceRef.current.has(String(evt.id))) return;
      const raw = evt._raw;
      if (!raw || raw.status === 'completado') return;
      const days = Math.ceil((new Date(raw.scheduled_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 3) {
        addNotification(
          `Mantenimiento próximo: ${raw.vehicle_name}`,
          `${raw.description || raw.maintenance_type} el ${new Date(raw.scheduled_date + 'T00:00:00').toLocaleDateString('es-ES')}`,
          'maintenance'
        );
        notifiedMaintenanceRef.current.add(String(evt.id));
      }
    });
  }, [maintenanceEvents, addNotification]);

  const getEventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr);

  const addEvent = async () => {
    if (!newEvent.title || !selectedDate) return;
    const { error } = await supabase.from('calendar_events').insert([{
      ...newEvent,
      date: selectedDate,
    }]);
    if (!error) {
      setShowNewEvent(false);
      setNewEvent({ title: '', type: 'reparto', time: '', description: '' });
      fetchEvents();
    }
  };

  const moveEventToDate = async (eventId: number | string, newDate: string) => {
    if (typeof eventId === 'string' && String(eventId).startsWith('maint-')) {
      // Maintenance events are read-only in calendar
      return;
    }
    const { error } = await supabase.from('calendar_events').update({ date: newDate }).eq('id', eventId);
    if (!error) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, date: newDate } : e));
    }
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const prevDay = () => setCurrentDate(addDays(currentDate, -1));
  const nextDay = () => setCurrentDate(addDays(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  const weekRangeLabel = `${weekDaysArr[0].getDate()} ${monthNames[weekDaysArr[0].getMonth()]} – ${weekDaysArr[6].getDate()} ${monthNames[weekDaysArr[6].getMonth()]} ${year}`;
  const dayLabel = `${weekDaysFull[new Date(currentDate).getDay() === 0 ? 6 : new Date(currentDate).getDay() - 1]} ${currentDate.getDate()} de ${monthNames[month]} ${year}`;

  // For day view
  const currentDateStr = formatDateISO(currentDate);
  const currentDayEvents = getEventsForDate(currentDateStr);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Calendario</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {events.length} eventos este {viewMode === 'month' ? 'mes' : viewMode === 'week' ? 'periodo' : 'dia'}{loading && ' (cargando...)'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              Mes
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              Dia
            </button>
          </div>

          <button
            onClick={viewMode === 'month' ? prevMonth : viewMode === 'week' ? prevWeek : prevDay}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400"
          >
            <i className="ri-arrow-left-s-line" />
          </button>
          <span className="text-lg font-semibold text-gray-800 dark:text-slate-100 min-w-[180px] text-center">
            {viewMode === 'month' ? `${monthNames[month]} ${year}` : viewMode === 'week' ? weekRangeLabel : dayLabel}
          </span>
          <button
            onClick={viewMode === 'month' ? nextMonth : viewMode === 'week' ? nextWeek : nextDay}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400"
          >
            <i className="ri-arrow-right-s-line" />
          </button>
          <button
            onClick={today}
            className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 ml-2 whitespace-nowrap"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Calendar Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(typeConfig).map(([key, cfg]) => (
          <div key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${cfg.color}`}>
            <i className={cfg.icon} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          {/* Week headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700">
            {weekDays.map((day) => (
              <div key={day} className="py-2 md:py-3 text-center text-xs md:text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {Array.from({ length: startDay }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[70px] md:min-h-[110px] border-b border-r border-gray-50 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/50" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
              const dayNum = dayIdx + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEvents = getEventsForDate(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDate(dateStr);
                  }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const evtId = Number(e.dataTransfer.getData('text/plain'));
                    if (evtId && dragOverDate) {
                      moveEventToDate(evtId, dragOverDate);
                    }
                    setDragOverDate(null);
                    setDraggingEventId(null);
                  }}
                  className={`min-h-[70px] md:min-h-[110px] border-b border-r border-gray-100 dark:border-slate-800 p-1 md:p-2 cursor-pointer transition-all
                    ${isSelected ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}
                    ${dragOverDate === dateStr ? 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-300 ring-inset' : ''}
                    ${!isSelected && dragOverDate !== dateStr ? 'hover:bg-gray-50 dark:hover:bg-slate-800/50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-0.5 md:mb-1">
                    <span className={`text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-orange-500 text-white' : 'text-gray-700 dark:text-slate-200'}`}>
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] md:text-xs text-gray-400 dark:text-slate-500">{dayEvents.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    {dayEvents.slice(0, 2).map((evt) => {
                      const cfg = typeConfig[evt.type] || typeConfig.reparto;
                      return (
                        <div
                          key={evt.id}
                          draggable={isEmpresa}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(evt.id));
                            setDraggingEventId(evt.id);
                          }}
                          onDragEnd={() => {
                            setDraggingEventId(null);
                            setDragOverDate(null);
                          }}
                          className={`text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 rounded border truncate cursor-move ${cfg.color} ${draggingEventId === evt.id ? 'opacity-40' : ''}`}
                          title={`${evt.title} - ${evt.time || 'Sin hora'}`}
                        >
                          <span className="hidden sm:inline">{evt.time && <span className="mr-1 opacity-70">{evt.time}</span>}</span>
                          {evt.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] md:text-xs text-gray-400 dark:text-slate-500 text-center">+{dayEvents.length - 2} mas</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700">
            {weekDaysArr.map((d, idx) => {
              const dateStr = formatDateISO(d);
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={idx}
                  className={`py-3 text-center border-r last:border-r-0 border-gray-100 dark:border-slate-800 ${isToday ? 'bg-orange-50/40 dark:bg-orange-900/10' : 'bg-gray-50 dark:bg-slate-800'}`}
                >
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{weekDaysFull[idx]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-slate-200'}`}>
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Week body */}
          <div className="grid grid-cols-7 min-h-[360px] md:min-h-[480px]">
            {weekDaysArr.map((d, idx) => {
              const dateStr = formatDateISO(d);
              const dayEvents = getEventsForDate(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDate(dateStr);
                  }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const evtId = Number(e.dataTransfer.getData('text/plain'));
                    if (evtId && dragOverDate) {
                      moveEventToDate(evtId, dragOverDate);
                    }
                    setDragOverDate(null);
                    setDraggingEventId(null);
                  }}
                  className={`border-r last:border-r-0 border-gray-100 dark:border-slate-800 p-2 md:p-3 transition-all cursor-pointer
                    ${isToday ? 'bg-orange-50/20 dark:bg-orange-900/5' : ''}
                    ${dragOverDate === dateStr ? 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-300 ring-inset' : ''}
                    ${!isToday && dragOverDate !== dateStr ? 'hover:bg-gray-50 dark:hover:bg-slate-800/40' : ''}`}
                >
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-gray-300 dark:text-slate-600 text-center mt-4">Sin eventos</p>
                  ) : (
                    <div className="space-y-2">
                      {dayEvents.map((evt) => {
                        const cfg = typeConfig[evt.type] || typeConfig.reparto;
                        return (
                          <div
                            key={evt.id}
                            draggable={isEmpresa}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(evt.id));
                              setDraggingEventId(evt.id);
                            }}
                            onDragEnd={() => {
                              setDraggingEventId(null);
                              setDragOverDate(null);
                            }}
                            className={`px-2 py-1.5 rounded-lg border text-xs cursor-move transition-all ${cfg.color} ${draggingEventId === evt.id ? 'opacity-40' : ''}`}
                            title={`${evt.title} - ${evt.time || 'Sin hora'}`}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <i className={cfg.icon} />
                              <span className="font-medium truncate">{evt.title}</span>
                            </div>
                            {evt.time && (
                              <p className="text-[10px] opacity-70">{evt.time}</p>
                            )}
                            {evt.description && (
                              <p className="text-[10px] opacity-60 truncate">{evt.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW — TIMELINE */}
      {viewMode === 'day' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          {/* Day header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${currentDateStr === todayStr ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200'}`}>
                <span className="text-[10px] uppercase font-semibold">{monthNames[currentDate.getMonth()].slice(0, 3)}</span>
                <span className="text-xl font-bold leading-none">{currentDate.getDate()}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-slate-100 text-sm">
                  {weekDaysFull[new Date(currentDate).getDay() === 0 ? 6 : new Date(currentDate).getDay() - 1]} {currentDate.getDate()} de {monthNames[month]} {year}
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {currentDayEvents.length} evento{currentDayEvents.length !== 1 ? 's' : ''} programado
                </p>
              </div>
            </div>
            {isEmpresa && (
              <button
                onClick={() => { setSelectedDate(currentDateStr); setShowNewEvent(true); }}
                className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5 whitespace-nowrap"
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-add-line" /></div>
                Nuevo evento
              </button>
            )}
          </div>

          {/* Timeline */}
          <div className="overflow-y-auto max-h-[640px]">
            <div className="flex">
              {/* Hour labels column */}
              <div className="flex-shrink-0 w-16 border-r border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                {hoursRange.map((hour) => (
                  <div key={hour} className="h-16 border-b border-gray-100 dark:border-slate-800 flex items-start justify-center pt-2">
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">{String(hour).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Events area */}
              <div className="flex-1 relative">
                {/* Hour rows */}
                {hoursRange.map((hour) => {
                  const hourEvents = currentDayEvents.filter(e => getEventHour(e.time) === hour);
                  return (
                    <div
                      key={hour}
                      className="h-16 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverDate(currentDateStr);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const evtId = Number(e.dataTransfer.getData('text/plain'));
                        if (evtId) {
                          moveEventToDate(evtId, currentDateStr);
                        }
                        setDragOverDate(null);
                        setDraggingEventId(null);
                      }}
                    >
                      {hourEvents.length > 0 && (
                        <div className="p-1 md:p-2 space-y-1">
                          {hourEvents.map((evt) => {
                            const cfg = typeConfig[evt.type] || typeConfig.reparto;
                            return (
                              <div
                                key={evt.id}
                                draggable={isEmpresa}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', String(evt.id));
                                  setDraggingEventId(evt.id);
                                }}
                                onDragEnd={() => {
                                  setDraggingEventId(null);
                                  setDragOverDate(null);
                                }}
                                className={`px-2 md:px-3 py-1.5 rounded-lg border text-xs cursor-move transition-all ${cfg.color} ${draggingEventId === evt.id ? 'opacity-40' : ''}`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <i className={cfg.icon} />
                                  <span className="font-medium truncate">{evt.title}</span>
                                  {evt.time && (
                                    <span className="text-[10px] opacity-70 ml-auto flex-shrink-0">{evt.time}</span>
                                  )}
                                </div>
                                {evt.description && (
                                  <p className="text-[10px] opacity-60 truncate mt-0.5 pl-5">{evt.description}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Date Events */}
      {selectedDate && viewMode !== 'day' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100">
              Eventos del {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
            </h3>
            {isEmpresa && (
              <button
                onClick={() => setShowNewEvent(true)}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5 whitespace-nowrap"
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className="ri-add-line" />
                </div>
                Anadir evento
              </button>
            )}
          </div>

          {getEventsForDate(selectedDate).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500">No hay eventos programados para esta fecha.</p>
          ) : (
            <div className="space-y-3">
              {getEventsForDate(selectedDate).map((evt) => {
                const cfg = typeConfig[evt.type] || typeConfig.reparto;
                return (
                  <div key={evt.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <i className={cfg.icon} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-800 dark:text-slate-100">{evt.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {evt.time && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{evt.time}</p>}
                      {evt.description && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{evt.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Drag hint */}
      {isEmpresa && viewMode !== 'day' && (
        <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
          <i className="ri-drag-move-line" />
          Arrastra los eventos entre dias para reprogramarlos
        </p>
      )}
      {isEmpresa && viewMode === 'day' && (
        <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
          <i className="ri-drag-move-line" />
          Arrastra los eventos a otra fecha en las vistas de mes o semana para reprogramarlos
        </p>
      )}

      {/* New Event Modal */}
      <Modal
        isOpen={showNewEvent && !!selectedDate}
        onClose={() => setShowNewEvent(false)}
        title="Nuevo Evento"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Titulo</label>
            <input type="text" placeholder="Ej: Ruta Centro..." value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Tipo</label>
              <select value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300">
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Hora</label>
              <input type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Descripcion</label>
            <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300 resize-none" rows={2} placeholder="Detalles del evento..." maxLength={500} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowNewEvent(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={addEvent} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Guardar Evento</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}