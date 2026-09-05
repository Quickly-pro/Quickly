import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';

const typeCards = [
  {
    icon: 'ri-message-3-line',
    title: 'Comparte ideas de nuevas funciones',
    desc: '¿Tienes una idea para mejorar Quickly? Cuéntanosla.',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    activeColor: 'bg-blue-500 text-white border-blue-500',
  },
  {
    icon: 'ri-star-line',
    title: 'Dinos qué mejoraría tu experiencia',
    desc: 'Tu feedback nos ayuda a priorizar qué mejorar primero.',
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    activeColor: 'bg-amber-500 text-white border-amber-500',
  },
  {
    icon: 'ri-bug-line',
    title: 'Reporta errores o problemas',
    desc: '¿Algo no funciona como esperas? Ayúdanos a corregirlo.',
    color: 'bg-red-50 text-red-600 border-red-200',
    activeColor: 'bg-red-500 text-white border-red-500',
  },
];

const categories = [
  { id: 'feature', label: 'Nueva funcionalidad' },
  { id: 'design', label: 'Mejora de diseño' },
  { id: 'bug', label: 'Corrección de error' },
  { id: 'perf', label: 'Rendimiento' },
  { id: 'other', label: 'Otra' },
];

export default function Sugerencias() {
  const { user } = useAuth();
  const { isEmpresa } = useRole();
  const [selectedType, setSelectedType] = useState(0);
  const [category, setCategory] = useState('feature');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const [showInbox, setShowInbox] = useState(false);
  const [received, setReceived] = useState<any[]>([]);

  const fetchReceived = useCallback(async () => {
    const { data } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });
    setReceived(data || []);
  }, []);

  useEffect(() => { if (isEmpresa) fetchReceived(); }, [isEmpresa, fetchReceived]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim() || status === 'sending') return;
    setStatus('sending');
    setError('');
    const { error: err } = await supabase.from('suggestions').insert({
      sent_by: user?.id || null,
      name: name || null,
      email: email || null,
      category,
      type: typeCards[selectedType].title,
      text: suggestion.trim(),
    });
    if (err) {
      setError(err.message || 'No se pudo enviar la sugerencia');
      setStatus('idle');
      return;
    }
    setStatus('sent');
    setSuggestion('');
    setName('');
    setEmail('');
    setTimeout(() => setStatus('idle'), 3000);
  };

  const markStatus = async (id: number, newStatus: string) => {
    await supabase.from('suggestions').update({ status: newStatus }).eq('id', id);
    fetchReceived();
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-lightbulb-flash-line text-orange-600 text-xl" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Sugerencias</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                ¿Tienes una idea? ¡Nos encanta escucharte!
              </p>
            </div>
          </div>
          {isEmpresa && (
            <button
              onClick={() => setShowInbox(!showInbox)}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <i className="ri-inbox-line" />
              {showInbox ? 'Ocultar recibidas' : `Ver recibidas (${received.length})`}
            </button>
          )}
        </div>

        {/* Inbox for empresa */}
        {isEmpresa && showInbox && (
          <div className="mb-8 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Sugerencias recibidas</p>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {received.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-400 dark:text-slate-500">Aún no hay sugerencias</p>
              ) : received.map((s) => (
                <div key={s.id} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400">{s.type}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{new Date(s.created_at).toLocaleDateString('es-ES')}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300">{s.text}</p>
                  {(s.name || s.email) && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{s.name}{s.name && s.email ? ' · ' : ''}{s.email}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {['nueva', 'en_revision', 'resuelta'].map(st => (
                      <button
                        key={st}
                        onClick={() => markStatus(s.id, st)}
                        className={`px-2 py-1 rounded-full text-[11px] font-medium ${s.status === st ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}
                      >
                        {st === 'nueva' ? 'Nueva' : st === 'en_revision' ? 'En revisión' : 'Resuelta'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {typeCards.map((card, idx) => {
            const isActive = selectedType === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedType(idx)}
                className={`flex flex-col items-start gap-3 p-5 rounded-xl border-2 transition-all text-left
                  ${isActive ? card.activeColor : `bg-white dark:bg-slate-900 ${card.color} hover:opacity-80`}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-white dark:bg-slate-800'}`}>
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${card.icon} text-lg ${isActive ? 'text-white' : ''}`} />
                  </div>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isActive ? 'text-white' : ''}`}>{card.title}</p>
                  <p className={`text-xs mt-1 ${isActive ? 'text-white/80' : 'text-gray-500 dark:text-slate-400'}`}>{card.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">
                Nombre (opcional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">
                Email (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Para recibir respuesta"
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2 block">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all whitespace-nowrap
                    ${category === c.id
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-orange-300'
                    }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">
              Tu sugerencia <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              maxLength={500}
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Describe tu idea, mejora o problema con detalle..."
              rows={5}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 resize-none"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">
              {suggestion.length}/500
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1"><i className="ri-error-warning-line" /> {error}</p>
          )}

          <button
            type="submit"
            disabled={status === 'sending' || !suggestion.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50"
          >
            {status === 'sent' ? (
              <>
                <i className="ri-check-line" />
                ¡Sugerencia enviada!
              </>
            ) : status === 'sending' ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <i className="ri-send-plane-line" />
                Enviar Sugerencia
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
