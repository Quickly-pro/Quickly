import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { usePremium } from '@/hooks/usePremium';

interface StripePrice {
  id: string;
  plan: string;
  period: string;
  unitAmount: number;
  currency: string;
  interval: string;
  productName: string;
  productDescription: string;
}

const defaultFeatures: Record<string, string[]> = {
  premium: [
    'Asistente IA con consultas ilimitadas',
    'Estadísticas y reportes avanzados',
    'Gestión de incidencias de vehículo',
    'Control de combustible completo',
    'Hoja de cálculo con exportación',
    'Correo electrónico integrado',
    'Soporte prioritario por email',
  ],
  enterprise: [
    'Todo lo de Premium',
    'Usuarios ilimitados',
    'API de integración',
    'Reportes personalizados',
    'Onboarding dedicado',
    'Soporte telefónico 24/7',
    'SLA garantizado',
  ],
};

export default function UpgradePremium() {
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prices, setPrices] = useState<StripePrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refetch } = usePremium();
  const verifiedRef = useRef(false);

  // Fetch real Stripe prices (opcional — si falla, se usan los precios hardcodeados)
  useEffect(() => {
    const fetchPrices = async () => {
      setPricesLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-stripe-prices', { body: {} });
        if (!error && data?.prices) {
          setPrices(data.prices);
        }
        // Si la edge function no está desplegada o Stripe no está configurado,
        // simplemente no rellenamos prices y los planes muestran los precios
        // hardcodeados. No mostramos error al usuario.
      } catch {
        // silencioso — usamos precios hardcodeados como fallback
      } finally {
        setPricesError(null);
        setPricesLoading(false);
      }
    };
    fetchPrices();
  }, []);

  // Helper to get price for a plan/period
  const getPrice = (planId: string, isAnnual: boolean) => {
    const period = isAnnual ? 'annual' : 'monthly';
    return prices.find(p => p.plan === planId && p.period === period);
  };

  // Hardcoded display prices for Premium; Enterprise uses Stripe prices
  const displayPrices: Record<string, Record<string, number>> = {
    premium: { monthly: 25, annual: 240 }, // 240€/año = 25€ × 12 × 0.8 (-20%)
    enterprise: { monthly: 50, annual: 480 },
  };

  // Price IDs de Stripe configurados manualmente (fallback si la edge function no responde).
  // Si más adelante despliegas la edge function `get-stripe-prices`, estos se usan solo como fallback.
  const FALLBACK_PRICE_IDS: Record<string, Record<string, string | undefined>> = {
    premium: {
      monthly: 'price_1TVAN7Ps4Jcmx8yrRzGWR1hI',
      annual: 'price_1TXTKTPs4Jcmx8yrsBco7NXH',
    },
    enterprise: {
      monthly: 'price_1TXwAUPs4Jcmx8yrtMbKq5D8',
      annual: 'price_1TXwBLPs4Jcmx8yrfV4uzGAh',
    },
  };

  // Build plans dynamically: Premium uses hardcoded prices, Enterprise uses Stripe prices with fallback
  const plans = useMemo(() => {
    const basePlans = [
      {
        id: 'premium',
        name: 'Premium',
        description: 'Para empresas que quieren crecer',
        features: defaultFeatures.premium,
        cta: 'Suscribirse ahora',
        popular: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Para flotas grandes y equipos',
        features: defaultFeatures.enterprise,
        cta: 'Suscribirse ahora',
        popular: false,
      },
    ];

    return basePlans.map((plan) => {
      const priceObj = getPrice(plan.id, annual);
      const periodKey = annual ? 'annual' : 'monthly';
      // Siempre usar precios hardcodeados para display
      const amount = displayPrices[plan.id]?.[periodKey] || 0;
      const monthAmount = displayPrices[plan.id]?.monthly ?? 0;
      const yearAmount = displayPrices[plan.id]?.annual ?? 0;
      const hasDiscount = monthAmount > 0 && yearAmount > 0 && yearAmount < monthAmount * 12;

      // Usar price ID de la API (ya corregida para mapear por nombre de producto)
      // con fallback al hardcodeado si la API no responde
      const priceId = priceObj?.id || FALLBACK_PRICE_IDS[plan.id]?.[periodKey];

      return {
        ...plan,
        price: String(Math.round(amount)),
        period: annual ? '/año' : '/mes',
        priceId,
        hasDiscount,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, annual]);

  useEffect(() => {
    const success = searchParams.get('success') === 'true';
    const sessionId = searchParams.get('session_id');

    if (success && sessionId && !verifiedRef.current) {
      verifiedRef.current = true;

      const verify = async () => {
        try {
          const { data, error } = await supabase.functions.invoke(
            'verify-stripe-subscription',
            { body: { sessionId } }
          );

          if (error || !data?.success) {
            setErrorMsg(
              error?.message ||
                data?.error ||
                'No se pudo verificar el pago. Contacta con soporte si crees que fue cobrado.'
            );
          } else {
            setSuccessMsg(
              'Pago completado correctamente! Tu suscripción está activa.'
            );
            refetch?.();
          }
        } catch (err: any) {
          setErrorMsg(
            err.message || 'Error verificando el pago. Intenta recargar la página.'
          );
        }
      };

      verify();
    } else if (searchParams.get('canceled') === 'true') {
      setErrorMsg('El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.');
    }
  }, [searchParams, refetch]);

  const handleSubscribe = async (planId: string, priceId: string | undefined) => {
    if (!user) {
      navigate('/login?redirect=/upgrade-premium');
      return;
    }

    setLoadingPlan(planId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          plan: planId,
          annual,
          userId: user.id,
          email: user.email,
          priceId,
        },
      });

      if (error || !data?.url) {
        throw new Error(error?.message || 'No se pudo crear la sesión de pago');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar el pago. Inténtalo de nuevo.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
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

      <div className="text-center">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <div className="w-8 h-8 flex items-center justify-center">
            <i className="ri-vip-crown-line text-amber-500 text-2xl" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-2">
          Desbloquea todo el potencial
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 max-w-lg mx-auto">
          El plan gratuito cubre lo básico. Premium te da las herramientas que necesitas para escalar tu negocio de reparto.
        </p>

        <div className="flex items-center justify-center gap-3 mt-5">
          <span
            className={`text-sm ${
              !annual
                ? 'text-gray-800 dark:text-slate-100 font-medium'
                : 'text-gray-400 dark:text-slate-500'
            }`}
          >
            Mensual
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-all ${
              annual ? 'bg-amber-500' : 'bg-gray-200 dark:bg-slate-700'
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                annual ? 'translate-x-6' : ''
              }`}
            />
          </button>
          <span
            className={`text-sm ${
              annual
                ? 'text-gray-800 dark:text-slate-100 font-medium'
                : 'text-gray-400 dark:text-slate-500'
            }`}
          >
            Anual{' '}
            <span className="text-amber-600 dark:text-amber-400 font-medium">-20%</span>
          </span>
        </div>
      </div>

      {pricesLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Cargando precios...</span>
        </div>
      ) : pricesError ? (
        <div className="text-center py-6 text-sm text-red-500">{pricesError}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const isLoading = loadingPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 transition-all ${
                  plan.popular
                    ? 'border-amber-200 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10'
                    : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
                    Más popular
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-bold text-gray-800 dark:text-slate-100">
                    €{plan.price}
                  </span>
                  <span className="text-sm text-gray-400 dark:text-slate-400">{plan.period}</span>
                  {annual && plan.hasDiscount && (
                    <span className="ml-2 text-xs text-green-600 font-medium">
                      Ahorras con anual
                    </span>
                  )}
                  {!annual && plan.hasDiscount && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Ahorra un 20% eligiendo el plan anual (€{displayPrices[plan.id]?.annual}/año)
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-slate-300"
                    >
                      <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                        <i className="ri-check-line text-green-500 text-xs" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id, plan.priceId)}
                  disabled={isLoading || (plan.id !== 'premium' && !plan.priceId)}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando...
                    </>
                  ) : plan.id !== 'premium' && !plan.priceId ? (
                    'Próximamente'
                  ) : (
                    <>
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-secure-payment-line" />
                      </div>
                      {plan.cta}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

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
