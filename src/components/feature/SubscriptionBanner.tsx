import { Link } from 'react-router-dom';
import { usePremium } from '@/hooks/usePremium';

interface SubscriptionBannerProps {
  variant?: 'compact' | 'full';
}

export default function SubscriptionBanner({ variant = 'compact' }: SubscriptionBannerProps) {
  const { subscription, loading, isPremium, isTrial, trialDaysLeft, plan } = usePremium();

  if (loading) return null;

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    : null;

  // Active Premium
  if (isPremium && !isTrial) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <i className="ri-vip-crown-fill text-amber-500 text-sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              Plan Premium activo
            </p>
            {periodEnd && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Renovación: {periodEnd}
              </p>
            )}
          </div>
        </div>
        <Link
          to="/upgrade-premium"
          className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 hover:underline whitespace-nowrap"
        >
          Gestionar plan
        </Link>
      </div>
    );
  }

  // Trial active
  if (isTrial && trialDaysLeft > 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <i className="ri-gift-2-line text-green-500 text-sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              Prueba gratuita activa — {trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'} restantes
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              Prueba todas las funciones Premium sin coste
            </p>
          </div>
        </div>
        <Link
          to="/upgrade-premium"
          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-all whitespace-nowrap"
        >
          Suscribirse ahora
        </Link>
      </div>
    );
  }

  // Trial expired / no subscription
  if (isTrial && trialDaysLeft <= 0) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <i className="ri-error-warning-line text-red-500 text-sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              Tu prueba gratuita ha finalizado
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Suscribete para seguir disfrutando de Premium
            </p>
          </div>
        </div>
        <Link
          to="/upgrade-premium"
          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-all whitespace-nowrap"
        >
          Ver planes
        </Link>
      </div>
    );
  }

  // No subscription at all (free user)
  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <i className="ri-vip-crown-line text-orange-500 text-sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-400">
              Desbloquea funciones Premium
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              IA, estadísticas, hoja de cálculo y más
            </p>
          </div>
        </div>
        <Link
          to="/upgrade-premium"
          className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-all whitespace-nowrap"
        >
          Probar gratis
        </Link>
      </div>
    );
  }

  return null;
}