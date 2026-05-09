import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: redirectUrl }
    );

    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-lock-unlock-line text-2xl text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Recuperar contraseña</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Te enviaremos un enlace para restablecerla
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <i className="ri-mail-send-line text-2xl text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-gray-700 dark:text-slate-300">
              Si existe una cuenta con <strong>{email}</strong>, recibirás un correo con instrucciones.
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Revisa tu bandeja de entrada y spam.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm transition-all"
            >
              Volver al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>

            <p className="text-center text-sm text-gray-400 dark:text-slate-500">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-orange-600 hover:underline font-medium"
              >
                Volver al login
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}