/**
 * Geocodificación de direcciones (texto → coordenadas lat/lng).
 *
 * Usa Nominatim (OpenStreetMap) — es gratuito y no necesita clave de API,
 * pero pide no hacer más de 1 petición por segundo y siempre poner un
 * User-Agent identificable (ya incluido abajo). Para un negocio pequeño
 * es más que suficiente; si en el futuro quieres más precisión o volumen,
 * se puede cambiar por la API de Google Geocoding (de pago, con clave).
 */

export interface GeocodedPoint {
  lat: number;
  lng: number;
}

const geocodeCache = new Map<string, GeocodedPoint | null>();

export async function geocodeAddress(address: string): Promise<GeocodedPoint | null> {
  const key = address.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es' },
    });
    if (!res.ok) { geocodeCache.set(key, null); return null; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) { geocodeCache.set(key, null); return null; }
    const point: GeocodedPoint = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    geocodeCache.set(key, point);
    return point;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

/**
 * Geocodifica una lista de direcciones respetando el límite de Nominatim
 * (1 petición/segundo). Devuelve un mapa dirección → coordenadas (o null
 * si no se pudo localizar esa dirección concreta).
 */
export async function geocodeAddresses(
  addresses: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, GeocodedPoint | null>> {
  const results = new Map<string, GeocodedPoint | null>();
  const unique = Array.from(new Set(addresses.map(a => a.trim())));

  for (let i = 0; i < unique.length; i++) {
    const addr = unique[i];
    const point = await geocodeAddress(addr);
    results.set(addr, point);
    onProgress?.(i + 1, unique.length);
    if (i < unique.length - 1) {
      await new Promise(r => setTimeout(r, 1100)); // respeta 1 req/seg
    }
  }

  return results;
}
