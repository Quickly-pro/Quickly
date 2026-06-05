// Delega al contexto compartido — una sola suscripción Supabase para toda la app
export { usePremiumContext as usePremium } from '@/context/PremiumContext';
export type { Subscription, SubscriptionPlan, SubscriptionStatus } from '@/context/PremiumContext';
