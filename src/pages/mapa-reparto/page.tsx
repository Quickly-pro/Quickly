import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { useRole } from '@/hooks/useRole';
import { useNotificationsContext } from '@/context/NotificationsContext';
import Modal from '@/components/base/Modal';
import SignaturePad from '@/components/base/SignaturePad';
import CameraCapture from '@/components/base/CameraCapture';
import LiveRouteMap, { type MapStop, type MapDriver } from '@/components/base/LiveRouteMap';
import { geocodeAddresses } from '@/lib/geocoding';
import { optimizeRoute, haversineKm } from '@/lib/routeOptimizer';
import { useLiveLocationBroadcast } from '@/hooks/useLiveLocationBroadcast';
import { useCompanyDriverLocations } from '@/hooks/useCompanyDriverLocations';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
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
  photoUrl?: string;
  trackingToken?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getNavigationUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Distancia/tiempo real entre dos paradas geocodificadas (fórmula de
// Haversine, la misma que usa el optimizador de rutas) — antes esto se
// generaba con Math.random(), lo que además de ser un dato falso alimentaba
// una "flota" simulada que llegó a marcar entregas como completadas en la
// base de datos sin que hubieran ocurrido de verdad.
function computeLegKm(a?: Destination, b?: Destination): number {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return 0;
  return haversineKm({ id: a.id, lat: a.lat, lng: a.lng }, { id: b.id, lat: b.lat, lng: b.lng });
}

const AVG_DELIVERY_SPEED_KMH = 30;
function minutesForKm(km: number): number {
  return km > 0 ? (km / AVG_DELIVERY_SPEED_KMH) * 60 : 0;
}

function withEstimatedMinutes(destinations: Destination[]): Destination[] {
  return destinations.map((d, i) => ({
    ...d,
    estimated_minutes: i === 0 ? 0 : minutesForKm(computeLegKm(destinations[i - 1], d)),
  }));
}

function formatETA(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${Math.ceil(minutes)} min`;
  return `${Math.floor(minutes / 60)}h ${Math.ceil(minutes % 60)}m`;
}

// ── Client tracking view ────────────────────────────────────────────────────
function ClientTrackingView({ destinations, mapStops, mapDrivers }: { destinations: Destination[]; mapStops: MapStop[]; mapDrivers: MapDriver[] }) {
  const visitedCount = destinations.filter(d => d.visited).length;
  const totalStops = destinations.length;
  const progressPercent = totalStops > 1 ? Math.round((visitedCount / (totalStops - 1)) * 100) : 0;
  const nextStop = destinations.find(d => !d.visited) || null;
  const activeDriversCount = mapDrivers.filter(d => d.fresh).length;

  return (
    <div className="space-y-4">
      {totalStops > 0 ? (
        <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800/40 p-5">
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-500/20">
                <i className="ri-truck-line text-2xl text-orange-500" />
              </div>
              {activeDriversCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-white" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeDriversCount > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                {activeDriversCount > 0 ? `● ${activeDriversCount} repartidor${activeDriversCount !== 1 ? 'es' : ''} en ruta` : 'Sin repartidores en ruta ahora mismo'}
              </span>
            </div>
          </div>

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

          {nextStop && (
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
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">No hay paradas programadas en este momento</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
          <i className="ri-map-2-line text-orange-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">Mapa de la ruta</span>
        </div>
        <LiveRouteMap stops={mapStops} drivers={mapDrivers} height={340} />
      </div>

      {destinations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Paradas de la ruta</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {destinations.map((dest, idx) => (
              <div key={dest.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${dest.visited ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                  {dest.visited ? <i className="ri-check-line" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${dest.visited ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'}`}>{dest.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{dest.address}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${dest.visited ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                  {dest.visited ? 'Entregado' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MapaReparto() {
  const { profile } = useProfile();
  const { isCliente, isEmpleado } = useRole();
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
  const [deliveryPhotoFile, setDeliveryPhotoFile] = useState<File | null>(null);
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [newDest, setNewDest] = useState({ name: '', address: '', phone: '', notes: '' });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);

  // Optimización de rutas
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState({ done: 0, total: 0 });
  const [optimizeResult, setOptimizeResult] = useState<{ savedKm: number; savedPercent: number } | null>(null);

  // Enlace de seguimiento público
  const [showTrackingLink, setShowTrackingLink] = useState<Destination | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // GPS real: los empleados con paradas pendientes transmiten su ubicación;
  // todos los demás (empresa, otros empleados, cliente) la leen en vivo.
  const hasPendingStops = destinations.some(d => !d.visited);
  useLiveLocationBroadcast(isEmpleado && hasPendingStops);
  const { byName: driverLocsByName, isFresh } = useCompanyDriverLocations();

  const mapStops: MapStop[] = useMemo(() => destinations.map(d => ({
    id: d.id, name: d.name, address: d.address, lat: d.lat, lng: d.lng, visited: d.visited, driver: d.created_by,
  })), [destinations]);

  const mapDrivers: MapDriver[] = useMemo(() => Object.values(driverLocsByName).map(loc => ({
    name: loc.driver_name || '',
    lat: loc.lat,
    lng: loc.lng,
    fresh: isFresh(loc),
    speedKmh: loc.speed_kmh,
  })), [driverLocsByName, isFresh]);

  // Modo sin conexión: confirmar entregas y añadir paradas se guardan
  // localmente si no hay señal, y se sincronizan solos al recuperarla.
  const { isOnline, queueLength, enqueue } = useOfflineQueue('quickly_offline_rutas', {
    confirm_delivery: async (payload: any) => {
      let photoUrl: string | null = null;
      if (payload.photoBase64) {
        const blob = await (await fetch(payload.photoBase64)).blob();
        const path = `${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from('delivery-proofs').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
        if (!upErr) {
          const { data: pub } = supabase.storage.from('delivery-proofs').getPublicUrl(path);
          photoUrl = pub.publicUrl;
        }
      }
      const { error } = await supabase.from('route_stops').update({
        status: 'completed',
        delivered_at: payload.deliveredAt,
        delivered_to: payload.receptor || null,
        delivery_notes: payload.notes || null,
        photo_url: photoUrl,
        signature_data: payload.signatureData || null,
      }).eq('id', payload.stopId);
      if (error) throw error;
    },
    add_stop: async (payload: any) => {
      const { error } = await supabase.from('route_stops').insert({
        client: payload.name, address: payload.address, phone: payload.phone || null, notes: payload.notes || null,
        order_num: 9999, status: 'pending', driver: payload.driver || 'Sin asignar', route_id: null,
      });
      if (error) throw error;
    },
  });

  useEffect(() => {
    if (isOnline && queueLength > 0) {
      addNotification('Sincronizando', `${queueLength} acción${queueLength !== 1 ? 'es' : ''} pendiente${queueLength !== 1 ? 's' : ''} de cuando no había conexión…`, 'system');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchDestinations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('route_stops').select('*').order('order_num');
    if (error) console.error('Error cargando paradas de la ruta:', error);
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
        deliveredAt: d.delivered_at || undefined,
        deliveredTo: d.delivered_to || undefined,
        deliveryNotes: d.delivery_notes || undefined,
        photoUrl: d.photo_url || undefined,
        trackingToken: d.tracking_token || undefined,
      }));
      setDestinations(withEstimatedMinutes(mapped));
    } else {
      setDestinations([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDestinations(); }, [fetchDestinations]);

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
        addNotification('Mi ubicación', `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`, 'route');
      },
      err => {
        setLocLoading(false);
        setGeolocationError(err.code === err.PERMISSION_DENIED ? 'Permiso denegado. Activa la ubicación.' : 'No se pudo obtener tu ubicación.');
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );
  }, [addNotification]);

  const addDestination = async () => {
    if (!newDest.name.trim() || !newDest.address.trim()) return;
    const tempId = Date.now();
    const tempDest: Destination = {
      id: tempId, name: newDest.name.trim(), address: newDest.address.trim(),
      phone: newDest.phone.trim() || '', notes: newDest.notes.trim() || '',
      order_num: destinations.length + 1, visited: false, created_by: profile.full_name || 'Sin asignar',
    };
    setDestinations(prev => [...prev, tempDest]);
    setShowAdd(false);
    setNewDest({ name: '', address: '', phone: '', notes: '' });
    addNotification('Destino añadido', `${newDest.name.trim()} añadido a la ruta`, 'route');
    const { error } = await supabase.from('route_stops').insert({
      client: newDest.name.trim(), address: newDest.address.trim(),
      phone: newDest.phone.trim() || null, notes: newDest.notes.trim() || null,
      order_num: destinations.length + 1, status: 'pending',
      driver: profile.full_name || 'Sin asignar', route_id: null,
    });
    if (error) {
      setDestinations(prev => prev.filter(d => d.id !== tempId));
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

  // ── Optimizar orden de la ruta (algoritmo propio) ─────────────────────
  const handleOptimizeRoute = useCallback(async () => {
    if (destinations.length < 3) return;
    setOptimizing(true);
    setOptimizeResult(null);
    setOptimizeProgress({ done: 0, total: destinations.length });

    const geocoded = await geocodeAddresses(
      destinations.map(d => d.address),
      (done, total) => setOptimizeProgress({ done, total })
    );

    const points = destinations
      .map(d => {
        const g = (d.lat && d.lng) ? { lat: d.lat, lng: d.lng } : geocoded.get(d.address.trim());
        return g ? { id: d.id, lat: g.lat, lng: g.lng } : null;
      })
      .filter((p): p is { id: number; lat: number; lng: number } => p !== null);

    if (points.length < 3) {
      setOptimizing(false);
      addNotification('No se pudo optimizar', 'No se localizaron suficientes direcciones para calcular la mejor ruta. Revisa que estén completas.', 'system');
      return;
    }

    const result = optimizeRoute(points);

    await Promise.all(result.ordered.map((p, idx) =>
      supabase.from('route_stops').update({ order_num: idx + 1, lat: p.lat, lng: p.lng }).eq('id', p.id)
    ));

    setOptimizeResult({ savedKm: result.savedKm, savedPercent: result.savedPercent });
    setOptimizing(false);
    fetchDestinations();
  }, [destinations, addNotification, fetchDestinations]);

  // ── Prueba de entrega (foto + firma) ──────────────────────────────────
  const handleCameraCapture = (file: File) => {
    setDeliveryPhotoFile(file);
    setDeliveryPhotoPreview(URL.createObjectURL(file));
    setShowCamera(false);
  };

  const confirmDelivery = async (dest: Destination, receptor: string, notes: string) => {
    const now = new Date();

    // Sin conexión: guardar localmente y sincronizar después
    if (!isOnline) {
      let photoBase64: string | null = null;
      if (deliveryPhotoFile) {
        photoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(deliveryPhotoFile);
        });
      }
      enqueue('confirm_delivery', {
        stopId: dest.id,
        deliveredAt: now.toISOString(),
        receptor: receptor || null,
        notes: notes || null,
        photoBase64,
        signatureData,
      });
      setDestinations(prev => prev.map(d => d.id === dest.id ? {
        ...d, visited: true, deliveredAt: now.toISOString(), deliveredTo: receptor || undefined, deliveryNotes: notes || undefined,
      } : d));
      addNotification('Guardado sin conexión', `La entrega de ${dest.name} se sincronizará automáticamente cuando vuelva la señal.`, 'route');
      setShowDelivery(null); setDeliveryReceptor(''); setDeliveryNotes('');
      setDeliveryPhotoFile(null); setDeliveryPhotoPreview(null); setSignatureData(null);
      return;
    }

    setUploadingProof(true);
    let photoUrl: string | null = null;

    if (deliveryPhotoFile) {
      const ext = deliveryPhotoFile.name.split('.').pop() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('delivery-proofs')
        .upload(path, deliveryPhotoFile, { contentType: deliveryPhotoFile.type });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('delivery-proofs').getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }
    }

    const hhmm = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const { error } = await supabase.from('route_stops').update({
      status: 'completed',
      delivered_at: now.toISOString(),
      delivered_to: receptor || null,
      delivery_notes: notes || null,
      photo_url: photoUrl,
      signature_data: signatureData,
    }).eq('id', dest.id);

    setUploadingProof(false);
    if (!error) {
      setDestinations(prev => prev.map(d => d.id === dest.id ? {
        ...d, visited: true, deliveredAt: now.toISOString(), deliveredTo: receptor || undefined,
        deliveryNotes: notes || undefined, photoUrl: photoUrl || undefined,
      } : d));
      const repartidor = profile?.full_name || profile?.email || 'Repartidor';
      addNotification(`Entrega confirmada · ${dest.name}`, `${repartidor} entregó en ${dest.address} a las ${hhmm}${receptor ? ` · Recibido por ${receptor}` : ''}${notes ? ` · ${notes}` : ''}`, 'route');
      pushToast('Entrega', dest.name, '#10b981');
      setShowDelivery(null); setDeliveryReceptor(''); setDeliveryNotes('');
      setDeliveryPhotoFile(null); setDeliveryPhotoPreview(null); setSignatureData(null);
    }
  };

  const visitedCount = destinations.filter(d => d.visited).length;
  const totalRouteMinutes = useMemo(() => destinations.reduce((acc, d) => acc + (d.estimated_minutes || 0), 0), [destinations]);
  const totalEstimatedKm = useMemo(() => Math.round(destinations.reduce((acc, d, i) => i === 0 ? acc : acc + computeLegKm(destinations[i - 1], d), 0)), [destinations]);

  // ── Confirmar entrega SIN detalles (rápido, sin abrir el formulario) ──
  const confirmDeliveryQuick = async (dest: Destination) => {
    const now = new Date();
    const hhmm = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (!isOnline) {
      enqueue('confirm_delivery', {
        stopId: dest.id, deliveredAt: now.toISOString(),
        receptor: null, notes: null, photoBase64: null, signatureData: null,
      });
      setDestinations(prev => prev.map(d => d.id === dest.id ? { ...d, visited: true, deliveredAt: now.toISOString() } : d));
      addNotification('Guardado sin conexión', `La entrega de ${dest.name} se sincronizará automáticamente cuando vuelva la señal.`, 'route');
      return;
    }

    const { error } = await supabase.from('route_stops').update({
      status: 'completed',
      delivered_at: now.toISOString(),
      delivered_to: null,
      delivery_notes: null,
      photo_url: null,
      signature_data: null,
    }).eq('id', dest.id);

    if (!error) {
      setDestinations(prev => prev.map(d => d.id === dest.id ? { ...d, visited: true, deliveredAt: now.toISOString() } : d));
      const repartidor = profile?.full_name || profile?.email || 'Repartidor';
      addNotification(`Entrega confirmada · ${dest.name}`, `${repartidor} entregó en ${dest.address} a las ${hhmm} (sin detalles adicionales)`, 'route');
      pushToast('Entrega', dest.name, '#10b981');
    }
  };

  const trackingUrl = (dest: Destination) =>
    dest.trackingToken ? `${window.location.origin}/seguimiento/${dest.trackingToken}` : '';

  const copyTrackingLink = (dest: Destination) => {
    const url = trackingUrl(dest);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

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
        <ClientTrackingView destinations={destinations} mapStops={mapStops} mapDrivers={mapDrivers} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ArrivalToastContainer toasts={toasts} onClose={removeToast} />

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
            <button
              onClick={handleOptimizeRoute}
              disabled={optimizing}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {optimizing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ri-route-line" />}
              </div>
              {optimizing ? `Calculando... ${optimizeProgress.done}/${optimizeProgress.total}` : 'Optimizar ruta'}
            </button>
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

      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 dark:bg-slate-800 border border-gray-700 dark:border-slate-600 rounded-lg text-sm text-white">
          <i className="ri-wifi-off-line" />
          Sin conexión — las entregas que confirmes se guardarán en el teléfono y se sincronizarán solas al volver la señal.
        </div>
      )}

      {isOnline && queueLength > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg text-sm text-blue-700 dark:text-blue-400">
          <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
          Sincronizando {queueLength} entrega{queueLength !== 1 ? 's' : ''} guardadas sin conexión…
        </div>
      )}

      {optimizeResult && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg text-sm text-blue-700 dark:text-blue-400">
          <i className="ri-route-line" />
          {optimizeResult.savedKm > 0.1
            ? <span>Ruta reordenada — te ahorras <strong>{optimizeResult.savedKm.toFixed(1)} km</strong> ({optimizeResult.savedPercent}%) frente al orden anterior.</span>
            : <span>La ruta ya estaba en un orden eficiente — no había margen de mejora.</span>}
          <button onClick={() => setOptimizeResult(null)} className="ml-auto text-xs underline">Cerrar</button>
        </div>
      )}

      {geolocationError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-600 dark:text-red-400">
          <i className="ri-error-warning-line" />
          {geolocationError}
          <button onClick={getUserLocation} className="underline ml-auto text-xs">Reintentar</button>
        </div>
      )}

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

      {destinations.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: 'ri-pin-distance-line', color: 'orange', label: 'Distancia', value: `${totalEstimatedKm} km` },
            { icon: 'ri-time-line', color: 'blue', label: 'Tiempo estimado', value: formatETA(totalRouteMinutes) },
            { icon: 'ri-checkbox-circle-line', color: 'green', label: 'Completadas', value: `${visitedCount} / ${destinations.length}` },
            { icon: 'ri-truck-line', color: 'amber', label: 'Repartidores en ruta', value: `${mapDrivers.filter(d => d.fresh).length}` },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden" style={{ height: 520 }}>
          <LiveRouteMap stops={mapStops} drivers={mapDrivers} height={520} userLocation={userLocation} />
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
              const isLast = idx === destinations.length - 1;
              const legTime = !isLast ? (dest.estimated_minutes || 0) : 0;

              return (
                <div key={dest.id}>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <button
                        onClick={() => toggleVisited(dest.id, dest.visited)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${dest.visited ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-slate-600 hover:border-orange-400'}`}
                      >
                        {dest.visited ? <i className="ri-check-line text-xs" /> : <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{idx + 1}</span>}
                      </button>
                      {!isLast && <div className={`w-0.5 flex-1 min-h-[24px] mt-1 ${dest.visited ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-slate-700'}`} />}
                    </div>

                    <div className="flex-1 pb-3">
                      <div className={`p-3 rounded-lg border transition-all ${dest.visited ? 'bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' : 'bg-gray-50 dark:bg-slate-800/60 border-gray-100 dark:border-slate-700'}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium truncate ${dest.visited ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'}`}>{dest.name}</p>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{dest.address}</p>
                            {dest.phone && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-1"><i className="ri-phone-line" />{dest.phone}</p>}
                            {dest.visited && dest.deliveredAt && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                                <i className="ri-check-double-line" />
                                <span className="font-semibold">Entregado {new Date(dest.deliveredAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}{dest.deliveredTo ? ` · ${dest.deliveredTo}` : ''}</span>
                              </div>
                            )}
                            {dest.visited && dest.photoUrl && (
                              <a href={dest.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                <i className="ri-image-line" /> Ver foto de entrega
                              </a>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={() => setShowTrackingLink(dest)} title="Compartir seguimiento con el cliente"
                              className="w-7 h-7 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900/30">
                              <i className="ri-share-line text-sm" />
                            </button>
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
                        {!dest.visited && isEmpleado && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => { setDeliveryReceptor(''); setDeliveryNotes(''); setDeliveryPhotoFile(null); setDeliveryPhotoPreview(null); setSignatureData(null); setShowCamera(false); setShowDelivery(dest); }}
                              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
                            >
                              <i className="ri-check-double-line text-base" />
                              Con detalles
                            </button>
                            <button
                              onClick={() => confirmDeliveryQuick(dest)}
                              title="Confirma la entrega sin foto, firma ni notas"
                              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
                            >
                              <i className="ri-check-line text-base" />
                              Sin detalles
                            </button>
                          </div>
                        )}
                      </div>
                      {!isLast && legTime > 0 && (
                        <div className="flex items-center gap-2 mt-1 ml-3">
                          <i className="ri-time-line text-gray-400 text-[10px]" />
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">{Math.round(legTime)} min hasta siguiente parada</span>
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
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Foto de la entrega <span className="text-gray-400 text-xs">(opcional)</span></label>
              {deliveryPhotoPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                  <img src={deliveryPhotoPreview} alt="Foto de entrega" className="w-full h-32 object-cover" />
                  <button type="button" onClick={() => { setDeliveryPhotoFile(null); setDeliveryPhotoPreview(null); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80">
                    <i className="ri-close-line text-xs" />
                  </button>
                </div>
              ) : showCamera ? (
                <CameraCapture onCapture={handleCameraCapture} onCancel={() => setShowCamera(false)} />
              ) : (
                <button type="button" onClick={() => setShowCamera(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg py-3 text-sm text-gray-500 dark:text-slate-400 hover:border-green-300">
                  <i className="ri-camera-line" /> Tomar o subir foto
                </button>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Firma de recepción <span className="text-gray-400 text-xs">(opcional)</span></label>
              <SignaturePad onChange={setSignatureData} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button onClick={() => { setShowDelivery(null); setShowCamera(false); }} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
              <button
                onClick={() => confirmDelivery(showDelivery, deliveryReceptor.trim(), deliveryNotes.trim())}
                disabled={uploadingProof}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-60"
              >
                {uploadingProof
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <i className="ri-check-double-line" />}
                {uploadingProof ? 'Guardando...' : 'Confirmar entrega'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Tracking link share modal */}
      <Modal isOpen={!!showTrackingLink} onClose={() => setShowTrackingLink(null)} title="Compartir seguimiento" size="sm">
        {showTrackingLink && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Envía este enlace a <strong>{showTrackingLink.name}</strong> por WhatsApp o email — podrá ver el estado de su entrega sin necesidad de crear cuenta.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-700 dark:text-slate-200 truncate">
                {trackingUrl(showTrackingLink)}
              </code>
              <button onClick={() => copyTrackingLink(showTrackingLink)} className="px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 whitespace-nowrap">
                {linkCopied ? '¡Copiado!' : 'Copiar'}
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
