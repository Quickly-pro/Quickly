import { useState, useEffect, useCallback, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/useCompany';
import Modal from '@/components/base/Modal';

interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: string;
  read: boolean;
  folder: 'inbox' | 'sent';
}

export default function Email() {
  const { data: company } = useCompany();
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const composeRef = useRef<HTMLDivElement>(null);
  useClickOutside(composeRef, () => setShowCompose(false), showCompose);

  const [inboxEmails, setInboxEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSent, setComposeSent] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: inbox }, { data: sent }] = await Promise.all([
      supabase.from('received_emails').select('*').order('created_at', { ascending: false }),
      supabase.from('sent_emails').select('*').order('created_at', { ascending: false }),
    ]);
    setInboxEmails((inbox || []).map((e: any) => ({
      id: String(e.id), from: e.from_email, subject: e.subject, preview: e.body || '',
      date: new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
      read: e.read, folder: 'inbox' as const,
    })));
    setSentEmails((sent || []).map((e: any) => ({
      id: String(e.id), from: e.to_email, subject: e.subject, preview: e.body || '',
      date: new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
      read: true, folder: 'sent' as const,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const sub = supabase
      .channel(`email_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'received_emails' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sent_emails' }, fetchAll)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchAll]);

  const filteredEmails = activeFolder === 'inbox' ? inboxEmails : sentEmails;

  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || composeSending) return;
    setComposeSending(true);
    setComposeError(null);

    try {
      const res = await fetch('https://wtelnoiuqaqnzgobuuce.supabase.co/functions/v1/send-compose-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody, companyName: company.name || 'Quickly' }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setComposeError(data?.error || 'Error al enviar el email');
        setComposeSending(false);
        return;
      }

      await supabase.from('sent_emails').insert({ to_email: composeTo, subject: composeSubject, body: composeBody });

      setComposeSent(true);
      setComposeSending(false);
      setTimeout(() => {
        setShowCompose(false);
        setComposeTo(''); setComposeSubject(''); setComposeBody('');
        setComposeSent(false); setComposeError(null);
        fetchAll();
      }, 1500);
    } catch (err: any) {
      setComposeError(err.message || 'Error inesperado al conectar con el servidor');
      setComposeSending(false);
    }
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    setShowEmailDetail(false);
    setComposeTo(selectedEmail.from);
    setComposeSubject(`Re: ${selectedEmail.subject}`);
    setComposeBody('');
    setShowCompose(true);
  };

  const openEmail = async (email: Email) => {
    setSelectedEmail(email);
    setShowEmailDetail(true);
    if (email.folder === 'inbox' && !email.read) {
      await supabase.from('received_emails').update({ read: true }).eq('id', email.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Correo Electrónico</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gestión de emails de clientes y proveedores</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-add-line" />
          </div>
          Redactar
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row" style={{ minHeight: '500px' }}>
        {/* Sidebar */}
        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700 flex-shrink-0 p-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-hidden">
          <button
            onClick={() => { setActiveFolder('inbox'); setSelectedEmail(null); setShowEmailDetail(false); }}
            className={`flex-shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${activeFolder === 'inbox' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-inbox-line" />
            </div>
            <span className="whitespace-nowrap">Bandeja</span>
            {inboxEmails.filter(e => !e.read).length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded text-xs">
                {inboxEmails.filter(e => !e.read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveFolder('sent'); setSelectedEmail(null); setShowEmailDetail(false); }}
            className={`flex-shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${activeFolder === 'sent' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-send-plane-line" />
            </div>
            <span className="whitespace-nowrap">Enviados</span>
          </button>
        </div>

        {/* Email List */}
        <div className="flex-1 flex flex-col">
          <div className="border-b border-gray-100 dark:border-slate-700 p-3 flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-1.5">
              <div className="w-4 h-4 flex items-center justify-center mr-2">
                <i className="ri-search-line text-gray-400 text-sm" />
              </div>
              <input type="text" placeholder="Buscar emails..." className="bg-transparent text-sm outline-none w-full text-gray-700 dark:text-slate-200" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredEmails.length === 0 ? (
              activeFolder === 'inbox' ? (
                <div className="text-center py-16 px-6">
                  <i className="ri-mail-line text-3xl text-gray-300 dark:text-slate-600 mb-3 block" />
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-300">Sin bandeja de entrada conectada</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 max-w-xs mx-auto">
                    Por ahora Quickly solo puede enviar correos, no recibirlos. Conectar una bandeja real requiere vincular tu cuenta de correo — pídenoslo si lo necesitas.
                  </p>
                </div>
              ) : (
                <div className="text-center py-16 px-6">
                  <i className="ri-send-plane-line text-3xl text-gray-300 dark:text-slate-600 mb-3 block" />
                  <p className="text-sm text-gray-400 dark:text-slate-500">Aún no has enviado ningún correo</p>
                </div>
              )
            ) : (
              filteredEmails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => openEmail(email)}
                  className={`w-full text-left p-4 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all
                    ${!email.read ? 'bg-orange-50/30 dark:bg-orange-900/5' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm ${!email.read ? 'font-semibold' : 'font-medium'} text-gray-800 dark:text-slate-100`}>{email.from}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{email.date}</span>
                  </div>
                  <p className={`text-sm ${!email.read ? 'font-medium' : ''} text-gray-700 dark:text-slate-300 mb-0.5`}>{email.subject}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{email.preview}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      <Modal isOpen={showCompose} onClose={() => setShowCompose(false)} title="Redactar Email" size="2xl">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Para</label>
            <input
              type="email"
              placeholder="email@ejemplo.com"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-400 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Asunto</label>
            <input
              type="text"
              placeholder="Asunto del email..."
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-400 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Mensaje</label>
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-400 resize-none bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100"
              rows={8}
              placeholder="Escribe tu mensaje..."
              maxLength={500}
            />
          </div>
          {composeSent && (
            <p className="text-sm text-green-600 flex items-center gap-1"><i className="ri-check-double-line" /> Email enviado correctamente</p>
          )}
          {composeError && (
            <p className="text-sm text-red-500 flex items-center gap-1"><i className="ri-error-warning-line" /> {composeError}</p>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => { setShowCompose(false); setComposeError(null); }} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button
              onClick={handleSendEmail}
              disabled={!composeTo || !composeSubject || composeSent || composeSending}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {composeSending ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-send-plane-line" />}
              </div>
              {composeSending ? 'Enviando…' : composeSent ? 'Enviado' : 'Enviar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Email Detail Modal */}
      <Modal isOpen={showEmailDetail && !!selectedEmail} onClose={() => { setShowEmailDetail(false); setSelectedEmail(null); }} title={selectedEmail?.subject || ''} size="lg">
        {selectedEmail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{selectedEmail.from}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{selectedEmail.date}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${selectedEmail.folder === 'sent' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                {selectedEmail.folder === 'sent' ? 'Enviado' : 'Recibido'}
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{selectedEmail.preview}</p>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => { setShowEmailDetail(false); setSelectedEmail(null); }} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">
                Cerrar
              </button>
              {selectedEmail.folder === 'inbox' && (
                <button onClick={handleReply} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-2">
                  <i className="ri-reply-line" />
                  Responder
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
