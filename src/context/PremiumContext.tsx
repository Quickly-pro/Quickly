import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

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
  refetch: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
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

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
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
  }, []);

  useEffect(() => {
    fetchSubscription();

    // Una sola suscripción de auth para toda la app
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
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
