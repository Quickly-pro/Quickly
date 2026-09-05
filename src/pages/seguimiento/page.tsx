import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface TrackingData {
  client: string;
  address: string;
  status: string;
  driver: string;
  delivered_at: string | null;
  delivered_to: string | null;
  photo_url: string | null;
  company_name: string;
}

/**
 * Página pública de seguimiento — sin login, sin cuenta. El cliente final
 * recibe este link (por WhatsApp/email) y ve solo el estado de SU entrega,
 * nada más de la empresa.
 */
export default function Seguimiento() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: result, error: rpcError } = await supabase.rpc('get_public_tracking', { p_token: token });
      if (rpcError || !result?.success) {
        setError(result?.error || 'No se pudo cargar el seguimiento');
      } else {
        setData(result);
      }
      setLoading(false);
    })();
  }, [token]);

  const mapUrl = data
    ? `https://maps.google.com/maps?q=${encodeURIComponent(data.address)}&output=embed&hl=es`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <i className="ri-truck-line text-white text-lg" />
          </div>
          <span className="font-bold text-gray-800 dark:text-slate-100 text-lg">
            {data?.company_name || 'Seguimiento de entrega'}
          </span>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 p-8 text-center">
            <i className="ri-error-warning-line text-3xl text-red-400 mb-3 block" />
            <p className="text-sm font-medium text-gray-600 dark:text-slate-300">{error}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Comprueba que el enlace esté completo, o pide uno nuevo.</p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-6 text-center ${
              data.status === 'completed'
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40'
                : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/40'
            }`}>
              <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3 ${
                data.status === 'completed' ? 'bg-green-500' : 'bg-orange-500'
              }`}>
                <i className={`${data.status === 'completed' ? 'ri-check-double-line' : 'ri-truck-line'} text-white text-2xl`} />
              </div>
              <p className={`font-bold text-lg ${data.status === 'completed' ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                {data.status === 'completed' ? 'Entregado' : 'En camino'}
              </p>
              {data.status === 'completed' && data.delivered_at && (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {new Date(data.delivered_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {data.delivered_to ? ` · Recibido por ${data.delivered_to}` : ''}
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <i className="ri-user-line text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Destinatario</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{data.client}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <i className="ri-map-pin-line text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Dirección</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{data.address}</p>
                </div>
              </div>
              {data.driver && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <i className="ri-truck-line text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Repartidor</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{data.driver}</p>
                  </div>
                </div>
              )}
            </div>

            {data.photo_url && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-700">
                  <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">Foto de la entrega</span>
                </div>
                <img src={data.photo_url} alt="Entrega" className="w-full max-h-72 object-cover" />
              </div>
            )}

            {mapUrl && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                <iframe src={mapUrl} width="100%" height="220" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="w-full block" />
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11px] text-gray-300 dark:text-slate-600 mt-8">
          Powered by Quickly
        </p>
      </div>
    </div>
  );
}
