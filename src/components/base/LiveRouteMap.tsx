import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapStop {
  id: number | string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  visited: boolean;
  driver?: string;
}

export interface MapDriver {
  name: string;
  lat: number;
  lng: number;
  fresh: boolean; // tuvo señal reciente (últimos ~2 min)
  speedKmh?: number | null;
}

interface Props {
  stops: MapStop[];
  drivers: MapDriver[];
  height?: number;
  userLocation?: { lat: number; lng: number } | null;
}

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038]; // Madrid

function stopIcon(index: number, visited: boolean, hasDriver: boolean) {
  const bg = visited ? '#22c55e' : hasDriver ? '#3b82f6' : '#f97316';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;background:${bg};
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:700;font-size:12px;
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">${visited ? '✓' : index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function driverIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50%;background:${color};
      display:flex;align-items:center;justify-content:center;
      border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);
      position:relative;
    ">
      <span style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.35;animation:pulseDot 1.6s ease-out infinite;"></span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M3 13h1V6a2 2 0 012-2h9a2 2 0 012 2v2h2.28a1 1 0 01.9.55L22 12v5a1 1 0 01-1 1h-1a2.5 2.5 0 01-5 0H9a2.5 2.5 0 01-5 0H3a1 1 0 01-1-1v-3a1 1 0 011-1zm3 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM15 6H6v6h9V6z"/></svg>
    </div>
    <style>@keyframes pulseDot{0%{transform:scale(0.8);opacity:0.5}100%{transform:scale(1.8);opacity:0}}</style>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const DRIVER_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444'];

/**
 * Mapa interactivo real (OpenStreetMap vía Leaflet — gratuito, sin clave
 * de API), con marcadores de paradas y la posición GPS EN VIVO de los
 * repartidores que la estén compartiendo. Sustituye al iframe estático
 * de Google Maps que había antes.
 */
export default function LiveRouteMap({ stops, drivers, height = 420, userLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redibujar marcadores cuando cambien los datos
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerGroupRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    const geocodedStops = stops.filter((s): s is MapStop & { lat: number; lng: number } => !!s.lat && !!s.lng);

    geocodedStops.forEach((stop, idx) => {
      const hasDriver = drivers.some(d => d.name === stop.driver);
      const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon(idx, stop.visited, hasDriver) });
      marker.bindPopup(`<strong>${stop.name}</strong><br/>${stop.address}`);
      layer.addLayer(marker);
      bounds.push([stop.lat, stop.lng]);
    });

    if (geocodedStops.length >= 2) {
      const line = L.polyline(geocodedStops.map(s => [s.lat, s.lng]), { color: '#f97316', weight: 3, opacity: 0.6, dashArray: '6 6' });
      layer.addLayer(line);
    }

    drivers.forEach((driver, i) => {
      const color = driver.fresh ? DRIVER_COLORS[i % DRIVER_COLORS.length] : '#9ca3af';
      const marker = L.marker([driver.lat, driver.lng], { icon: driverIcon(color) });
      marker.bindPopup(`<strong>${driver.name}</strong><br/>${driver.fresh ? 'En línea' : 'Sin señal reciente'}${driver.speedKmh ? ` · ${driver.speedKmh} km/h` : ''}`);
      layer.addLayer(marker);
      bounds.push([driver.lat, driver.lng]);
    });

    if (userLocation) {
      const marker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8, color: '#a855f7', fillColor: '#a855f7', fillOpacity: 0.6, weight: 2,
      });
      marker.bindPopup('Tu ubicación');
      layer.addLayer(marker);
      bounds.push([userLocation.lat, userLocation.lng]);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds as any, { padding: [40, 40], maxZoom: 15 });
    }
  }, [stops, drivers, userLocation]);

  const hasAnyCoords = stops.some(s => s.lat && s.lng) || drivers.length > 0;

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />
      {!hasAnyCoords && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 pointer-events-none rounded-xl">
          <div className="text-center px-6">
            <i className="ri-map-pin-line text-3xl text-gray-300 dark:text-slate-600 mb-2 block" />
            <p className="text-sm text-gray-500 dark:text-slate-400">Pulsa "Optimizar ruta" para localizar las paradas en el mapa</p>
          </div>
        </div>
      )}
    </div>
  );
}
