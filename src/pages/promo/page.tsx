import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type State = 'loading' | 'not_logged' | 'activating' | 'success' | 'already' | 'error';

export default function PromoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || 'QRCARD';

  const [state, setState] = useState<State>('loading');
  const [daysLeft, setDaysLeft] = useState(30);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState('not_logged'); return; }

      // Check existing subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub && ['active'].includes(sub.status)) {
        setState('already'); return;
      }
      if (sub && sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date()) {
        const days = Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000);
        setDaysLeft(days);
        setState('already'); return;
      }

      // Activate 30-day trial
      setState('activating');
      const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      const { error } = await supabase.from('subscriptions').upsert({
        user_id: user.id,
        status: 'trial',
        plan: 'premium',
        trial_ends_at: trialEnd,
        current_period_start: now,
        current_period_end: trialEnd,
        company_id: null,
      }, { onConflict: 'user_id' });

      if (error) {
        setErrorMsg(error.message);
        setState('error');
      } else {
        setState('success');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1017] flex flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Quickly" className="w-16 h-16 rounded-2xl mb-3 object-contain" />
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Pacifico, cursive' }}>Quickly</h1>
          <p className="text-slate-400 text-sm mt-1">Transporte y logística universal</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm text-center">

          {/* LOADING */}
          {(state === 'loading' || state === 'activating') && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              <p className="text-slate-300 text-sm">
                {state === 'loading' ? 'Verificando...' : 'Activando tu prueba gratuita...'}
              </p>
            </div>
          )}

          {/* NOT LOGGED IN */}
          {state === 'not_logged' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                <i className="ri-vip-crown-line text-orange-400 text-3xl" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">1 mes gratis de Premium</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Has escaneado una tarjeta promocional de <span className="text-orange-400 font-semibold">Quickly</span>.<br />
                Crea tu cuenta o inicia sesión para activar tu mes gratis.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6 text-xs text-slate-400">
                {[
                  { icon: 'ri-truck-line',           label: 'Camiones y trailers' },
                  { icon: 'ri-route-line',            label: 'Rutas GPS' },
                  { icon: 'ri-bill-line',             label: 'Facturas y albaranes' },
                  { icon: 'ri-box-3-line',            label: 'Todo tipo de carga' },
                  { icon: 'ri-team-line',             label: 'Conductores' },
                  { icon: 'ri-robot-line',            label: 'Asistente IA' },
                ].map(f => (
                  <div key={f.label} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5">
                    <i className={`${f.icon} text-orange-400 text-lg`} />
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate(`/registro?promo=${ref}`)}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl mb-3 transition-all flex items-center justify-center gap-2"
              >
                <i className="ri-user-add-line" /> Crear cuenta gratis
              </button>
              <button
                onClick={() => navigate(`/login?redirect=/promo`)}
                className="w-full py-2.5 border border-white/20 text-slate-300 hover:text-white hover:border-white/40 font-medium rounded-xl transition-all text-sm"
              >
                Ya tengo cuenta — Iniciar sesión
              </button>
            </>
          )}

          {/* SUCCESS */}
          {state === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <i className="ri-checkbox-circle-line text-green-400 text-3xl" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">¡Premium activado!</h2>
              <p className="text-slate-400 text-sm mb-2">
                Tienes <span className="text-orange-400 font-bold text-lg">30 días</span> de acceso premium gratuito.
              </p>
              <p className="text-slate-500 text-xs mb-6">
                Ref: {ref} · La prueba se bloquea automáticamente al finalizar el periodo
              </p>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6 text-left space-y-2">
                {['Asistente IA', 'Estadísticas avanzadas', 'Gestión de flota', 'Hoja de cálculo', 'Correo integrado'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <i className="ri-check-line text-orange-400" /> {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <i className="ri-arrow-right-line" /> Ir al panel
              </button>
            </>
          )}

          {/* ALREADY HAS SUBSCRIPTION */}
          {state === 'already' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <i className="ri-vip-crown-fill text-amber-400 text-3xl" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Ya tienes acceso activo</h2>
              <p className="text-slate-400 text-sm mb-6">
                Tu cuenta ya tiene premium activo
                {daysLeft > 0 ? ` — quedan ${daysLeft} días de prueba.` : '.'}
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all"
              >
                Ir al panel
              </button>
            </>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <i className="ri-error-warning-line text-red-400 text-3xl" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Error al activar</h2>
              <p className="text-slate-400 text-sm mb-4">{errorMsg}</p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all"
              >
                Reintentar
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          app.tenden-c.com · Quickly © 2025
        </p>
      </div>
    </div>
  );
}
