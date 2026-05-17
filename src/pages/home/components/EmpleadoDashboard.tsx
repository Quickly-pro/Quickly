import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useProfile } from '@/hooks/useProfile';
import SubscriptionBanner from '@/components/feature/SubscriptionBanner';

export default function EmpleadoDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [todayRoutes, setTodayRoutes] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotificationsContext();
  const { profile } = useProfile();

  // Time tracking states
  const [timeEntry, setTimeEntry] = useState<any>(null);
  const [timeLoading, setTimeLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Shift swaps state
  const [pendingSwaps, setPendingSwaps] = useState<any[]>([]);

  const today = new Date().toISOString().split('T')[0];

  const fetchDashboard = useCallback(async () => {
    setLoading(true);

    const [
      { data: routes },
      { data: stops },
      { data: orders },
      { data: incs },
      { data: calendar },
    ] = await Promise.all([
      supabase.from('routes').select('id, status, driver, name, start_time').gte('start_time', today),
      supabase.from('route_stops').select('id, status'),
      supabase.from('order_headers').select('id, status, created_at, shipping_total, tax_total, subtotal_items, discount_price').in('status', ['processing', 'shipped']),
      supabase.from('vehicle_incidents').select('id, status').in('status', ['abierto', 'abierta']),
      supabase.from('calendar_events').select('id, title, start_time').gte('start_time', today).order('start_time').limit(5),
    ]);

    const todayRoutesData = (routes || []).filter((r: any) => r.start_time && r.start_time.startsWith(today));

    setStats({
      todayRoutes: todayRoutesData.length,
      completedStops: (stops || []).filter((s: any) => s.status === 'completado').length,
      pendingStops: (stops || []).filter((s: any) => s.status !== 'completado').length,
      activeOrders: (orders || []).length,
      openIncidents: (incs || []).filter((i: any) => ['abierto', 'abierta'].includes(i.status)).length,
    });

    setTodayRoutes(todayRoutesData.slice(0, 5));
    setPendingOrders((orders || []).slice(0, 5));
    setLoading(false);
  }, [today]);

  const fetchTimeEntry = useCallback(async () => {
    if (!profile.full_name) return;
    setTimeLoading(true);
    const { data } = await supabase
      .from('time_tracking')
      .select('*')
      .eq('employee', profile.full_name)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setTimeEntry(data || null);
    setTimeLoading(false);
  }, [profile.full_name, today]);

  const fetchPendingSwaps = useCallback(async () => {
    if (!profile.full_name) return;
    const { data } = await supabase
      .from('shift_swaps')
      .select('*')
      .eq('status', 'pending')
      .or(`requester_name.eq.${profile.full_name},recipient_name.eq.${profile.full_name}`)
      .order('created_at', { ascending: false });
    setPendingSwaps(data || []);
  }, [profile.full_name]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!loading) {
      fetchTimeEntry();
      fetchPendingSwaps();
    }
  }, [loading, fetchTimeEntry, fetchPendingSwaps]);

  const handleCheckIn = async () => {
    if (!profile.full_name) return;
    setCheckingIn(true);
    const now = new Date();
    const checkInTime = now.toTimeString().slice(0, 5);
    const { error } = await supabase.from('time_tracking').insert({
      employee: profile.full_name,
      date: today,
      check_in: checkInTime,
      check_out: null,
      total_hours: null,
    });
    setCheckingIn(false);
    if (!error) {
      addNotification('Fichaje registrado', `Entrada a las ${checkInTime}`, 'system');
      fetchTimeEntry();
    }
  };

  const handleCheckOut = async () => {
    if (!timeEntry) return;
    setCheckingOut(true);
    const now = new Date();
    const checkOutTime = now.toTimeString().slice(0, 5);

    const [hIn, mIn] = timeEntry.check_in.split(':').map(Number);
    const [hOut, mOut] = checkOutTime.split(':').map(Number);
    const total = ((hOut * 60 + mOut) - (hIn * 60 + mIn)) / 60;

    const { error } = await supabase
      .from('time_tracking')
      .update({ check_out: checkOutTime, total_hours: Number(total.toFixed(1)) })
      .eq('id', timeEntry.id);

    setCheckingOut(false);
    if (!error) {
      addNotification('Fichaje completado', `Salida a las ${checkOutTime} · ${total.toFixed(1)}h`, 'system');
      fetchTimeEntry();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Panel de Empleado</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Tu día de trabajo</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Clock-in / Clock-out button */}
          {!timeLoading && (
            <>
              {timeEntry && !timeEntry.check_out ? (
                <button
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all whitespace-nowrap shadow-sm"
                >
                  {checkingOut ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-r-line" /></div>
                  )}
                  Finalizar turno
                </button>
              ) : (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn || !!timeEntry}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shadow-sm
                    ${timeEntry
                      ? 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-orange-500 text-white hover:bg-orange-600'}
                  `}
                >
                  {checkingIn ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-login-box-line" /></div>
                  )}
                  {timeEntry ? `Fichado (${timeEntry.check_in})` : 'Fichar ahora'}
                </button>
              )}
            </>
          )}
          <span className="text-sm text-gray-400 dark:text-slate-500">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      </div>

      <SubscriptionBanner />

      {/* Active shift card */}
      {timeEntry && !timeEntry.check_out && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <i className="ri-time-line text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">Turno activo</p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Entrada: {timeEntry.check_in} · En curso...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">Activo</span>
          </div>
        </div>
      )}

      {/* Completed shift card */}
      {timeEntry && timeEntry.check_out && (
        <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <i className="ri-time-line text-gray-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Turno finalizado</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {timeEntry.check_in} – {timeEntry.check_out} · {timeEntry.total_hours}h
              </p>
            </div>
          </div>
          <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-medium text-gray-600 dark:text-slate-300">
            Completado
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-slate-700 mb-2" />
              <div className="h-6 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <i className="ri-route-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{stats?.todayRoutes || 0}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Rutas hoy</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                <i className="ri-shopping-cart-2-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{stats?.activeOrders || 0}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Pedidos activos</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                <i className="ri-map-pin-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{stats?.pendingStops || 0}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Paradas pendientes</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <i className="ri-error-warning-line" />
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{stats?.openIncidents || 0}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Incidencias abiertas</p>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/rutas" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 transition-all">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 mb-2">
            <i className="ri-map-2-line text-lg" />
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Mis Rutas</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Ver rutas asignadas</p>
        </Link>
        <Link to="/mapa-reparto" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 transition-all">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 mb-2">
            <i className="ri-map-pin-line text-lg" />
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Mapa Reparto</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Destinos y navegación</p>
        </Link>
        <Link to="/hoja-pedidos" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 transition-all">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 mb-2">
            <i className="ri-file-list-3-line text-lg" />
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Hoja Pedidos</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Consultar pedidos</p>
        </Link>
        <Link to="/cuadrante" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 transition-all relative">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 mb-2">
            <i className="ri-calendar-check-line text-lg" />
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Cuadrante</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Horario semanal</p>
          {pendingSwaps.length > 0 && (
            <span className="absolute top-3 right-3 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
              {pendingSwaps.length > 9 ? '9+' : pendingSwaps.length}
            </span>
          )}
        </Link>
      </div>

      {/* Pending Shift Swaps */}
      {pendingSwaps.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-arrow-left-right-line text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">Intercambios de turno pendientes</h3>
            </div>
            <Link to="/cuadrante" className="text-xs text-amber-700 dark:text-amber-400 hover:underline">
              Ir al cuadrante
            </Link>
          </div>
          <div className="space-y-2">
            {pendingSwaps.slice(0, 3).map((swap: any) => (
              <div key={swap.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-100 dark:border-amber-800/20">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-700 dark:text-slate-300">
                    {swap.requester_name} <i className="ri-arrow-right-line text-amber-500 mx-1" /> {swap.recipient_name}
                  </span>
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {new Date(swap.requested_date || swap.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
            {pendingSwaps.length > 3 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 pl-1">
                +{pendingSwaps.length - 3} más pendientes
              </p>
            )}
          </div>
        </div>
      )}

      {/* Today's Routes + Pending Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100">Rutas de Hoy</h3>
            <Link to="/rutas" className="text-xs text-orange-600 hover:underline">Ver todas</Link>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-lg" />)}
            </div>
          ) : todayRoutes.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
              <i className="ri-route-line text-2xl mb-2 block" />
              Sin rutas asignadas hoy
            </div>
          ) : (
            <div className="space-y-2">
              {todayRoutes.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
                    <i className="ri-truck-line text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{r.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Conductor: {r.driver || 'Sin asignar'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {r.status === 'active' ? 'Activa' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100">Pedidos Pendientes</h3>
            <Link to="/hoja-pedidos" className="text-xs text-orange-600 hover:underline">Ver todos</Link>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-lg" />)}
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">
              <i className="ri-shopping-cart-2-line text-2xl mb-2 block" />
              Sin pedidos pendientes
            </div>
          ) : (
            <div className="space-y-2">
              {pendingOrders.map((o: any) => (
                <div key={o.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600">
                    <i className="ri-box-3-line text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100">PED-{String(o.id).padStart(6, '0')}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(o.created_at).toLocaleDateString('es-ES')}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${o.status === 'shipped' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                    {o.status === 'shipped' ? 'Enviado' : 'Preparando'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
