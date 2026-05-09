import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

type RoleOption = 'empresa' | 'empleado' | 'cliente';

const ROLE_CONFIG: Record<RoleOption, { label: string; icon: string; desc: string; color: string; bg: string }> = {
  empresa: {
    label: 'Empresa',
    icon: 'ri-building-2-line',
    desc: 'Gestiona toda la operación',
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  },
  empleado: {
    label: 'Empleado',
    icon: 'ri-user-settings-line',
    desc: 'Accede a rutas y operaciones',
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  },
  cliente: {
    label: 'Cliente',
    icon: 'ri-user-3-line',
    desc: 'Consulta pedidos y facturas',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  },
};

export default function Registro() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<RoleOption | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSelectRole = (r: RoleOption) => {
    setRole(r);
    setStep(2);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    // 1. Registrar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
        },
      },
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    const userId = authData.user?.id;

    // 2. Crear perfil en tabla profiles
    if (userId) {
      const roleMap: Record<RoleOption, string> = {
        empresa: 'Administrador',
        empleado: 'Empleado',
        cliente: 'Cliente',
      };

      await supabase.from('profiles').insert({
        id: userId,
        full_name: fullName.trim(),
        email: email.trim(),
        role: roleMap[role],
        department: role === 'empresa' ? 'Dirección' : role === 'empleado' ? 'Operaciones' : 'Cliente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Si es cliente, también crear en clients
      if (role === 'cliente') {
        await supabase.from('clients').insert({
          name: fullName.trim(),
          email: email.trim(),
          status: 'activo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    setLoading(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-truck-line text-2xl text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">
            {step === 1 ? '¿Quién eres?' : 'Crear cuenta'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {step === 1 ? 'Selecciona tu tipo de cuenta' : `Registrándote como ${role ? ROLE_CONFIG[role].label : ''}`}
          </p>
        </div>

        {/* Step 1: Select Role */}
        {step === 1 && (
          <div className="space-y-3">
            {(Object.keys(ROLE_CONFIG) as RoleOption[]).map((r) => {
              const cfg = ROLE_CONFIG[r];
              return (
                <button
                  key={r}
                  onClick={() => handleSelectRole(r)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left hover:scale-[1.02] ${cfg.bg} border-transparent hover:border-current`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                    <i className={`${cfg.icon} text-xl ${cfg.color}`} />
                  </div>
                  <div>
                    <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{cfg.desc}</p>
                  </div>
                  <i className="ri-arrow-right-s-line ml-auto text-gray-400" />
                </button>
              );
            })}

            <p className="text-center text-sm text-gray-400 dark:text-slate-500 mt-4">
              ¿Ya tienes cuenta?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-orange-600 hover:underline font-medium"
              >
                Inicia sesión
              </button>
            </p>
          </div>
        )}

        {/* Step 2: Registration Form */}
        {step === 2 && role && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-orange-600 flex items-center gap-1 mb-2"
            >
              <i className="ri-arrow-left-line" /> Volver
            </button>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                placeholder="Repite la contraseña"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>

            <p className="text-center text-sm text-gray-400 dark:text-slate-500">
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-orange-600 hover:underline font-medium"
              >
                Inicia sesión
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}