import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { useRole } from '@/hooks/useRole';
import { useNotificationsContext } from '@/context/NotificationsContext';
import Modal from '@/components/base/Modal';
import { useArrivalToasts, ArrivalToastContainer } from './components/ArrivalToast';

// ── Types ──────────────────────────────────────────────────────────────────
interface Destination {
  id: number;
  name: string;
  address: string;
  phone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  order_num: number;
  visited: boolean;
  created_by: string;
  estimated_minutes?: number;
  deliveredAt?: string;
  deliveredTo?: string;
  deliveryNotes?: string;
}

interface Vehicle {
  id: string;
  name: string;
  driver: string;
  color: string;
  progress: number;
  currentStopIndex: number;
  speed: number;
  status: 'driving' | 'stopped' | 'idle';
  startIndex: number;
  endIndex: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getMapEmbedUrl(addresses: string[]) {
  if (addresses.length === 0) return 'https://maps.google.com/maps?q=Madrid,España&output=embed&hl=es';
  if (addresses.length === 1) return `https://maps.google.com/maps?q=${encodeURIComponent(addresses[0])}&output=embed&hl=es`;
  const stops = addresses.map(a => encodeURIComponent(a)).join('/');
  return `https://maps.google.com/maps/dir/${stops}?output=embed&hl=es`;
}

function getOptimizedRouteUrl(addresses: string[]) {
  if (addresses.length === 0) return '#';
  const origin = encodeURIComponent(addresses[0]);
  const destination = encodeURIComponent(addresses[addresses.length - 1]);
  const waypoints = addresses.slice(1, -1).map(a => encodeURIComponent(a)).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

function getNavigationUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function generateEstimatedMinutes(destinations: Destination[]): Destination[] {
  if (destinations.length <= 1) return destinations;
  return destinations.map((d, i) => ({ ...d, estimated_minutes: i === 0 ? 0 : Math.floor(Math.random() * 22) + 8 }));
}

function getLegDistanceMinutes(): number { return Math.floor(Math.random() * 22) + 8; }

function createDemoVehicles(destinations: Destination[]): Vehicle[] {
  if (destinations.length === 0) return [];
  const count = Math.min(3, Math.max(1, Math.ceil(destinations.length / 4)));
  const vehicleNames = ['Furgoneta A1', 'Camión B2', 'Furgón C3'];
  const drivers = ['Carlos Ruiz', 'María López', 'Antonio García'];
  const colors = ['#f97316', '#10b981', '#6366f1'];
  const chunkSize = Math.ceil(destinations.length / count);
  return Array.from({ length: count }, (_, i) => ({
    id: `vehicle-${i}`,
    name: vehicleNames[i],
    driver: drivers[i],
    color: colors[i],
    progress: Math.random() * 0.7,
    currentStopIndex: i * chunkSize,
    speed: 35 + Math.floor(Math.random() * 25),
    status: 'driving' as const,
    startIndex: i * chunkSize,
    endIndex: Math.min((i + 1) * chunkSize - 1, destinations.length - 1),
  }));
}

function formatETA(minutes: number): string {
  if (minutes <= 0) return 'Llegando...';
  if (minutes < 60) return `${Math.ceil(minutes)} min`;
  return `${Math.floor(minutes / 60)}h ${Math.ceil(minutes % 60)}m`;
}

function getVehicleForStop(vehicles: Vehicle[], stopIndex: number): Vehicle | undefined {
  return vehicles.find(v => stopIndex >= v.startIndex && stopIndex <= v.endIndex);
}

// ── Animated vehicle on route strip ────────────────────────────────────────
function VehicleRouteMarker({ vehicle, destinations }: { vehicle: Vehicle; destinations: Destination[] }) {
  if (!destinations.length) return null;
  const basePercent = (vehicle.currentStopIndex / Math.max(1, destinations.length - 1)) * 100;
  const legPercent = (1 / Math.max(1, destinations.length - 1)) * vehicle.progress * 100;
  const leftPercent = Math.min(97, Math.max(2, basePercent + legPercent));
  return (
    <div className="absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-1000 ease-linear pointer-events-none" style={{ left: `${leftPercent}%` }}>
      <div className="relative flex flex-col items-center">
        <div className="absolute w-8 h-8 rounded-full animate-ping opacity-30" style={{ backgroundColor: vehicle.color }} />
        <div className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-lg relative" style={{ backgroundColor: vehicle.color }}>
          <i className="ri-truck-line text-white text-xs" />
        </div>
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-900 dark:bg-slate-700 text-white rounded text-[10px] font-bold whitespace-nowrap shadow">
          {vehicle.name}
        </div>
      </div>
    </div>
  );
}

function MovingDashes({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-full">
      <div className="absolute inset-0 animate-[slide_1.5s_linear_infinite]" style={{ background: `repeating-linear-gradient(90deg, transparent, transparent 6px, ${color}80 6px, ${color}80 12px)` }} />
    </div>
  );
}

// ── Trajectory path component ──────────────────────────────────────────────
function TrajectoryStrip({ destinations, vehicles }: { destinations: Destination[]; vehicles: Vehicle[] }) {
  if (destinations.length < 2) return null;
  const visitedCount = destinations.filter(d => d.visited).length;
  const visitedPercent = (visitedCount / (destinations.length - 1)) * 100;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <i className="ri-route-line text-orange-500" />
            Trayecto en tiempo real
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {vehicles.filter(v => v.status === 'driving').length} en movimiento &middot; {vehicles.filter(v => v.status === 'stopped').length} entregando &middot; {visitedCount}/{destinations.length} paradas
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {vehicles.map(v => (
            <div key={v.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />
              <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">{v.driver.split(' ')[0]}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ${v.status === 'driving' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : v.status === 'stopped' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                {v.status === 'driving' ? 'En ruta' : v.status === 'stopped' ? 'Entregando' : 'Inactivo'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Route track with trajectory */}
      <div className="relative h-14 bg-gray-50 dark:bg-slate-800 rounded-xl overflow-hidden">
        {/* Completed portion */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-green-400 dark:bg-green-500 transition-all duration-500 z-[1]"
          style={{ width: `calc(${visitedPercent}% - 12px)` }}
        />
        {/* Remaining portion */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-gray-200 dark:bg-slate-700 rounded-full" />
        {/* Stop markers */}
        {destinations.map((dest, idx) => {
          const percent = (idx / Math.max(1, destinations.length - 1)) * 94 + 3;
          return (
            <div
              key={idx}
              className={`absolute top-1/2 -translate-y-1/2 z-[2] transition-all duration-300 ${dest.visited ? 'w-3 h-3 -translate-x-1.5' : 'w-2.5 h-2.5 -translate-x-1.25'}`}
              style={{ left: `${percent}%` }}
            >
              {dest.visited ? (
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-800 shadow" />
              ) : idx === 0 ? (
                <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white dark:border-slate-800 shadow" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800" />
              )}
            </div>
          );
        })}
        {/* Animated vehicles */}
        {vehicles.map(v => <VehicleRouteMarker key={v.id} vehicle={v} destinations={destinations} />)}
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2 px-1">
        <div className="flex items-center gap-1 max-w-[35%]">
          <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
          <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{destinations[0]?.name}</span>
        </div>
        <div className="flex items-center gap-1 max-w-[35%]">
          <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate text-right">{destinations[destinations.length - 1]?.name}</span>
          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-500 flex-shrink-0" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">Trayecto completado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">Ruta pendiente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white" />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">Repartidor activo</span>
        </div>
      </div>
    </div>
  );
}

// ── Client tracking view ────────────────────────────────────────────────────
function ClientTrackingView({ destinations, vehicles }: { destinations: Destination[]; vehicles: Vehicle[] }) {
  const activeVehicle = vehicles.find(v => v.status !== 'idle') || vehicles[0];
  const nextStop = activeVehicle ? destinations[activeVehicle.currentStopIndex] : null;
  const visitedCount = destinations.filter(d => d.visited).length;
  const totalStops = destinations.length;
  const progressPercent = totalStops > 1 ? Math.round((visitedCount / (totalStops - 1)) * 100) : 0;

  const mapUrl = useMemo(() => {
    const addrs = destinations.map(d => d.address);
    return getMapEmbedUrl(addrs);
  }, [destinations]);

  return (
    <div className="space-y-4">
      {/* Status hero */}
      {activeVehicle ? (
        <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800/40 p-5">
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: activeVehicle.color + '20' }}>
                <i className="ri-truck-line text-2xl" style={{ color: activeVehicle.color }} />
              </div>
              {activeVehicle.status === 'driving' && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-white" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeVehicle.status === 'driving' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                  {activeVehicle.status === 'driving' ? '● En camino' : '● Entregando'}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">{activeVehicle.speed} km/h</span>
              </div>
              <p className="font-bold text-gray-800 dark:text-slate-100">{activeVehicle.driver}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">{activeVehicle.name}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{visitedCount} de {totalStops} paradas completadas</span>
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-orange-400 to-orange-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Next stop */}
          {nextStop && !nextStop.visited && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-white/70 dark:bg-slate-800/50 rounded-lg">
              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-map-pin-line text-white text-xs" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Próxima parada</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{nextStop.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{nextStop.address}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-truck-line text-2xl text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-slate-300">Sin repartos activos</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">No hay repartidores en ruta en este momento</p>
        </div>
      )}

      {/* Trajectory strip */}
      {destinations.length >= 2 && <TrajectoryStrip destinations={destinations} vehicles={vehicles} />}

      {/* Map */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
          <i className="ri-map-2-line text-orange-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">Mapa de la ruta</span>
        </div>
        <iframe
          key={mapUrl}
          src={mapUrl}
          width="100%"
          height="340"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full block"
        />
      </div>

      {/* Stops list */}
      {destinations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Paradas de la ruta</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {destinations.map((dest, idx) => {
              const vehicle = getVehicleForStop(vehicles, idx);
              return (
                <div key={dest.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${dest.visited ? 'bg-green-500 text-white' : vehicle ? 'text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}
                    style={!dest.visited && vehicle ? { backgroundColor: vehicle.color } : {}}>
                    {dest.visited ? <i className="ri-check-line" /> : vehicle ? <i className="ri-truck-line" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${dest.visited ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'}`}>{dest.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{dest.address}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${dest.visited ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : vehicle ? 'text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}
                    style={!dest.visited && vehicle ? { backgroundColor: vehicle.color } : {}}>
                    {dest.visited ? 'Entregado' : vehicle ? 'En ruta' : 'Pendiente'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MapaReparto() {
  const { profile } = useProfile();
  const { isCliente } = useRole();
  const { addNotification } = useNotificationsContext();
  const { toasts, pushToast, removeToast } = useArrivalToasts();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillHandledRef = useRef(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState<number | null>(null);
  const [showDelivery, setShowDelivery] = useState<Destination | null>(null);
  const [deliveryReceptor, setDeliveryReceptor] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [newDest, setNewDest] = useState({ name: '', address: '', phone: '', notes: '' });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const prevVehiclesRef = useRef<Vehicle[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [userMapUrl, setUserMapUrl] = useState<string | null>(null);

  // Request notifications
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchDestinations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('route_stops').select('*').order('order_num');
    if (data) {
      const mapped = data.map((d: any, idx: number) => ({
        id: d.id,
        name: d.client || `Destino ${idx + 1}`,
        address: d.address || 'Sin dirección',
        phone: d.phone || '',
        notes: d.notes || '',
        lat: d.lat ? Number(d.lat) : undefined,
        lng: d.lng ? Number(d.lng) : undefined,
        order_num: d.order_num || idx + 1,
        visited: d.status === 'completed',
        created_by: d.driver || '',
      }));
      const withETA = generateEstimatedMinutes(mapped);
      setDestinations(withETA);
      setVehicles(createDemoVehicles(withETA));
    } else {
      setDestinations([]);
      setVehicles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDestinations(); }, [fetchDestinations]);

  // Prefill from URL params (when coming from /clientes)
  useEffect(() => {
    if (prefillHandledRef.current) return;
    const name = searchParams.get('name');
    const address = searchParams.get('address');
    if (!name && !address) return;
    prefillHandledRef.current = true;
    const phone = searchParams.get('phone') || '';
    const notes = searchParams.get('notes') || '';
    const autoAdd = searchParams.get('autoAdd') === '1';
    setNewDest({ name: name || '', address: address || '', phone, notes });
    if (autoAdd && name && address) {
      (async () => {
        const { error } = await supabase.from('route_stops').insert({
          client: name, address, phone: phone || null, notes: notes || null,
          order_num: 9999, status: 'pending',
          driver: profile.full_name || 'Sin asignar', route_id: null,
        });
        if (!error) { addNotification('Cliente localizado', `${name} añadido a la ruta`, 'route'); fetchDestinations(); }
        else { addNotification('Revisa el destino', error.message || 'Revisa los datos', 'system'); setShowAdd(true); }
      })();
    } else {
      setShowAdd(true);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, profile.full_name, addNotification, fetchDestinations]);

  // Watch GPS position
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const getUserLocation = useCallback(() => {
    const cached = userLocationRef.current;
    if (cached) {
      setUserMapUrl(`https://maps.google.com/maps?q=${cached.lat},${cached.lng}&output=embed&hl=es&z=16`);
      addNotification('Mi ubicación', `Lat ${cached.lat.toFixed(5)}, Lng ${cached.lng.toFixed(5)}`, 'route');
      return;
    }
    if (!navigator.geolocation) { setGeolocationError('Tu navegador no soporta geolocalización'); return; }
    setLocLoading(true);
    setGeolocationError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setLocLoading(false);
        setUserMapUrl(`https://maps.google.com/maps?q=${lat},${lng}&output=embed&hl=es&z=16`);
        addNotification('Mi ubicación', `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`, 'route');
      },
      err => {
        setLocLoading(false);
        setGeolocationError(err.code === err.PERMISSION_DENIED ? 'Permiso denegado. Activa la ubicación.' : 'No se pudo obtener tu ubicación.');
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );
  }, [addNotification]);

  // Animate vehicles
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles(prev => prev.map(v => {
        if (v.status === 'idle') return v;
        const nextProgress = v.progress + 0.012;
        if (nextProgress >= 1) {
          const nextStop = v.currentStopIndex + 1;
          if (nextStop > v.endIndex || nextStop >= destinations.length) return { ...v, progress: 1, status: 'stopped' };
          return { ...v, progress: 0, currentStopIndex: nextStop, status: Math.random() > 0.85 ? 'stopped' : 'driving' };
        }
        if (nextProgress > 0.92 && v.status === 'driving' && Math.random() > 0.97) return { ...v, progress: nextProgress, status: 'stopped' };
        return { ...v, progress: nextProgress, status: 'driving' };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [destinations.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles(prev => prev.map(v => v.status === 'stopped' && Math.random() > 0.6 ? { ...v, status: 'driving' } : v));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Detect arrivals and notify
  useEffect(() => {
    const prev = prevVehiclesRef.current;
    if (!prev.length || !vehicles.length) { prevVehiclesRef.current = vehicles; return; }
    vehicles.forEach((v, idx) => {
      const prevV = prev[idx];
      if (!prevV) return;
      if (v.currentStopIndex > prevV.currentStopIndex && v.currentStopIndex <= destinations.length - 1) {
        const dest = destinations[v.currentStopIndex];
        if (dest) {
          pushToast(v.name, dest.name, v.color);
          addNotification(`${v.name} ha llegado`, `Ha llegado a ${dest.name} (${dest.address})`, 'route');
          supabase.from('route_stops').update({ status: 'completed' }).eq('id', dest.id);
          setDestinations(dPrev => dPrev.map(d => d.id === dest.id ? { ...d, visited: true } : d));
        }
      }
    });
    prevVehiclesRef.current = vehicles;
  }, [vehicles, destinations, pushToast, addNotification]);

  const addDestination = async () => {
    if (!newDest.name.trim() || !newDest.address.trim()) return;
    const tempId = Date.now();
    const tempDest: Destination = {
      id: tempId, name: newDest.name.trim(), address: newDest.address.trim(),
      phone: newDest.phone.trim() || '', notes: newDest.notes.trim() || '',
      order_num: destinations.length + 1, visited: false, created_by: profile.full_name || 'Sin asignar',
    };
    setDestinations(prev => { const u = [...prev, tempDest]; setVehicles(createDemoVehicles(u)); return u; });
    setShowAdd(false);
    setNewDest({ name: '', address: '', phone: '', notes: '' });
    setUserMapUrl(null);
    addNotification('Destino añadido', `${newDest.name.trim()} añadido a la ruta`, 'route');
    const { error } = await supabase.from('route_stops').insert({
      client: newDest.name.trim(), address: newDest.address.trim(),
      phone: newDest.phone.trim() || null, notes: newDest.notes.trim() || null,
      order_num: destinations.length + 1, status: 'pending',
      driver: profile.full_name || 'Sin asignar', route_id: null,
    });
    if (error) {
      setDestinations(prev => { const r = prev.filter(d => d.id !== tempId); setVehicles(createDemoVehicles(r)); return r; });
      addNotification('Error al añadir', error.message || 'No se pudo guardar', 'system');
    } else { fetchDestinations(); }
  };

  const removeDestination = async (id: number) => {
    const { error } = await supabase.from('route_stops').delete().eq('id', id);
    if (!error) { addNotification('Destino eliminado', 'Se quitó de la ruta', 'route'); setShowDelete(null); fetchDestinations(); }
  };

  const toggleVisited = async (id: number, visited: boolean) => {
    const { error } = await supabase.from('route_stops').update({ status: visited ? 'pending' : 'completed' }).eq('id', id);
    if (!error) setDestinations(prev => prev.map(d => d.id === id ? { ...d, visited: !visited } : d));
  };

  const confirmDelivery = async (dest: Destination, receptor: string, notes: string) => {
    const now = new Date();
    const hhmm = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const { error } = await supabase.from('route_stops').update({ status: 'completed' }).eq('id', dest.id);
    if (!error) {
      setDestinations(prev => prev.map(d => d.id === dest.id ? { ...d, visited: true, deliveredAt: now.toISOString(), deliveredTo: receptor || undefined, deliveryNotes: notes || undefined } : d));
      const repartidor = profile?.full_name || profile?.email || 'Repartidor';
      addNotification(`Entrega confirmada · ${dest.name}`, `${repartidor} entregó en ${dest.address} a las ${hhmm}${receptor ? ` · Recibido por ${receptor}` : ''}${notes ? ` · ${notes}` : ''}`, 'route');
      pushToast('Entrega', dest.name, '#10b981');
      setShowDelivery(null); setDeliveryReceptor(''); setDeliveryNotes('');
    }
  };

  const visitedCount = destinations.filter(d => d.visited).length;
  const addressesKey = useMemo(() => destinations.map(d => d.address).join('|'), [destinations]);
  const routeMapUrl = useMemo(() => getMapEmbedUrl(destinations.map(d => d.address)), [addressesKey]);
  const mapUrl = userMapUrl || routeMapUrl;
  const optimizedUrl = useMemo(() => getOptimizedRouteUrl(destinations.map(d => d.address)), [addressesKey]);
  const totalRouteMinutes = useMemo(() => destinations.reduce((acc, d) => acc + (d.estimated_minutes || getLegDistanceMinutes()), 0), [destinations]);
  const totalEstimatedKm = useMemo(() => Math.round(totalRouteMinutes * 0.45), [totalRouteMinutes]);

  const getVehicleETA = (vehicle: Vehicle) => {
    if (!destinations.length || vehicle.status === 'idle') return 0;
    return Math.max(0, (1 - vehicle.progress) * getLegDistanceMinutes());
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Cliente → vista de seguimiento simplificada
  if (isCliente) {
    return (
      <div className="space-y-4">
        <ArrivalToastContainer toasts={toasts} onClose={removeToast} />
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Rutas y Localización</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Sigue en tiempo real el trayecto de tu pedido
          </p>
        </div>
        <ClientTrackingView destinations={destinations} vehicles={vehicles} />
      </div>
    );
  }

  // Empresa / Empleado → vista completa de administración
  return (
    <div className="space-y-4">
      <ArrivalToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Rutas y Localización</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {destinations.length} paradas &middot; {visitedCount} completadas &middot; {totalEstimatedKm} km estimados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={getUserLocation}
            disabled={locLoading}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {locLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ri-crosshair-line" />}
            </div>
            {locLoading ? 'Localizando...' : 'Mi ubicación'}
          </button>
          {destinations.length > 1 && (
            <a href={optimizedUrl} target="_blank" rel="noopener noreferrer nofollow"
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-route-line" /></div>
              Ruta optimizada
            </a>
          )}
          <a href={destinations.length > 0 ? getNavigationUrl(destinations[0].address) : '#'} target="_blank" rel="noopener noreferrer nofollow"
            className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-all flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-navigation-line" /></div>
            Navegar
          </a>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
            Añadir parada
          </button>
        </div>
      </div>

      {/* Geolocation error */}
      {geolocationError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-600 dark:text-red-400">
          <i className="ri-error-warning-line" />
          {geolocationError}
          <button onClick={getUserLocation} className="underline ml-auto text-xs">Reintentar</button>
        </div>
      )}

      {/* GPS badge */}
      {userLocation && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 rounded-lg text-sm text-purple-700 dark:text-purple-400">
          <i className="ri-map-pin-user-line" />
          <span className="font-medium">Tu ubicación:</span>
          Lat {userLocation.lat.toFixed(5)}, Lng {userLocation.lng.toFixed(5)}
          <span className="ml-auto text-xs text-purple-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse inline-block" />
            En vivo
          </span>
        </div>
      )}

      {/* Stats */}
      {destinations.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: 'ri-pin-distance-line', color: 'orange', label: 'Distancia', value: `${totalEstimatedKm} km` },
            { icon: 'ri-time-line', color: 'blue', label: 'Tiempo estimado', value: formatETA(totalRouteMinutes) },
            { icon: 'ri-checkbox-circle-line', color: 'green', label: 'Completadas', value: `${visitedCount} / ${destinations.length}` },
            { icon: 'ri-truck-line', color: 'amber', label: 'Vehículos activos', value: `${vehicles.filter(v => v.status !== 'idle').length} / ${vehicles.length}` },
          ].map(({ icon, color, label, value }) => (
            <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-8 h-8 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 flex items-center justify-center`}>
                  <i className={`${icon} text-${color}-500 text-sm`} />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">{label}</span>
              </div>
              <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trajectory strip */}
      <TrajectoryStrip destinations={destinations} vehicles={vehicles} />

      {/* Vehicles status */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {vehicles.map(vehicle => {
            const eta = getVehicleETA(vehicle);
            const progressPercent = Math.round(vehicle.progress * 100);
            const stopsCompleted = Math.max(0, vehicle.currentStopIndex - vehicle.startIndex);
            const totalStops = vehicle.endIndex - vehicle.startIndex + 1;
            const fromDest = destinations[vehicle.currentStopIndex];
            const toDest = destinations[Math.min(vehicle.currentStopIndex + 1, destinations.length - 1)];

            return (
              <div key={vehicle.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: vehicle.color + '20', color: vehicle.color }}>
                      <i className="ri-truck-line text-lg" />
                    </div>
                    {vehicle.status === 'driving' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: vehicle.color }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">{vehicle.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{vehicle.driver}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${vehicle.status === 'driving' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : vehicle.status === 'stopped' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {vehicle.status === 'driving' && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" /></span>}
                    {vehicle.status === 'driving' ? 'En ruta' : vehicle.status === 'stopped' ? 'Entregando' : 'Inactivo'}
                  </span>
                </div>

                {/* Route leg */}
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mb-2">
                  <span className="font-medium text-gray-600 dark:text-slate-300 truncate max-w-[40%]">{fromDest?.name || 'Origen'}</span>
                  <i className="ri-arrow-right-line flex-shrink-0" />
                  <span className="font-medium text-gray-600 dark:text-slate-300 truncate max-w-[40%]">{toDest?.name || 'Destino'}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Parada {stopsCompleted + 1}/{totalStops} &middot; {vehicle.speed} km/h</p>

                {/* Progress */}
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-slate-700" />
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke={vehicle.color} strokeWidth="3" strokeDasharray={`${progressPercent} ${100 - progressPercent}`} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-gray-700 dark:text-slate-200">{progressPercent}%</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden relative mb-1.5">
                      {vehicle.status === 'driving' && <MovingDashes color={vehicle.color} />}
                      <div className="h-full rounded-full transition-all duration-1000 ease-linear relative z-10" style={{ width: `${progressPercent}%`, backgroundColor: vehicle.color }} />
                    </div>
                    <div className="flex items-center gap-1">
                      <i className="ri-time-line text-gray-400 text-xs" />
                      <span className="text-xs font-medium text-gray-700 dark:text-slate-200">ETA: {formatETA(eta)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Map + route list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden" style={{ height: 520 }}>
          <iframe key={mapUrl} src={mapUrl} width="100%" height="100%" style={{ border: 0, height: '100%' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="w-full block" />
        </div>

        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden" style={{ height: 520 }}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-slate-100 text-sm">Ruta completa</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatETA(totalRouteMinutes)} total &middot; {totalEstimatedKm} km</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">{visitedCount}/{destinations.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {destinations.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-slate-500">
                <i className="ri-route-line text-3xl mb-2 block" />
                <p className="text-sm">Sin paradas aún</p>
                <p className="text-xs mt-1">Añade la primera parada de la ruta</p>
              </div>
            ) : destinations.map((dest, idx) => {
              const vehicle = getVehicleForStop(vehicles, idx);
              const eta = vehicle && !dest.visited ? getVehicleETA(vehicle) : null;
              const isLast = idx === destinations.length - 1;
              const legTime = !isLast ? (dest.estimated_minutes || getLegDistanceMinutes()) : 0;

              return (
                <div key={dest.id}>
                  <div className="flex gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <button
                        onClick={() => toggleVisited(dest.id, dest.visited)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${dest.visited ? 'bg-green-500 border-green-500 text-white' : vehicle ? 'text-white' : 'border-gray-300 dark:border-slate-600 hover:border-orange-400'}`}
                        style={!dest.visited && vehicle ? { borderColor: vehicle.color, backgroundColor: vehicle.color } : {}}
                      >
                        {dest.visited ? <i className="ri-check-line text-xs" /> : vehicle ? <i className="ri-truck-line text-xs" /> : <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{idx + 1}</span>}
                      </button>
                      {!isLast && <div className={`w-0.5 flex-1 min-h-[24px] mt-1 ${dest.visited ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-slate-700'}`} />}
                    </div>

                    {/* Card */}
                    <div className="flex-1 pb-3">
                      <div className={`p-3 rounded-lg border transition-all ${dest.visited ? 'bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' : 'bg-gray-50 dark:bg-slate-800/60 border-gray-100 dark:border-slate-700'}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium truncate ${dest.visited ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'}`}>{dest.name}</p>
                              {vehicle && !dest.visited && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: vehicle.color }}>{vehicle.name}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{dest.address}</p>
                            {dest.phone && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-1"><i className="ri-phone-line" />{dest.phone}</p>}
                            {vehicle && !dest.visited && eta !== null && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: vehicle.color }} />
                                <span className="text-xs font-semibold" style={{ color: vehicle.color }}>Llegada: {formatETA(eta)}</span>
                              </div>
                            )}
                            {dest.visited && dest.deliveredAt && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                                <i className="ri-check-double-line" />
                                <span className="font-semibold">Entregado {new Date(dest.deliveredAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}{dest.deliveredTo ? ` · ${dest.deliveredTo}` : ''}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <a href={getNavigationUrl(dest.address)} target="_blank" rel="noopener noreferrer nofollow"
                              className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30">
                              <i className="ri-map-pin-2-line text-sm" />
                            </a>
                            <button onClick={() => setShowDelete(dest.id)}
                              className="w-7 h-7 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30">
                              <i className="ri-delete-bin-line text-sm" />
                            </button>
                          </div>
                        </div>
                        {!dest.visited && (
                          <button
                            onClick={() => { setDeliveryReceptor(''); setDeliveryNotes(''); setShowDelivery(dest); }}
                            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
                          >
                            <i className="ri-check-double-line text-base" />
                            He entregado
                          </button>
                        )}
                      </div>
                      {!isLast && legTime > 0 && (
                        <div className="flex items-center gap-2 mt-1 ml-3">
                          <i className="ri-time-line text-gray-400 text-[10px]" />
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">{legTime} min hasta siguiente parada</span>
                          {vehicle && <span className="text-[10px] font-medium" style={{ color: vehicle.color }}>&middot; {vehicle.speed} km/h</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm Delivery Modal */}
      <Modal isOpen={!!showDelivery} onClose={() => setShowDelivery(null)} size="md"
        title={<span className="text-green-700 dark:text-green-400"><i className="ri-check-double-line mr-1" />Confirmar entrega</span>}>
        {showDelivery && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50/60 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg">
              <p className="font-semibold text-gray-800 dark:text-slate-100">{showDelivery.name}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{showDelivery.address}</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-2">Se notificará a la empresa con hora exacta y datos de entrega.</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">¿Quién recibe? <span className="text-gray-400 text-xs">(opcional)</span></label>
              <input type="text" value={deliveryReceptor} onChange={e => setDeliveryReceptor(e.target.value)} placeholder="Ej: Antonio Pérez" className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Observaciones <span className="text-gray-400 text-xs">(opcional)</span></label>
              <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows={2} placeholder="Ej: Mercancía revisada sin incidencias." className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button onClick={() => setShowDelivery(null)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
              <button onClick={() => confirmDelivery(showDelivery, deliveryReceptor.trim(), deliveryNotes.trim())} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
                <i className="ri-check-double-line" />Confirmar entrega
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Destination Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Añadir parada" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Nombre del cliente</label>
            <input type="text" placeholder="Ej: Restaurante La Luna..." value={newDest.name} onChange={e => setNewDest({ ...newDest, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Dirección completa</label>
            <input type="text" placeholder="Calle, número, ciudad..." value={newDest.address} onChange={e => setNewDest({ ...newDest, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Teléfono (opcional)</label>
              <input type="tel" placeholder="+34 600 11 22 33" value={newDest.phone} onChange={e => setNewDest({ ...newDest, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Notas (opcional)</label>
              <input type="text" placeholder="Instrucciones de entrega..." value={newDest.notes} onChange={e => setNewDest({ ...newDest, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={addDestination} disabled={!newDest.name || !newDest.address} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">Añadir parada</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDelete !== null} onClose={() => setShowDelete(null)} title="Eliminar parada" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-400">¿Seguro que quieres eliminar esta parada? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDelete(null)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={() => showDelete !== null && removeDestination(showDelete)} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">Eliminar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
