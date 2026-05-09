import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useRole } from '@/hooks/useRole';
import { useProfile } from '@/hooks/useProfile';
import Modal from '@/components/base/Modal';

export default function Rutas() {
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [updateStop, setUpdateStop] = useState<any | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoute, setNewRoute] = useState({ name: '', driver: '', vehicle: '', start_time: '', estimated_end: '' });
  const [pushEnabled, setPushEnabled] = useState(false);
  const updateStatusRef = useRef<HTMLDivElement>(null);
  const newRouteRef = useRef<HTMLDivElement>(null);
  useClickOutside(updateStatusRef, () => setShowUpdateStatus(false), showUpdateStatus);
  useClickOutside(newRouteRef, () => setShowNewRoute(false), showNewRoute);
  const { addNotification } = useNotificationsContext();
  const { isEmpresa } = useRole();
  const { profile } = useProfile();

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    const { data: rData } = await supabase.from('routes').select('*').order('id');
    const { data: sData } = await supabase.from('route_stops').select('*').order('order_num');
    if (rData) {
      // For empleado, filter routes assigned to them
      const filtered = isEmpresa ? rData : rData.filter((r: any) =>
        !profile.full_name || !r.driver || r.driver.toLowerCase().includes(profile.full_name.toLowerCase())
      );
      setRoutes(filtered);
      if (filtered.length > 0 && !selectedRoute) setSelectedRoute(filtered[0]);
    }
    if (sData) setRouteStops(sData);
    setLoading(false);
  }, [isEmpresa, profile.full_name, selectedRoute]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const getStopsForRoute = (routeId: number) => routeStops.filter(s => s.route_id === routeId);

  const canChangeStopStatus = (stop: any) => {
    if (isEmpresa) return true;
    // Empleado can only change stops from their own route
    const route = routes.find(r => r.id === stop.route_id);
    if (!route) return false;
    if (!profile.full_name) return true;
    return route.driver?.toLowerCase().includes(profile.full_name.toLowerCase());
  };

  const addRoute = async () => {
    if (!newRoute.name) return;
    const { error } = await supabase.from('routes').insert([{
      ...newRoute,
      status: 'planificada',
      date: new Date().toISOString().split('T')[0],
    }]);
    if (!error) {
      addNotification('Nueva ruta creada', `Se creó la ruta "${newRoute.name}" asignada a ${newRoute.driver}`, 'route');
      setShowNewRoute(false);
      setNewRoute({ name: '', driver: '', vehicle: '', start_time: '', estimated_end: '' });
      fetchRoutes();
    }
  };

  const updateStopStatus = async (newStatus: string) => {
    if (!updateStop) return;
    const { error } = await supabase.from('route_stops').update({ status: newStatus }).eq('id', updateStop.id);
    if (!error) {
      setRouteStops(prev => prev.map(s => s.id === updateStop.id ? { ...s, status: newStatus } : s));
      const label = newStatus === 'completed' ? 'Entregado' : newStatus === 'in_progress' ? 'En camino' : 'Pendiente';
      addNotification(
        'Estado de entrega actualizado',
        `La parada #${updateStop.order_num} de ${updateStop.client} ahora está: ${label}`,
        'route'
      );
      setShowUpdateStatus(false);
      setUpdateStop(null);
    }
  };

  const updateRouteStatus = async (routeId: number, newStatus: string) => {
    if (!isEmpresa) return;
    const { error } = await supabase.from('routes').update({ status: newStatus }).eq('id', routeId);
    if (!error) {
      setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, status: newStatus } : r));
      const routeName = routes.find(r => r.id === routeId)?.name || 'Ruta';
      const label = newStatus === 'active' ? 'En curso' : newStatus === 'completed' ? 'Completada' : 'Planificada';
      addNotification('Estado de ruta actualizado', `"${routeName}" ahora está: ${label}`, 'route');
    }
  };

  const notifyClient = (clientName: string) => {
    if (pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Quickly', {
        body: `Su entrega para ${clientName} está en camino. Estimada: 15 min.`,
      });
    }
  };

  const requestPushPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') setPushEnabled(true);
  };

  const mapSrc = selectedRoute
    ? `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d12144.7!2d-3.7038!3d40.4168!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0xd422997800a3c81%3A0xc436dec1618c2267!2sMadrid!3m2!1d40.4168!2d-3.7038!4m5!1s0xd4228b0!2sMadrid!3m2!1d40.45!2d-3.68!5e0!3m2!1ses!2ses!4v1700000000000`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Rutas y Localización</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {routes.length} rutas{!isEmpresa ? ' asignadas a ti' : ' hoy'}{loading && ' (cargando...)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={requestPushPermission}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2
              ${pushEnabled ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className={pushEnabled ? 'ri-notification-3-fill' : 'ri-notification-3-line'} />
            </div>
            {pushEnabled ? 'Notificaciones ON' : 'Activar Notificaciones'}
          </button>
          {isEmpresa && (
            <button
              onClick={() => setShowNewRoute(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line" />
              </div>
              Nueva Ruta
            </button>
          )}
        </div>
      </div>

      {/* Empleado info banner */}
      {!isEmpresa && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <i className="ri-information-line text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Ves únicamente las rutas asignadas a ti. Puedes cambiar el estado de tus paradas.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Route List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">Rutas</h3>
          {routes.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
              <i className="ri-route-line text-2xl block mb-2" />
              {isEmpresa ? 'Sin rutas creadas' : 'No tienes rutas asignadas hoy'}
            </div>
          )}
          {routes.map((route) => (
            <button
              key={route.id}
              onClick={() => setSelectedRoute(route)}
              className={`w-full text-left p-4 rounded-xl border transition-all
                ${selectedRoute?.id === route.id
                  ? 'border-orange-300 bg-orange-50 dark:border-orange-500/40 dark:bg-orange-900/20'
                  : 'border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-900 hover:border-gray-200 dark:hover:border-slate-600'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-gray-800 dark:text-slate-100">{route.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                  ${route.status === 'active' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : route.status === 'completed' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-gray-50 text-gray-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {route.status === 'active' ? 'En curso' : route.status === 'completed' ? 'Completada' : 'Planificada'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">{route.driver} · {route.vehicle}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {getStopsForRoute(route.id).length} paradas · {route.start_time} - {route.estimated_end}
              </p>
              {isEmpresa && selectedRoute?.id === route.id && (
                <div className="flex gap-1 mt-2">
                  {route.status === 'planificada' && (
                    <button onClick={() => updateRouteStatus(route.id, 'active')} className="px-2 py-1 bg-green-500 text-white rounded text-xs">Iniciar</button>
                  )}
                  {route.status === 'active' && (
                    <button onClick={() => updateRouteStatus(route.id, 'completed')} className="px-2 py-1 bg-blue-500 text-white rounded text-xs">Completar</button>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Map + Route Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="aspect-video w-full">
              <iframe
                src={mapSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Route Stops */}
          {selectedRoute && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-slate-100">Paradas - {selectedRoute.name}</h3>
                {isEmpresa && (
                  <button className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1">
                    <i className="ri-route-line" /> Optimizar orden
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {getStopsForRoute(selectedRoute.id).map((stop: any, idx: number) => (
                  <div key={stop.id} className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${stop.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                          stop.status === 'in_progress' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' :
                          'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {idx + 1}
                      </div>
                      {idx < getStopsForRoute(selectedRoute.id).length - 1 && (
                        <div className="w-0.5 h-8 bg-gray-200 dark:bg-slate-700 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 border border-gray-100 dark:border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-800 dark:text-slate-100">{stop.client}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{stop.time}</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{stop.address}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                          ${stop.status === 'completed' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                            stop.status === 'in_progress' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' :
                            'bg-gray-50 text-gray-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {stop.status === 'completed' ? 'Entregado' :
                            stop.status === 'in_progress' ? 'En camino' : 'Pendiente'}
                        </span>
                        {stop.status === 'in_progress' && (
                          <button
                            onClick={() => notifyClient(stop.client)}
                            className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 hover:underline"
                          >
                            <i className="ri-notification-3-line" /> Enviar notificación
                          </button>
                        )}
                        {canChangeStopStatus(stop) && (
                          <button
                            onClick={() => { setUpdateStop(stop); setShowUpdateStatus(true); }}
                            className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 hover:underline"
                          >
                            <i className="ri-edit-line" /> Cambiar estado
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Update Stop Status Modal */}
      <Modal
        isOpen={showUpdateStatus && !!updateStop}
        onClose={() => { setShowUpdateStatus(false); setUpdateStop(null); }}
        title={updateStop ? `Actualizar estado - ${updateStop.client}` : ''}
        size="sm"
        hideCloseButton={false}
      >
        {updateStop && (
          <div className="space-y-2">
            <button onClick={() => updateStopStatus('pending')} className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 text-left flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-500" /> Pendiente
            </button>
            <button onClick={() => updateStopStatus('in_progress')} className="w-full px-4 py-2.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 text-left flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" /> En camino
            </button>
            <button onClick={() => updateStopStatus('completed')} className="w-full px-4 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/30 text-left flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" /> Entregado
            </button>
            <button onClick={() => { setShowUpdateStatus(false); setUpdateStop(null); }} className="w-full py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Cancelar</button>
          </div>
        )}
      </Modal>

      {/* New Route Modal */}
      <Modal
        isOpen={showNewRoute}
        onClose={() => setShowNewRoute(false)}
        title="Nueva Ruta"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Nombre de la ruta</label>
            <input type="text" placeholder="Ej: Ruta Oeste..." value={newRoute.name} onChange={e => setNewRoute({...newRoute, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Repartidor</label>
              <input type="text" placeholder="Nombre..." value={newRoute.driver} onChange={e => setNewRoute({...newRoute, driver: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Vehículo</label>
              <input type="text" placeholder="Furgoneta..." value={newRoute.vehicle} onChange={e => setNewRoute({...newRoute, vehicle: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Hora inicio</label>
              <input type="time" value={newRoute.start_time} onChange={e => setNewRoute({...newRoute, start_time: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Hora estimada fin</label>
              <input type="time" value={newRoute.estimated_end} onChange={e => setNewRoute({...newRoute, estimated_end: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowNewRoute(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button onClick={addRoute} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              Crear Ruta
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}