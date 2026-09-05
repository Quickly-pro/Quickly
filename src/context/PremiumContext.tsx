import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type SubscriptionStatus = 'active' | 'inactive' | 'trial' | 'cancelled' | 'expired';
export type SubscriptionPlan = 'free' | 'premium';

export interface Subscription {
  id: number;
  user_id: string;
  company_id: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

interface PremiumContextValue {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  isPremium: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  plan: SubscriptionPlan;
  isSharedFromCompany: boolean;
  refetch: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTrial = subscription?.status === 'trial';
  const trialDaysLeft = isTrial && subscription.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  // Si el trial ha expirado (trial_ends_at ya pasó) no se considera premium
  const trialExpired = isTrial
    ? (subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) <= new Date() : true)
    : false;
  const isPremium = subscription !== null && ['active', 'trial'].includes(subscription.status) && !trialExpired;

  // Si el usuario se unió a la empresa de otro con un código, el
  // premium que ve viene de la suscripción del propietario, no de la suya.
  const isSharedFromCompany = !!user?.company_id;

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const effectiveOwnerId = user.company_id || user.id;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', effectiveOwnerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setSubscription(null);
      } else {
        setSubscription(data);
      }
    } catch {
      setError('Error de conexión');
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return (
    <PremiumContext.Provider value={{
      subscription,
      loading,
      error,
      isPremium,
      isTrial,
      trialDaysLeft,
      plan: subscription?.plan || 'free',
      isSharedFromCompany,
      refetch: fetchSubscription,
    }}>
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremiumContext(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremiumContext must be used inside PremiumProvider');
  return ctx;
}
