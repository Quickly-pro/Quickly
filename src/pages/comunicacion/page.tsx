import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChatMessages } from '@/hooks/useChatMessages';
import Modal from '@/components/base/Modal';

const channels = [
  { id: 'general', name: 'General', description: 'Canal general', icon: 'ri-chat-1-line', badge: 0 },
  { id: 'comerciales', name: 'Comerciales', description: 'Ventas y comerciales', icon: 'ri-store-2-line', badge: 0 },
  { id: 'conductores', name: 'Conductores', description: 'Rutas y repartos', icon: 'ri-truck-line', badge: 0 },
  { id: 'almacen', name: 'Almacén', description: 'Gestión de stock', icon: 'ri-box-3-line', badge: 0 },
  { id: 'incidencias', name: 'Incidencias', description: 'Problemas y reportes', icon: 'ri-error-warning-line', badge: 1 },
];

const FORM_URL = 'https://readdy.ai/api/form/d7q164vhqnrhtnv4fovg';

export default function Comunicacion() {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState('general');
  const [inputMessage, setInputMessage] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ product: '', reason: '', notes: '' });

  const { messages, sendMessage } = useChatMessages(activeChannel);

  // Call states
  const [showCallModal, setShowCallModal] = useState(false);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [videoProvider, setVideoProvider] = useState<'meet' | 'teams'>('meet');
  const [callNumber, setCallNumber] = useState('');

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const currentChannel = channels.find(c => c.id === activeChannel) || channels[0];

  const sendLocalMessage = () => {
    if (!inputMessage.trim()) return;
    const sender = user?.full_name || 'Tú';
    sendMessage(inputMessage.trim(), sender);
    setInputMessage('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo no puede superar los 5MB');
      return;
    }
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedFile(ev.target?.result as string || null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const clearFile = () => {
    setUploadedFile(null);
    setUploadedFileName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.product || !reportForm.reason) return;

    setSubmitStatus('sending');
    const formData = new FormData();
    formData.append('product', reportForm.product);
    formData.append('reason', reportForm.reason);
    formData.append('notes', reportForm.notes || '');
    if (uploadedFileName) {
      formData.append('attachment_name', uploadedFileName);
    }

    try {
      const res = await fetch(FORM_URL, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setSubmitStatus('success');
        setReportForm({ product: '', reason: '', notes: '' });
        clearFile();
        setTimeout(() => {
          setShowReportModal(false);
          setSubmitStatus('idle');
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch {
      setSubmitStatus('error');
    }
  };

  // Call functions
  const handleCall = () => {
    if (callNumber.trim()) {
      window.location.href = `tel:${callNumber}`;
    }
  };

  const handleStartVideoCall = () => {
    const meetUrl = 'https://meet.google.com/new';
    const teamsUrl = 'https://teams.microsoft.com/l/meeting/new';
    window.open(videoProvider === 'meet' ? meetUrl : teamsUrl, '_blank');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Chat General</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Comunicación del equipo</p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="px-4 py-2 border border-amber-200 text-amber-700 dark:text-amber-400 dark:border-amber-700/30 rounded-lg text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-alert-line" />
          </div>
          Reportar Producto Dañado
        </button>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-chat-smile-2-line text-blue-600 text-xl" />
            </div>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-slate-200">Chat interno</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Activo ahora</p>
          </div>
          <span className="px-2.5 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">Online</span>
        </div>
        <button
          onClick={() => { setShowCallModal(true); setCallNumber(''); }}
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 text-left hover:border-green-300 dark:hover:border-green-500 transition-all"
        >
          <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-phone-line text-green-600 text-xl" />
            </div>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-slate-200">Llamadas</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Usa tu teléfono</p>
          </div>
        </button>
        <button
          onClick={() => { setShowVideoCallModal(true); }}
          className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 text-left hover:border-purple-300 dark:hover:border-purple-500 transition-all"
        >
          <div className="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-video-chat-line text-purple-600 text-xl" />
            </div>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-slate-200">Videollamadas</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Google Meet / Teams</p>
          </div>
          <span className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium whitespace-nowrap">
            Iniciar
          </span>
        </button>
      </div>

      {/* Chat Layout */}
      <div className="flex gap-4 flex-1 min-h-0 flex-col md:flex-row">
        {/* Channels sidebar */}
        <div className="w-full md:w-56 flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3 flex flex-col">
          <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-2">Canales</p>
          <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-hidden pb-1 md:pb-0">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all flex-shrink-0
                  ${activeChannel === channel.id
                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-medium'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className={channel.icon} />
                </div>
                <span className="flex-1 text-left whitespace-nowrap">{channel.name}</span>
                {channel.badge > 0 && (
                  <span className="w-5 h-5 flex items-center justify-center bg-red-500 text-white rounded-full text-xs font-medium">
                    {channel.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-chat-1-line text-orange-500" />
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">{currentChannel.name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{currentChannel.description}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                <div className="w-12 h-12 flex items-center justify-center mb-2">
                  <i className="ri-chat-off-line text-3xl" />
                </div>
                <p className="text-sm">Sin mensajes aún. ¡Sé el primero!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <img src={msg.avatar_url || 'https://readdy.ai/api/search-image?query=generic%20user%20avatar%20profile%20icon%20neutral%20background&width=40&height=40&seq=206&orientation=squarish'} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{msg.sender_name}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-slate-300 mt-0.5">{msg.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendLocalMessage()}
                placeholder={`Escribe en ${currentChannel.name}...`}
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm outline-none focus:bg-gray-100 dark:focus:bg-slate-700 text-gray-800 dark:text-slate-200"
              />
              <button
                onClick={sendLocalMessage}
                className="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <i className="ri-send-plane-fill" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Call Modal */}
      <Modal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        title="Realizar Llamada"
        size="sm"
      >
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-phone-line text-green-600 text-2xl" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center">Introduce el número de teléfono para llamar</p>
          <input
            type="tel"
            value={callNumber}
            onChange={(e) => setCallNumber(e.target.value)}
            placeholder="+34 600 11 22 33"
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-green-300 text-center"
          />
          <button
            onClick={handleCall}
            className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center justify-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-phone-line" />
            </div>
            Llamar ahora
          </button>
        </div>
      </Modal>

      {/* Video Call Modal */}
      <Modal
        isOpen={showVideoCallModal}
        onClose={() => setShowVideoCallModal(false)}
        title="Iniciar Videollamada"
        size="sm"
      >
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-video-chat-line text-purple-600 text-2xl" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center">Selecciona la plataforma para la reunión</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setVideoProvider('meet')}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${videoProvider === 'meet'
                ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
            >
              <div className="w-6 h-6 mx-auto flex items-center justify-center mb-1">
                <i className="ri-google-fill text-lg" />
              </div>
              Google Meet
            </button>
            <button
              onClick={() => setVideoProvider('teams')}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${videoProvider === 'teams'
                ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
            >
              <div className="w-6 h-6 mx-auto flex items-center justify-center mb-1">
                <i className="ri-microsoft-fill text-lg" />
              </div>
              Microsoft Teams
            </button>
          </div>
          <button
            onClick={handleStartVideoCall}
            className="w-full py-2.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 flex items-center justify-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-video-add-line" />
            </div>
            Crear reunión
          </button>
        </div>
      </Modal>

      {/* Report Damaged Product Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Reportar Producto Dañado"
        size="md"
      >
        <form
          ref={formRef}
          id="reportar-producto-danado"
          data-readdy-form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Producto</label>
            <input
              type="text"
              name="product"
              placeholder="Nombre del producto..."
              value={reportForm.product}
              onChange={e => setReportForm(prev => ({ ...prev, product: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Motivo</label>
            <select
              name="reason"
              value={reportForm.reason}
              onChange={e => setReportForm(prev => ({ ...prev, reason: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
            >
              <option value="">Selecciona motivo...</option>
              <option value="rotura">Rotura / Deterioro</option>
              <option value="caducidad">Caducidad vencida</option>
              <option value="dano_transporte">Daño durante transporte</option>
              <option value="defecto_fabrica">Defecto de fábrica</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Notas adicionales</label>
            <textarea
              name="notes"
              placeholder="Describe el problema..."
              value={reportForm.notes}
              onChange={e => setReportForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300 resize-none"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Foto del producto</label>
            {uploadedFile ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                <img src={uploadedFile} alt="Preview" className="w-full h-40 object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{uploadedFileName}</span>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80"
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-orange-500/80 text-white rounded-md text-xs">
                  <i className="ri-error-warning-line mr-1" />
                  Uncollectable
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                  ${isDraggingFile ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500'}`}
              >
                <div className="w-10 h-10 mx-auto flex items-center justify-center mb-2">
                  <i className="ri-camera-line text-gray-400 dark:text-slate-500 text-2xl" />
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra una foto o haz clic para seleccionar</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">JPG, PNG hasta 5MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {submitStatus === 'success' && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                <i className="ri-check-line mr-1" />
                Reporte enviado correctamente
              </p>
            </div>
          )}
          {submitStatus === 'error' && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                <i className="ri-error-warning-line mr-1" />
                Error al enviar. Inténtalo de nuevo.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitStatus === 'sending'}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
            >
              {submitStatus === 'sending' ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Reporte'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
