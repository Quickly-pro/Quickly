import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useChatMessages } from '@/hooks/useChatMessages';
import Modal from '@/components/base/Modal';
import EmojiPicker from '@/components/base/EmojiPicker';
import ChatInputAddons from '@/components/base/ChatInputAddons';
import MessageContent from '@/components/base/MessageContent';

const FORM_URL = 'https://readdy.ai/api/form/d7q164vhqnrhtnv4fovg';

export default function Comunicacion() {
  const { user } = useAuth();
  const { isCliente } = useRole();

  const [inputMessage, setInputMessage] = useState('');
  const { messages, sendMessage, sendError } = useChatMessages('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notificación push cuando llega mensaje nuevo y la pestaña está en segundo plano
  const prevLengthRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLengthRef.current === null) { prevLengthRef.current = messages.length; return; }
    if (messages.length > prevLengthRef.current) {
      const newMsgs = messages.slice(prevLengthRef.current);
      for (const msg of newMsgs) {
        if (msg.sender_name !== (user?.full_name || 'Tú')) {
          if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
            const body = msg.text.length > 80 ? msg.text.slice(0, 80) + '…' : msg.text;
            const n = new Notification(`💬 ${msg.sender_name}`, { body, icon: '/favicon.svg' });
            n.onclick = () => { window.focus(); n.close(); };
            setTimeout(() => n.close(), 6000);
          }
        }
      }
      prevLengthRef.current = messages.length;
    }
  }, [messages, user?.full_name]);

  const send = () => {
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage.trim(), user?.full_name || 'Tú', user?.avatar_url || undefined);
    setInputMessage('');
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

  const isMine = (senderName: string) => senderName === (user?.full_name || 'Tú');

  const SENDER_COLORS = ['text-blue-400', 'text-emerald-400', 'text-purple-400', 'text-pink-400', 'text-yellow-400', 'text-teal-400', 'text-cyan-400'];
  const getSenderColor = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
  };

  // ── Modales ────────────────────────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ product: '', reason: '', notes: '' });
  const [showCallModal, setShowCallModal] = useState(false);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [videoProvider, setVideoProvider] = useState<'meet' | 'teams'>('meet');
  const [callNumber, setCallNumber] = useState('');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const processFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB'); return; }
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setUploadedFile(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.product || !reportForm.reason) return;
    setSubmitStatus('sending');
    const fd = new FormData();
    fd.append('product', reportForm.product);
    fd.append('reason', reportForm.reason);
    fd.append('notes', reportForm.notes || '');
    if (uploadedFileName) fd.append('attachment_name', uploadedFileName);
    try {
      const res = await fetch(FORM_URL, { method: 'POST', body: fd });
      if (res.ok) {
        setSubmitStatus('success');
        setReportForm({ product: '', reason: '', notes: '' });
        setUploadedFile(null); setUploadedFileName('');
        setTimeout(() => { setShowReportModal(false); setSubmitStatus('idle'); }, 2000);
      } else setSubmitStatus('error');
    } catch { setSubmitStatus('error'); }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-4rem)]">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Comunicación</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Chat en tiempo real con todo el equipo</p>
        </div>
        {!isCliente && (
          <button
            onClick={() => setShowReportModal(true)}
            className="px-3 py-2 border border-amber-200 text-amber-700 dark:text-amber-400 dark:border-amber-700/30 rounded-lg text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <i className="ri-alert-line" />
            <span className="hidden sm:inline">Reportar Incidencia de Carga</span>
          </button>
        )}
      </div>

      {/* Top action cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-chat-smile-2-line text-blue-600 text-xl" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">Chat grupal</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Todos pueden ver y responder</p>
          </div>
          <span className="px-2.5 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">Online</span>
        </div>
        <button
          onClick={() => { setShowCallModal(true); setCallNumber(''); }}
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 text-left hover:border-green-300 dark:hover:border-green-500 transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-phone-line text-green-600 text-xl" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">Llamadas</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Usa tu teléfono</p>
          </div>
        </button>
        <button
          onClick={() => setShowVideoCallModal(true)}
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 text-left hover:border-purple-300 dark:hover:border-purple-500 transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-video-chat-line text-purple-600 text-xl" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">Videollamadas</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Google Meet / Teams</p>
          </div>
          <span className="px-2.5 py-1 bg-purple-500 text-white rounded-full text-xs font-medium">Iniciar</span>
        </button>
      </div>

      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col rounded-2xl border border-gray-100 dark:border-slate-700/60 overflow-hidden shadow-sm bg-gray-50 dark:bg-slate-950"
        style={{ height: 'calc(100vh - 280px)' }}
      >
        {/* Chat header */}
        <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700/50 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-global-line text-orange-500 text-lg" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100">Chat General</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {messages.length} mensaje{messages.length !== 1 ? 's' : ''} · todos los miembros
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center mb-3">
                <i className="ri-chat-smile-3-line text-3xl text-orange-200 dark:text-orange-500/30" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Sin mensajes aún</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">¡Sé el primero en escribir!</p>
            </div>
          ) : messages.map((msg, idx) => {
            const mine = isMine(msg.sender_name);
            const prevMsg = messages[idx - 1];
            const showDate = !prevMsg || formatDate(prevMsg.created_at) !== formatDate(msg.created_at);
            const isConsecutive = !showDate && prevMsg && prevMsg.sender_name === msg.sender_name;
            const senderColor = getSenderColor(msg.sender_name || '');
            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200/60 dark:bg-slate-700/30" />
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 px-3 py-1 bg-gray-100 dark:bg-slate-800/60 rounded-full">
                      {formatDate(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200/60 dark:bg-slate-700/30" />
                  </div>
                )}
                <div className={`flex gap-2 items-end ${mine ? 'justify-end pl-10' : 'justify-start pr-10'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}>
                  {!mine && (
                    isConsecutive
                      ? <div className="w-7 flex-shrink-0" />
                      : <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center font-bold text-[11px] flex-shrink-0 self-end text-orange-600 dark:text-orange-400">
                          {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                  )}
                  <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && !isConsecutive && (
                      <span className={`text-[11px] font-semibold mb-1 pl-1 ${senderColor}`}>
                        {msg.sender_name}
                      </span>
                    )}
                    <div className={`px-3.5 py-2.5 text-sm
                      ${mine
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-[18px] rounded-br-[5px] shadow-sm shadow-orange-200 dark:shadow-orange-900/30'
                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-[18px] rounded-bl-[5px] shadow-sm'}`}>
                      <MessageContent text={msg.text} mine={mine} />
                    </div>
                    <span className={`text-[10px] mt-0.5 ${mine ? 'pr-1 text-gray-400 dark:text-slate-500' : 'pl-1 text-gray-400 dark:text-slate-500'}`}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  {mine && (
                    isConsecutive
                      ? <div className="w-7 flex-shrink-0" />
                      : <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 font-bold text-[11px] self-end">
                          {(user?.full_name || 'T').charAt(0).toUpperCase()}
                        </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700/50 flex-shrink-0 space-y-2">
          {sendError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
              <i className="ri-error-warning-line text-red-500 flex-shrink-0 text-sm" />
              <p className="text-xs text-red-600 dark:text-red-400 flex-1">{sendError}</p>
            </div>
          )}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-2xl px-3 py-1">
            <EmojiPicker onSelect={emoji => setInputMessage(prev => prev + emoji)} direction="up" />
            <ChatInputAddons onSendAttachment={att => sendMessage(att, user?.full_name || 'Tú', user?.avatar_url || undefined)} />
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-transparent py-2.5 text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600"
            />
            <button
              onClick={send}
              className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 flex-shrink-0 transition-all shadow-sm shadow-orange-200 dark:shadow-orange-900/30"
            >
              <i className="ri-send-plane-fill text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────────────────────── */}
      <Modal isOpen={showCallModal} onClose={() => setShowCallModal(false)} title="Realizar Llamada" size="sm">
        <div className="space-y-4">
          <div className="w-14 h-14 mx-auto bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <i className="ri-phone-line text-green-600 text-2xl" />
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center">Introduce el número de teléfono para llamar</p>
          <input type="tel" value={callNumber} onChange={e => setCallNumber(e.target.value)} placeholder="+34 600 11 22 33"
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none text-center" />
          <button onClick={() => callNumber.trim() && (window.location.href = `tel:${callNumber}`)}
            className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center justify-center gap-2">
            <i className="ri-phone-line" /> Llamar ahora
          </button>
        </div>
      </Modal>

      <Modal isOpen={showVideoCallModal} onClose={() => setShowVideoCallModal(false)} title="Iniciar Videollamada" size="sm">
        <div className="space-y-4">
          <div className="w-14 h-14 mx-auto bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
            <i className="ri-video-chat-line text-purple-600 text-2xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['meet', 'teams'] as const).map(p => (
              <button key={p} onClick={() => setVideoProvider(p)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${videoProvider === p
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                <i className={`${p === 'meet' ? 'ri-google-fill' : 'ri-microsoft-fill'} text-lg block mb-1`} />
                {p === 'meet' ? 'Google Meet' : 'Microsoft Teams'}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.open(videoProvider === 'meet' ? 'https://meet.google.com/new' : 'https://teams.microsoft.com/l/meeting/new', '_blank')}
            className="w-full py-2.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 flex items-center justify-center gap-2">
            <i className="ri-video-add-line" /> Crear reunión
          </button>
        </div>
      </Modal>

      <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)} title="Reportar Incidencia de Carga" size="md">
        <form ref={formRef} id="reportar-producto-danado" data-readdy-form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Descripción de la carga / mercancía</label>
            <input type="text" name="product" placeholder="Ej: Palet de cajas, Electrodoméstico, Documentación..." required
              value={reportForm.product} onChange={e => setReportForm(p => ({ ...p, product: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Tipo de incidencia</label>
            <select name="reason" required value={reportForm.reason} onChange={e => setReportForm(p => ({ ...p, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none">
              <option value="">Selecciona tipo...</option>
              <option value="rotura">Rotura / Deterioro</option>
              <option value="perdida">Pérdida de mercancía</option>
              <option value="dano_transporte">Daño durante transporte</option>
              <option value="entrega_incorrecta">Entrega incorrecta</option>
              <option value="retraso">Retraso en entrega</option>
              <option value="documentacion">Problema de documentación</option>
              <option value="temperatura">Incidencia de temperatura (cadena frío)</option>
              <option value="defecto_fabrica">Defecto de fábrica / embalaje</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Notas adicionales</label>
            <textarea name="notes" placeholder="Describe el problema..." rows={3} maxLength={500}
              value={reportForm.notes} onChange={e => setReportForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none resize-none" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Foto del producto</label>
            {uploadedFile ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                <img src={uploadedFile} alt="Preview" className="w-full h-36 object-cover" />
                <button type="button" onClick={() => { setUploadedFile(null); setUploadedFileName(''); }}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80">
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                onDrop={e => { e.preventDefault(); setIsDraggingFile(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
                onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={e => { e.preventDefault(); setIsDraggingFile(false); }}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors
                  ${isDraggingFile ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-700 hover:border-orange-300'}`}>
                <i className="ri-camera-line text-gray-400 dark:text-slate-500 text-2xl mb-1 block" />
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra o haz clic para seleccionar</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} className="hidden" />
              </div>
            )}
          </div>
          {submitStatus === 'success' && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium"><i className="ri-check-line mr-1" />Reporte enviado</p>
            </div>
          )}
          {submitStatus === 'error' && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium"><i className="ri-error-warning-line mr-1" />Error al enviar</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button type="button" onClick={() => setShowReportModal(false)}
              className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button type="submit" disabled={submitStatus === 'sending'}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
              {submitStatus === 'sending' ? <><i className="ri-loader-4-line animate-spin" />Enviando...</> : 'Enviar Reporte'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
