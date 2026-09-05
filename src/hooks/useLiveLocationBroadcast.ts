import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Transmite la ubicación GPS real del dispositivo mientras `enabled` es true
 * (por ejemplo: mientras un repartidor tiene la página de Rutas abierta y le
 * quedan paradas pendientes). Se actualiza cada ~15s como máximo, para no
 * gastar batería ni saturar la base de datos.
 */
export function useLiveLocationBroadcast(enabled: boolean) {
  const { user } = useAuth();
  const lastSentRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !user || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < 15000) return;
        lastSentRef.current = now;

        supabase.from('driver_locations').upsert(
          {
            driver_id: user.id,
            driver_name: user.full_name,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            speed_kmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
            updated_at: new Date().toISOString(),
            sharing: true,
          },
          { onConflict: 'driver_id' }
        );
      },
      () => { /* si falla, simplemente no se comparte — no interrumpir al conductor */ },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // Marcar como "ya no comparte" al salir de la página
      if (user) {
        supabase.from('driver_locations').update({ sharing: false }).eq('driver_id', user.id);
      }
    };
  }, [enabled, user]);
}
