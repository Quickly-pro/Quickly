import { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import Modal from '@/components/base/Modal';

interface Email {
  id: number;
  from: string;
  subject: string;
  preview: string;
  date: string;
  read: boolean;
  folder: 'inbox' | 'sent';
}

const emails: Email[] = [
  { id: 1, from: 'Restaurante El Pino', subject: 'Consulta sobre precios mayo', preview: 'Hola, ¿podríais enviarme la lista de precios actualizada para el mes que viene?', date: '30/04/26 09:30', read: false, folder: 'inbox' },
  { id: 2, from: 'Supermercado MercaMax', subject: 'Pedido urgente - Aceite', preview: 'Necesitamos un pedido extra de aceite oliva para este fin de semana.', date: '29/04/26 16:45', read: true, folder: 'inbox' },
  { id: 3, from: 'Taller Rápido Madrid', subject: 'Presupuesto reparación F-01', preview: 'Adjunto el presupuesto para la reparación de la furgoneta F-01.', date: '29/04/26 11:20', read: true, folder: 'inbox' },
  { id: 4, from: 'Facturación Quickly', subject: 'Recordatorio de pago', preview: 'Le recordamos que tiene una factura pendiente de pago.', date: '28/04/26 08:00', read: false, folder: 'sent' },
  { id: 5, from: 'Marketing Quickly', subject: 'Promoción primavera', preview: 'Información sobre la nueva promoción de productos de temporada.', date: '27/04/26 14:30', read: true, folder: 'sent' },
];

export default function Email() {
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const composeRef = useRef<HTMLDivElement>(null);
  useClickOutside(composeRef, () => setShowCompose(false), showCompose);

  const [emailList, setEmailList] = useState<Email[]>(emails);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSent, setComposeSent] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const filteredEmails = emailList.filter(e => e.folder === activeFolder);

  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || composeSending) return;
    setComposeSending(true);
    setComposeError(null);

    // Leer nombre de empresa desde localStorage (perfil empresa)
    let companyName = 'Quickly';
    try {
      const perfil = localStorage.getItem('empresa-perfil');
      if (perfil) {
        const parsed = JSON.parse(perfil);
        if (parsed?.name) companyName = parsed.name;
      }
    } catch { /* ignorar */ }

    try {
      const res = await fetch('https://irbilfifptefmpudwxee.supabase.co/functions/v1/send-compose-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody, companyName }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        const msg = data?.error || 'Error al enviar el email';
        setComposeError(msg);
        setComposeSending(false);
        return;
      }

      // Añadir a la lista de enviados (UI)
      const newEmail: Email = {
        id: Date.now(),
        from: composeTo,
        subject: composeSubject,
        preview: composeBody,
        date: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
        read: true,
        folder: 'sent',
      };
      setEmailList(prev => [newEmail, ...prev]);
      setComposeSent(true);
      setComposeSending(false);
      setTimeout(() => {
        setShowCompose(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setComposeSent(false);
        setComposeError(null);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Correo Electrónico</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de emails de clientes y proveedores</p>
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

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row" style={{ minHeight: '500px' }}>
        {/* Sidebar */}
        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-gray-100 flex-shrink-0 p-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-hidden">
          <button
            onClick={() => { setActiveFolder('inbox'); setSelectedEmail(null); setShowEmailDetail(false); }}
            className={`flex-shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${activeFolder === 'inbox' ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-inbox-line" />
            </div>
            <span className="whitespace-nowrap">Bandeja</span>
            <span className="ml-auto px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">
              {emails.filter(e => e.folder === 'inbox' && !e.read).length}
            </span>
          </button>
          <button
            onClick={() => { setActiveFolder('sent'); setSelectedEmail(null); setShowEmailDetail(false); }}
            className={`flex-shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              ${activeFolder === 'sent' ? 'bg-orange-50 text-orange-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-send-plane-line" />
            </div>
            <span className="whitespace-nowrap">Enviados</span>
          </button>
        </div>

        {/* Email List */}
        <div className="flex-1 flex flex-col">
          <div className="border-b border-gray-100 p-3 flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-50 rounded-lg px-3 py-1.5">
              <div className="w-4 h-4 flex items-center justify-center mr-2">
                <i className="ri-search-line text-gray-400 text-sm" />
              </div>
              <input type="text" placeholder="Buscar emails..." className="bg-transparent text-sm outline-none w-full" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => { setSelectedEmail(email); setShowEmailDetail(true); }}
                className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-all
                  ${!email.read ? 'bg-orange-50/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm ${!email.read ? 'font-semibold' : 'font-medium'} text-gray-800`}>{email.from}</span>
                  <span className="text-xs text-gray-400">{email.date}</span>
                </div>
                <p className={`text-sm ${!email.read ? 'font-medium' : ''} text-gray-700 mb-0.5`}>{email.subject}</p>
                <p className="text-xs text-gray-400 truncate">{email.preview}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      <Modal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        title="Redactar Email"
        size="2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 block mb-1">Para</label>
            <input
              type="email"
              placeholder="email@ejemplo.com"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg text-sm outline-none focus:border-orange-400 bg-gray-800 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Asunto</label>
            <input
              type="text"
              placeholder="Asunto del email..."
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg text-sm outline-none focus:border-orange-400 bg-gray-800 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Mensaje</label>
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg text-sm outline-none focus:border-orange-400 resize-none bg-gray-800 text-white placeholder-gray-500"
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
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={() => { setShowCompose(false); setComposeError(null); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
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
      <Modal
        isOpen={showEmailDetail && !!selectedEmail}
        onClose={() => { setShowEmailDetail(false); setSelectedEmail(null); }}
        title={selectedEmail?.subject || ''}
        size="lg"
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedEmail.from}</p>
                <p className="text-xs text-gray-400">{selectedEmail.date}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${selectedEmail.folder === 'sent' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                {selectedEmail.folder === 'sent' ? 'Enviado' : 'Recibido'}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{selectedEmail.preview}</p>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => { setShowEmailDetail(false); setSelectedEmail(null); }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cerrar
              </button>
              {selectedEmail.folder === 'inbox' && (
                <button
                  onClick={handleReply}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-2"
                >
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
