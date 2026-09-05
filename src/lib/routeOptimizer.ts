/**
 * Optimizador de orden de paradas de reparto.
 *
 * Algoritmo: vecino más cercano (nearest neighbor) para una solución
 * inicial rápida, seguido de mejoras 2-opt (intercambia parejas de
 * tramos si acorta el recorrido total). Es el mismo enfoque que usan
 * herramientas como Routific u OptimoRoute para flotas pequeñas —
 * no es óptimo matemático perfecto, pero da resultados muy buenos
 * en fracciones de segundo, incluso con decenas de paradas.
 */

export interface RoutePoint {
  id: number | string;
  lat: number;
  lng: number;
}

// Distancia entre dos puntos GPS en km (fórmula de Haversine)
export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function totalDistance(points: RoutePoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) sum += haversineKm(points[i], points[i + 1]);
  return sum;
}

// Vecino más cercano: desde el punto de partida, siempre va a la parada
// no visitada más próxima.
function nearestNeighborOrder<T extends RoutePoint>(points: T[]): T[] {
  if (points.length <= 2) return [...points];
  const remaining = points.slice(1);
  const ordered = [points[0]];
  let current = points[0];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    current = remaining[bestIdx];
    ordered.push(current);
    remaining.splice(bestIdx, 1);
  }
  return ordered;
}

// 2-opt: prueba a "deshacer cruces" del recorrido intercambiando tramos,
// quedándose con la mejora si acorta la distancia total.
function twoOptImprove<T extends RoutePoint>(points: T[]): T[] {
  let best = [...points];
  let improved = true;
  let iterations = 0;
  const MAX_ITERATIONS = 200; // red de seguridad para rutas muy largas

  while (improved && iterations < MAX_ITERATIONS) {
    improved = false;
    iterations++;
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        if (totalDistance(candidate) < totalDistance(best) - 0.001) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

export interface OptimizationResult<T> {
  ordered: T[];
  originalKm: number;
  optimizedKm: number;
  savedKm: number;
  savedPercent: number;
}

/**
 * Reordena una lista de paradas para minimizar la distancia total
 * recorrida. El primer punto de la lista se respeta como punto de
 * partida (el origen/almacén) y no se mueve.
 */
export function optimizeRoute<T extends { id: number | string; lat: number; lng: number }>(
  stops: T[]
): OptimizationResult<T> {
  if (stops.length < 3) {
    const km = totalDistance(stops);
    return { ordered: stops, originalKm: km, optimizedKm: km, savedKm: 0, savedPercent: 0 };
  }

  const originalKm = totalDistance(stops);
  const nn = nearestNeighborOrder(stops);
  const improved = twoOptImprove(nn);
  const optimizedKm = totalDistance(improved);
  const savedKm = Math.max(0, originalKm - optimizedKm);
  const savedPercent = originalKm > 0 ? Math.round((savedKm / originalKm) * 100) : 0;

  return { ordered: improved, originalKm, optimizedKm, savedKm, savedPercent };
}
