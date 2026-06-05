import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import Modal from '@/components/base/Modal';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useAuth } from '@/context/AuthContext';

// Solid vibrant colors for event chips (Google Calendar style)
const typeConfig: Record<string, { label: string; bg: string; text: string; dot: string; icon: string }> = {
  reparto:              { label: 'Reparto',        bg: 'bg-orange-500',  text: 'text-white', dot: 'bg-orange-500',  icon: 'ri-truck-line' },
  comercial:            { label: 'Comercial',      bg: 'bg-blue-500',    text: 'text-white', dot: 'bg-blue-500',    icon: 'ri-briefcase-line' },
  mantenimiento:        { label: 'Mantenimiento',  bg: 'bg-amber-500',   text: 'text-white', dot: 'bg-amber-500',   icon: 'ri-tools-line' },
  mantenimiento_vehiculo: { label: 'Mant. Vehículo', bg: 'bg-purple-500', text: 'text-white', dot: 'bg-purple-500', icon: 'ri-car-washing-line' },
  festivo:              { label: 'Festivo',        bg: 'bg-rose-500',    text: 'text-white', dot: 'bg-rose-500',    icon: 'ri-calendar-event-line' },
};

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const weekDaysFull = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const hoursRange = Array.from({ length: 17 }, (_, i) => 6 + i);

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
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

// Single event chip used in month + week views
function EventChip({
  evt,
  compact = false,
  draggable: draggableFlag = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  evt: any;
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const cfg = typeConfig[evt.type] || typeConfig.reparto;
  return (
    <div
      draggable={draggableFlag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      title={`${evt.title}${evt.time ? ' · ' + evt.time : ''}`}
      className={`
        ${cfg.bg} ${cfg.text} rounded-md w-full
        ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
        ${draggableFlag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${isDragging ? 'opacity-40 scale-95' : 'hover:brightness-110'}
        transition-all select-none overflow-hidden
      `}
    >
      {compact ? (
        <p className="text-[10px] font-medium truncate leading-tight">
          {evt.time && <span className="opacity-80 mr-1">{evt.time}</span>}
          {evt.title}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <i className={`${cfg.icon} text-[11px] flex-shrink-0`} />
            <span className="text-xs font-semibold truncate leading-tight">{evt.title}</span>
          </div>
          {evt.time && (
            <p className="text-[10px] opacity-80 mt-0.5 pl-0.5">{evt.time}</p>
          )}
          {!compact && evt.description && (
            <p className="text-[10px] opacity-70 mt-0.5 truncate pl-0.5">{evt.description}</p>
          )}
        </>
      )}
    </div>
  );
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
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [dayEventsModal, setDayEventsModal] = useState<{ date: string; events: any[] } | null>(null);
  const newEventRef = useRef<HTMLDivElement>(null);
  useClickOutside(newEventRef, () => setShowNewEvent(false), showNewEvent);

  const { isEmpresa } = useRole();
  const { addNotification } = useNotificationsContext();
  const { user } = useAuth();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  // useMemo to avoid creating a new Date reference every render (prevents infinite fetch loop)
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDaysArr = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

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
      supabase.from('calendar_events').select('*').gte('date', start).lte('date', end).order('time'),
      supabase.from('vehicle_maintenance').select('*').gte('scheduled_date', start).lte('scheduled_date', end).order('scheduled_date'),
    ]);

    const calEvents = eventsRes.data || [];
    const maintEvents = (maintRes.data || []).map((m: any) => ({
      id: `maint-${m.id}`,
      title: `${m.vehicle_name} — ${m.description || m.maintenance_type}`,
      date: m.scheduled_date,
      type: 'mantenimiento_vehiculo',
      time: '09:00',
      description: `${m.maintenance_type} · ${m.status} · €${Number(m.cost_estimate).toFixed(2)}${m.mechanic ? ' · ' + m.mechanic : ''}`,
      _source: 'maintenance',
      _raw: m,
    }));

    if (!eventsRes.error) setEvents([...calEvents, ...maintEvents]);
    if (!maintRes.error) setMaintenanceEvents(maintEvents);
    setLoading(false);
  }, [year, month, daysInMonth, viewMode, weekStart, currentDate]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const notifiedMaintenanceRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!maintenanceEvents.length) return;
    maintenanceEvents.forEach((evt) => {
      if (notifiedMaintenanceRef.current.has(String(evt.id))) return;
      const raw = evt._raw;
      if (!raw || raw.status === 'completado') return;
      const days = Math.ceil((new Date(raw.scheduled_date + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000);
      if (days >= 0 && days <= 3) {
        addNotification(`Mantenimiento próximo: ${raw.vehicle_name}`, `${raw.description || raw.maintenance_type} el ${new Date(raw.scheduled_date + 'T00:00:00').toLocaleDateString('es-ES')}`, 'maintenance');
        notifiedMaintenanceRef.current.add(String(evt.id));
      }
    });
  }, [maintenanceEvents, addNotification]);

  const getEventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const addEvent = async () => {
    if (!newEvent.title || !selectedDate) return;
    setSaving(true);
    setSaveError(null);
    const payload: Record<string, any> = { ...newEvent, date: selectedDate };
    if (user?.id) payload.user_id = user.id;
    const { error } = await supabase.from('calendar_events').insert([payload]);
    setSaving(false);
    if (error) {
      setSaveError(error.message || 'Error al guardar el evento');
    } else {
      setShowNewEvent(false);
      setSaveError(null);
      setNewEvent({ title: '', type: 'reparto', time: '', description: '' });
      fetchEvents();
    }
  };

  const deleteEvent = async (evt: any) => {
    if (String(evt.id).startsWith('maint-')) return;
    await supabase.from('calendar_events').delete().eq('id', evt.id);
    setDetailEvent(null);
    fetchEvents();
  };

  const moveEventToDate = async (eventId: number | string, newDate: string) => {
    if (typeof eventId === 'string' && String(eventId).startsWith('maint-')) return;
    const { error } = await supabase.from('calendar_events').update({ date: newDate }).eq('id', eventId);
    if (!error) setEvents(prev => prev.map(e => e.id === eventId ? { ...e, date: newDate } : e));
  };

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const todayStr = new Date().toISOString().split('T')[0];
  const currentDateStr = formatDateISO(currentDate);
  const currentDayEvents = getEventsForDate(currentDateStr);
  const weekRangeLabel = `${weekDaysArr[0].getDate()} ${monthNames[weekDaysArr[0].getMonth()]} – ${weekDaysArr[6].getDate()} ${monthNames[weekDaysArr[6].getMonth()]} ${year}`;

  const openNewEventModal = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSaveError(null);
    setShowNewEvent(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Calendario</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {loading ? 'Cargando...' : `${events.length} eventos este ${viewMode === 'month' ? 'mes' : viewMode === 'week' ? 'periodo' : 'día'}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex gap-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            {(['month','week','day'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === v ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'}`}>
                {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Día'}
              </button>
            ))}
          </div>
          <button onClick={viewMode === 'month' ? () => setCurrentDate(new Date(year, month - 1, 1)) : viewMode === 'week' ? () => setCurrentDate(addDays(currentDate, -7)) : () => setCurrentDate(addDays(currentDate, -1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400">
            <i className="ri-arrow-left-s-line" />
          </button>
          <span className="text-base font-semibold text-gray-800 dark:text-slate-100 min-w-[160px] text-center">
            {viewMode === 'month' ? `${monthNames[month]} ${year}` : viewMode === 'week' ? weekRangeLabel : `${weekDaysFull[(new Date(currentDate).getDay() + 6) % 7]} ${currentDate.getDate()} ${monthNames[month]}`}
          </span>
          <button onClick={viewMode === 'month' ? () => setCurrentDate(new Date(year, month + 1, 1)) : viewMode === 'week' ? () => setCurrentDate(addDays(currentDate, 7)) : () => setCurrentDate(addDays(currentDate, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400">
            <i className="ri-arrow-right-s-line" />
          </button>
          <button onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600">
            Hoy
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(typeConfig).map(([key, cfg]) => (
          <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            <i className={`${cfg.icon} text-[11px]`} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* ────────── MONTH VIEW ────────── */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700">
            {weekDays.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60">
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d[0]}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {/* empty cells before month start */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`e-${i}`} className="min-h-[90px] md:min-h-[120px] border-b border-r border-gray-50 dark:border-slate-800/60 bg-gray-50/40 dark:bg-slate-900/40" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEvents = getEventsForDate(dateStr);
              const isToday = dateStr === todayStr;
              const isDragOver = dragOverDate === dateStr;

              return (
                <div
                  key={dayNum}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    if (dayEvents.length === 1) {
                      setDetailEvent(dayEvents[0]);
                    } else if (dayEvents.length > 1) {
                      setDayEventsModal({ date: dateStr, events: dayEvents });
                    } else if (isEmpresa) {
                      openNewEventModal(dateStr);
                    }
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const evtId = Number(e.dataTransfer.getData('text/plain'));
                    if (evtId && dragOverDate) moveEventToDate(evtId, dragOverDate);
                    setDragOverDate(null);
                    setDraggingEventId(null);
                  }}
                  className={`min-h-[90px] md:min-h-[120px] border-b border-r border-gray-100 dark:border-slate-800/60 p-1.5 cursor-pointer transition-colors group
                    ${isDragOver ? 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-400 ring-inset' : 'hover:bg-gray-50/60 dark:hover:bg-slate-800/30'}`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors
                      ${isToday ? 'bg-orange-500 text-white' : 'text-gray-600 dark:text-slate-300 group-hover:text-gray-800 dark:group-hover:text-slate-100'}`}>
                      {dayNum}
                    </span>
                    {isEmpresa && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openNewEventModal(dateStr); }}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-300 dark:text-slate-600 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <i className="ri-add-line text-xs" />
                      </button>
                    )}
                  </div>

                  {/* Event chips */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <EventChip
                        key={evt.id}
                        evt={evt}
                        compact
                        draggable={isEmpresa && !String(evt.id).startsWith('maint-')}
                        isDragging={draggingEventId === evt.id}
                        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', String(evt.id)); setDraggingEventId(evt.id); }}
                        onDragEnd={() => { setDraggingEventId(null); setDragOverDate(null); }}
                        onClick={(e) => { e.stopPropagation(); setDetailEvent(evt); }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 pl-1">+{dayEvents.length - 3} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────── WEEK VIEW ────────── */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700">
            {weekDaysArr.map((d, idx) => {
              const dateStr = formatDateISO(d);
              const isToday = dateStr === todayStr;
              return (
                <div key={idx} className={`py-3 text-center border-r last:border-r-0 border-gray-100 dark:border-slate-800 ${isToday ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{weekDaysFull[idx]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-orange-500' : 'text-gray-700 dark:text-slate-200'}`}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDaysArr.map((d, idx) => {
              const dateStr = formatDateISO(d);
              const dayEvents = getEventsForDate(dateStr);
              const isToday = dateStr === todayStr;
              const isDragOver = dragOverDate === dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    if (dayEvents.length === 1) {
                      setDetailEvent(dayEvents[0]);
                    } else if (dayEvents.length > 1) {
                      setDayEventsModal({ date: dateStr, events: dayEvents });
                    } else if (isEmpresa) {
                      openNewEventModal(dateStr);
                    }
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const evtId = Number(e.dataTransfer.getData('text/plain'));
                    if (evtId && dragOverDate) moveEventToDate(evtId, dragOverDate);
                    setDragOverDate(null);
                    setDraggingEventId(null);
                  }}
                  className={`border-r last:border-r-0 border-gray-100 dark:border-slate-800 p-2 cursor-pointer transition-colors
                    ${isToday ? 'bg-orange-50/20 dark:bg-orange-900/5' : ''}
                    ${isDragOver ? 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-400 ring-inset' : 'hover:bg-gray-50/60 dark:hover:bg-slate-800/30'}`}
                >
                  {dayEvents.length === 0 ? (
                    isEmpresa && (
                      <div className="flex items-center justify-center h-10 opacity-0 hover:opacity-100 transition-opacity">
                        <i className="ri-add-line text-gray-300 dark:text-slate-600 text-lg" />
                      </div>
                    )
                  ) : (
                    <div className="space-y-1.5">
                      {dayEvents.map((evt) => (
                        <EventChip
                          key={evt.id}
                          evt={evt}
                          compact={false}
                          draggable={isEmpresa && !String(evt.id).startsWith('maint-')}
                          isDragging={draggingEventId === evt.id}
                          onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', String(evt.id)); setDraggingEventId(evt.id); }}
                          onDragEnd={() => { setDraggingEventId(null); setDragOverDate(null); }}
                          onClick={(e) => { e.stopPropagation(); setDetailEvent(evt); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────── DAY VIEW ────────── */}
      {viewMode === 'day' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          {/* Day header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${currentDateStr === todayStr ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200'}`}>
                <span className="text-[10px] uppercase font-semibold">{monthNames[month].slice(0, 3)}</span>
                <span className="text-xl font-bold leading-none">{currentDate.getDate()}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-slate-100 text-sm">
                  {weekDaysFull[(new Date(currentDate).getDay() + 6) % 7]} {currentDate.getDate()} de {monthNames[month]} {year}
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{currentDayEvents.length} evento{currentDayEvents.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {isEmpresa && (
              <button onClick={() => openNewEventModal(currentDateStr)}
                className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5">
                <i className="ri-add-line" /> Nuevo evento
              </button>
            )}
          </div>

          {/* Timeline */}
          <div className="overflow-y-auto max-h-[600px]">
            <div className="flex">
              <div className="flex-shrink-0 w-16 border-r border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                {hoursRange.map((h) => (
                  <div key={h} className="h-16 border-b border-gray-100 dark:border-slate-800 flex items-start justify-center pt-2">
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">{String(h).padStart(2,'0')}:00</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 relative">
                {hoursRange.map((h) => {
                  const hourEvts = currentDayEvents.filter(e => getEventHour(e.time) === h);
                  return (
                    <div key={h} className="h-16 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-colors px-2 py-1">
                      {hourEvts.map((evt) => (
                        <EventChip
                          key={evt.id}
                          evt={evt}
                          compact={false}
                          draggable={isEmpresa && !String(evt.id).startsWith('maint-')}
                          isDragging={draggingEventId === evt.id}
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(evt.id)); setDraggingEventId(evt.id); }}
                          onDragEnd={() => { setDraggingEventId(null); setDragOverDate(null); }}
                          onClick={() => setDetailEvent(evt)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drag hint */}
      {isEmpresa && (
        <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
          <i className="ri-drag-move-line" />
          {viewMode === 'day' ? 'Cambia a vista Mes o Semana para arrastrar eventos entre días.' : 'Arrastra los eventos entre días para reprogramarlos. Haz clic en un evento para ver detalles.'}
        </p>
      )}

      {/* ── New Event Modal ── */}
      <Modal isOpen={showNewEvent && !!selectedDate} onClose={() => setShowNewEvent(false)} title={`Nuevo evento · ${selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''}`} size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block mb-1.5">Título *</label>
            <input
              type="text" autoFocus
              placeholder="Ej: Ruta Centro, Reunión cliente..."
              value={newEvent.title}
              onChange={e => setNewEvent({...newEvent, title: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && newEvent.title && addEvent()}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block mb-1.5">Tipo</label>
              <select value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-400">
                {Object.entries(typeConfig).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block mb-1.5">Hora</label>
              <input type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-400" />
            </div>
          </div>
          {/* Preview chip */}
          {newEvent.title && (
            <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Vista previa:</p>
              <div className="max-w-[200px]">
                <EventChip evt={{ ...newEvent, id: 'preview' }} compact={false} />
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block mb-1.5">Descripción</label>
            <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-400 resize-none" rows={2}
              placeholder="Detalles opcionales..." maxLength={500} />
          </div>
          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              <i className="ri-error-warning-line flex-shrink-0" />
              {saveError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => { setShowNewEvent(false); setSaveError(null); }} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button
              onClick={addEvent}
              disabled={!newEvent.title || saving}
              className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
              ) : (
                'Guardar evento'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Day Events List Modal (when cell has multiple events) ── */}
      <Modal
        isOpen={!!dayEventsModal}
        onClose={() => setDayEventsModal(null)}
        title={dayEventsModal ? new Date(dayEventsModal.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
        size="md"
      >
        {dayEventsModal && (
          <div className="space-y-2">
            {dayEventsModal.events.map((evt) => {
              const cfg = typeConfig[evt.type] || typeConfig.reparto;
              return (
                <button
                  key={evt.id}
                  onClick={() => { setDayEventsModal(null); setDetailEvent(evt); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <i className={`${cfg.icon} text-white text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{evt.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{evt.time || 'Sin hora'} · {cfg.label}</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400 flex-shrink-0" />
                </button>
              );
            })}
            {isEmpresa && (
              <button
                onClick={() => { setDayEventsModal(null); openNewEventModal(dayEventsModal.date); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-400 dark:text-slate-500 hover:border-orange-300 hover:text-orange-500 transition-colors"
              >
                <i className="ri-add-line" /> Añadir otro evento
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* ── Event Detail Modal ── */}
      <Modal isOpen={!!detailEvent} onClose={() => setDetailEvent(null)} title="Detalle del evento" size="md">
        {detailEvent && (() => {
          const cfg = typeConfig[detailEvent.type] || typeConfig.reparto;
          return (
            <div className="space-y-4">
              {/* Header chip preview */}
              <div className={`${cfg.bg} ${cfg.text} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <i className={`${cfg.icon} text-lg`} />
                  <span className="font-bold text-base">{detailEvent.title}</span>
                </div>
                <div className="flex items-center gap-3 text-sm opacity-90">
                  <span className="flex items-center gap-1"><i className="ri-calendar-line text-xs" />{new Date(detailEvent.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  {detailEvent.time && <span className="flex items-center gap-1"><i className="ri-time-line text-xs" />{detailEvent.time}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Tipo</p>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                    <i className={cfg.icon} />{cfg.label}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Hora</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{detailEvent.time || '—'}</p>
                </div>
              </div>

              {detailEvent.description && (
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Descripción</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{detailEvent.description}</p>
                </div>
              )}

              {detailEvent._source !== 'maintenance' && isEmpresa && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={() => { if (confirm('¿Eliminar este evento?')) deleteEvent(detailEvent); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <i className="ri-delete-bin-line" /> Eliminar
                  </button>
                  <button onClick={() => setDetailEvent(null)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-600">Cerrar</button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
