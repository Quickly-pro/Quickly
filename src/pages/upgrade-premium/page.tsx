import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePremium } from '@/hooks/usePremium';

const premiumFeatures = [
  'Asistente IA con consultas ilimitadas',
  'Estadísticas y reportes avanzados',
  'Gestión de incidencias de vehículo',
  'Control de combustible completo',
  'Hoja de cálculo con exportación',
  'Correo electrónico integrado',
  'Soporte prioritario por email',
];

export default function UpgradePremium() {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refetch } = usePremium();
  const verifiedRef = useRef(false);

  const price = annual ? 240 : 25;
  const period = annual ? '/año' : '/mes';

  useEffect(() => {
    const success = searchParams.get('success') === 'true';
    const sessionId = searchParams.get('session_id');

    if (success && sessionId && !verifiedRef.current) {
      verifiedRef.current = true;

      const verify = async () => {
        try {
          const res = await fetch(
            'https://irbilfifptefmpudwxee.supabase.co/functions/v1/verify-stripe-subscription',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            }
          );
          const data = await res.json();

          if (!res.ok || !data?.success) {
            setErrorMsg(
              data?.error ||
                'No se pudo verificar el pago. Contacta con soporte si crees que fue cobrado.'
            );
          } else {
            setSuccessMsg('¡Pago completado! Tu suscripción Premium está activa.');
            refetch?.();
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Error verificando el pago. Intenta recargar la página.');
        }
      };

      verify();
    } else if (searchParams.get('canceled') === 'true') {
      setErrorMsg('El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.');
    }
  }, [searchParams, refetch]);

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/login?redirect=/upgrade-premium');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        'https://irbilfifptefmpudwxee.supabase.co/functions/v1/create-stripe-checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: 'premium',
            annual,
            userId: user.id,
            email: user.email,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'No se pudo crear la sesión de pago');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar el pago. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-lg mx-auto">
      {(successMsg || errorMsg) && (
        <div
          className={`rounded-xl p-4 text-sm font-medium ${
            successMsg
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {successMsg || errorMsg}
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-vip-crown-line text-amber-500 text-2xl" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-2">
          Desbloquea todo el potencial
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
          El plan gratuito cubre lo básico. Premium te da las herramientas que necesitas para escalar tu negocio de reparto.
        </p>

        {/* Toggle mensual / anual */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <span className={`text-sm ${!annual ? 'text-gray-800 dark:text-slate-100 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
            Mensual
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-all ${annual ? 'bg-amber-500' : 'bg-gray-200 dark:bg-slate-700'}`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${annual ? 'translate-x-6' : ''}`}
            />
          </button>
          <span className={`text-sm ${annual ? 'text-gray-800 dark:text-slate-100 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
            Anual <span className="text-amber-600 dark:text-amber-400 font-medium">-20%</span>
          </span>
        </div>
      </div>

      {/* Tarjeta Premium */}
      <div className="relative rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10 p-6">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
          Plan Premium
        </div>

        <div className="mb-4 mt-1">
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Premium</h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">Para empresas que quieren crecer</p>
        </div>

        <div className="mb-5">
          <span className="text-4xl font-bold text-gray-800 dark:text-slate-100">€{price}</span>
          <span className="text-sm text-gray-400 dark:text-slate-400">{period}</span>
          {!annual && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Ahorra un 20% eligiendo el plan anual (€240/año)
            </p>
          )}
          {annual && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Estás ahorrando €60 respecto al plan mensual
            </p>
          )}
        </div>

        <ul className="space-y-2.5 mb-6">
          {premiumFeatures.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-slate-300">
              <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                <i className="ri-check-line text-green-500 text-xs" />
              </div>
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <i className="ri-secure-payment-line" />
              Suscribirse ahora
            </>
          )}
        </button>
      </div>

      <div className="text-center">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 transition-all"
        >
          Volver atrás
        </button>
      </div>
    </div>
  );
}
