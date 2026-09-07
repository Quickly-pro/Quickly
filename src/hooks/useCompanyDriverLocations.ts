import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface DriverLocation {
  driver_id: string;
  driver_name: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  updated_at: string;
  sharing: boolean;
}

/**
 * Trae y mantiene sincronizadas (realtime) las ubicaciones GPS reales de
 * los repartidores de tu empresa. Devuelve un mapa nombre → última
 * ubicación conocida, para cruzarlo con el campo `driver` de cada parada.
 */
export function useCompanyDriverLocations() {
  const [byName, setByName] = useState<Record<string, DriverLocation>>({});

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase.from('driver_locations').select('*');
    if (error) console.error('Error cargando ubicaciones de repartidores:', error);
    if (data) {
      const map: Record<string, DriverLocation> = {};
      (data as DriverLocation[]).forEach(d => {
        if (d.driver_name) map[d.driver_name] = d;
      });
      setByName(map);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const sub = supabase
      .channel(`driver_locations_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, fetchAll)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchAll]);

  /** Considera "en línea" solo si tuvo señal en los últimos 2 minutos */
  const isFresh = (loc: DriverLocation) => Date.now() - new Date(loc.updated_at).getTime() < 120000;

  return { byName, isFresh };
}
