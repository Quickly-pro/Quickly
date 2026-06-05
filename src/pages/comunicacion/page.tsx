import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useChatMessages } from '@/hooks/useChatMessages';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import EmojiPicker from '@/components/base/EmojiPicker';
import ChatInputAddons from '@/components/base/ChatInputAddons';
import MessageContent from '@/components/base/MessageContent';

const ALL_CHANNELS = [
  { id: 'general',      name: 'General',      description: 'Canal general',       icon: 'ri-chat-1-line',        badge: 0, clienteVisible: true },
  { id: 'comerciales',  name: 'Comerciales',  description: 'Ventas y comerciales', icon: 'ri-store-2-line',       badge: 0, clienteVisible: true },
  { id: 'conductores',  name: 'Conductores',  description: 'Rutas y repartos',     icon: 'ri-truck-line',         badge: 0, clienteVisible: true },
  { id: 'almacen',      name: 'Almacén',      description: 'Gestión de stock',     icon: 'ri-box-3-line',         badge: 0, clienteVisible: false },
  { id: 'incidencias',  name: 'Incidencias',  description: 'Problemas y reportes', icon: 'ri-error-warning-line', badge: 1, clienteVisible: true },
];

interface DirectContact {
  id: string;        // 'client_5' or 'employee_3'
  name: string;
  type: 'client' | 'employee';
  dbId: number;
  email?: string;
}

const FORM_URL = 'https://readdy.ai/api/form/d7q164vhqnrhtnv4fovg';

export default function Comunicacion() {
  const { user } = useAuth();
  const { isEmpresa, isEmpleado, isCliente } = useRole();

  // ── Canal general ──────────────────────────────────────────────────────
  const channels = useMemo(() => {
    if (isCliente) return ALL_CHANNELS.filter(c => c.clienteVisible);
    return ALL_CHANNELS;
  }, [isCliente]);

  const [activeChannel, setActiveChannel] = useState('general');
  const [inputMessage, setInputMessage] = useState('');
  const { messages, sendMessage, sendError: channelSendError } = useChatMessages(activeChannel);

  // ── Mensajes directos ──────────────────────────────────────────────────
  // Para empresa: empieza en modo canal; para empleado/cliente: empieza en modo DM
  const [dmMode, setDmMode] = useState(!isEmpresa);
  const [directContacts, setDirectContacts] = useState<DirectContact[]>([]);
  const [selectedDM, setSelectedDM] = useState<DirectContact | null>(null);
  const [myDirectId, setMyDirectId] = useState<string | null>(null);
  const [dmInput, setDmInput] = useState('');
  const [dmSearch, setDmSearch] = useState('');
  const [lastMessages, setLastMessages] = useState<Record<string, { text: string; time: string; mine: boolean }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dmEndRef = useRef<HTMLDivElement>(null);

  // DM channel/target calculados
  const dmChannel = useMemo(() => {
    if (!dmMode) return '__none__';
    if (isEmpresa && selectedDM) return selectedDM.type === 'client' ? 'client' : 'employee';
    if (isEmpleado) return 'employee';
    if (isCliente) return 'client';
    return '__none__';
  }, [dmMode, isEmpresa, isEmpleado, isCliente, selectedDM]);

  const dmTargetId = useMemo(() => {
    if (!dmMode) return null;
    if (isEmpresa && selectedDM) return selectedDM.id;
    if ((isEmpleado || isCliente) && myDirectId) return myDirectId;
    return null;
  }, [dmMode, isEmpresa, isEmpleado, isCliente, selectedDM, myDirectId]);

  const { messages: dmMessages, sendMessage: sendDM, sendError: dmSendError } = useChatMessages(dmChannel, dmTargetId);

  // Cargar contactos para empresa + previsualizaciones de último mensaje
  const loadContacts = useCallback(async () => {
    if (!isEmpresa) return;

    const [{ data: empProfiles }, { data: clts }, { data: recentMsgs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'empleado'),
      supabase.from('clients').select('id, name, email'),
      // Traer todos los mensajes DM recientes para previsualizaciones
      supabase.from('chat_messages')
        .select('target_id, text, sender_name, created_at')
        .not('target_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    // Construir mapa de último mensaje por target_id
    const lastMap: Record<string, { text: string; time: string; mine: boolean }> = {};
    for (const msg of (recentMsgs || [])) {
      if (msg.target_id && !lastMap[msg.target_id]) {
        lastMap[msg.target_id] = {
          text: msg.text,
          time: new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          mine: false, // se actualiza abajo
        };
      }
    }
    setLastMessages(lastMap);

    const seenIds = new Set<string>();
    const list: DirectContact[] = [];

    // 1. Empleados registrados en la app (profiles con role='empleado')
    for (const p of (empProfiles || [])) {
      if (!seenIds.has(p.id)) {
        list.push({ id: p.id, name: p.full_name || 'Empleado', type: 'employee', dbId: 0 });
        seenIds.add(p.id);
      }
    }

    // 2. Clientes registrados en la tabla clients
    for (const c of (clts || [])) {
      const cid = `client_${c.id}`;
      if (!seenIds.has(cid)) {
        list.push({ id: cid, name: c.name, type: 'client', dbId: c.id, email: c.email });
        seenIds.add(cid);
      }
    }

    // Solo se muestran contactos reales (profiles empleados + clientes registrados)
    // NO se añaden conversaciones huérfanas de chat_messages

    // Ordenar: primero los que tienen mensajes recientes
    list.sort((a, b) => {
      const aHas = lastMap[a.id] ? 1 : 0;
      const bHas = lastMap[b.id] ? 1 : 0;
      return bHas - aHas;
    });

    setDirectContacts(list);
  }, [isEmpresa]);

  // Buscar propio ID para empleado/cliente y auto-abrir DM
  const findMyRecord = useCallback(async () => {
    if (!user) return;
    if (isEmpleado) {
      setMyDirectId(user.id); // profiles.id = user.id — mismo valor siempre
    } else if (isCliente) {
      const { data } = await supabase.from('clients').select('id').ilike('email', user.email).maybeSingle();
      setMyDirectId(data ? `client_${data.id}` : `auth_${user.id}`);
    }
  }, [user, isEmpleado, isCliente]);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { findMyRecord(); }, [findMyRecord]);

  // Eliminar toda la conversación de un DM
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);

  const deleteConversation = useCallback(async (targetId: string, channel: string) => {
    setDeletingChat(true);
    await supabase.from('chat_messages').delete().eq('target_id', targetId).eq('channel', channel);
    setDeletingChat(false);
    setConfirmDeleteChat(false);
    setLastMessages(prev => { const n = { ...prev }; delete n[targetId]; return n; });
    // Si era el DM activo, deseleccionar
    if (selectedDM?.id === targetId) { setSelectedDM(null); setDmMode(false); }
  }, [selectedDM]);

  // Actualizar previsualizaciones cuando llegan mensajes nuevos al DM activo
  useEffect(() => {
    if (dmTargetId && dmMessages.length > 0) {
      const last = dmMessages[dmMessages.length - 1];
      setLastMessages(prev => ({
        ...prev,
        [dmTargetId]: {
          text: last.text,
          time: new Date(last.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          mine: last.sender_name === (user?.full_name || 'Tú'),
        },
      }));
    }
  }, [dmMessages, dmTargetId, user]);

  // Auto-scroll al final de mensajes
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [dmMessages]);

  const filteredContacts = useMemo(() => {
    if (!dmSearch.trim()) return directContacts;
    return directContacts.filter(c => c.name.toLowerCase().includes(dmSearch.toLowerCase()));
  }, [directContacts, dmSearch]);

  const sendChannel = () => {
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage.trim(), user?.full_name || 'Tú', user?.avatar_url || undefined);
    setInputMessage('');
  };

  const sendDirectMsg = () => {
    if (!dmInput.trim()) return;
    sendDM(dmInput.trim(), user?.full_name || 'Tú', user?.avatar_url || undefined);
    setDmInput('');
  };

  const currentChannel = channels.find(c => c.id === activeChannel) || channels[0];

  // ── Modales y otros estados ────────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ product: '', reason: '', notes: '' });
  const [showCallModal, setShowCallModal] = useState(false);
  const [showVideoCallModal, setShowVideoCallModal] = useState(false);
  const [videoProvider, setVideoProvider] = useState<'meet' | 'teams'>('meet');
  const [callNumber, setCallNumber] = useState('');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle'|'sending'|'success'|'error'>('idle');
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

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const isMine = (senderName: string) => senderName === (user?.full_name || 'Tú');

  // Nombre del DM activo
  const dmTitle = useMemo(() => {
    if (isEmpresa && selectedDM) return selectedDM.name;
    if (isEmpleado || isCliente) return 'Empresa';
    return 'Mensajes directos';
  }, [isEmpresa, isEmpleado, isCliente, selectedDM]);

  const showDmChat = dmMode && (
    (isEmpresa && selectedDM !== null) ||
    ((isEmpleado || isCliente) && !!myDirectId)
  );

  return (
    <div className="space-y-4 h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Comunicación</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Canales del equipo y mensajes directos</p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Top action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-chat-smile-2-line text-blue-600 text-xl" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">Chat interno</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Activo ahora</p>
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

      {/* ── Chat layout ─────────────────────────────────────────────────── */}
      <div className="flex gap-3 min-h-0" style={{ height: 'calc(100vh - 280px)' }}>

        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden">

          {/* ── Mensajes Directos (sección principal) ── */}
          <div className="px-3 pt-3 pb-1 flex items-center justify-between border-b border-gray-100 dark:border-orange-500/10 flex-shrink-0">
            <p className="text-[10px] font-bold text-gray-400 dark:text-orange-500/60 uppercase tracking-widest">Conversaciones</p>
            {isEmpresa && <span className="text-[10px] text-gray-400 dark:text-slate-500">{directContacts.length} contactos</span>}
          </div>

          {/* Para empleado/cliente: entrada única a la empresa — SIEMPRE ACTIVA */}
          {(isEmpleado || isCliente) && (
            <button
              onClick={() => setDmMode(true)}
              className={`mx-2 mt-2 flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all w-[calc(100%-16px)] text-left
                ${dmMode
                  ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/30'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent'}`}
            >
              <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <i className="ri-building-line text-orange-500 text-base" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${dmMode ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>Empresa</p>
                {myDirectId
                  ? <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                      {lastMessages[myDirectId]
                        ? (lastMessages[myDirectId].mine ? 'Tú: ' : '') + lastMessages[myDirectId].text
                        : 'Escribe tu primer mensaje...'}
                    </p>
                  : <p className="text-xs text-orange-400 animate-pulse">Conectando...</p>
                }
              </div>
              {myDirectId && lastMessages[myDirectId] && (
                <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{lastMessages[myDirectId].time}</span>
              )}
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
            </button>
          )}

          {/* Para empresa: lista de todos los contactos con preview */}
          {isEmpresa && (
            <div className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
              {directContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-2">
                    <i className="ri-user-add-line text-gray-400 text-lg" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Sin conversaciones</p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                    Añade clientes y empleados. Ellos deben registrarse en la app para poder chatear.
                  </p>
                </div>
              ) : (
                directContacts.map(contact => {
                  const lastMsg = lastMessages[contact.id];
                  const isActive = dmMode && selectedDM?.id === contact.id;
                  return (
                    <button
                      key={contact.id}
                      onClick={() => { setSelectedDM(contact); setDmMode(true); setActiveChannel('general'); setConfirmDeleteChat(false); }}
                      className={`flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm transition-all w-full text-left
                        ${isActive
                          ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/30'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-800 border border-transparent'}`}
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
                        ${contact.type === 'client'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className={`text-xs font-semibold truncate ${isActive ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>
                            {contact.name}
                          </p>
                          <span className={`flex-shrink-0 text-[9px] px-1 py-0.5 rounded font-medium
                            ${contact.type === 'client' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' : 'bg-green-50 dark:bg-green-900/20 text-green-500'}`}>
                            {contact.type === 'client' ? 'CLI' : 'EMP'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                          {lastMsg ? (lastMsg.mine ? 'Tú: ' : '') + lastMsg.text : contact.email || 'Sin mensajes aún'}
                        </p>
                      </div>
                      {/* Hora */}
                      {lastMsg && <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{lastMsg.time}</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* ── Canales (sección secundaria) ── */}
          <div className="border-t border-gray-100 dark:border-orange-500/10 flex-shrink-0">
            <p className="text-[10px] font-bold text-gray-400 dark:text-orange-500/50 uppercase tracking-widest px-3 pt-2 pb-1">Canales</p>
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-hidden px-2 pb-2">
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => { setActiveChannel(ch.id); setDmMode(false); setSelectedDM(null); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all flex-shrink-0 w-full text-left
                    ${!dmMode && activeChannel === ch.id
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-medium'
                      : 'text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                >
                  <i className={`${ch.icon} text-xs`} />
                  <span className="flex-1 whitespace-nowrap">{ch.name}</span>
                  {ch.badge > 0 && (
                    <span className="w-3.5 h-3.5 flex items-center justify-center bg-red-500 text-white rounded-full text-[8px] font-bold">{ch.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Área de chat */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden min-w-0">

          {/* ── Vista: Canal general ── */}
          {!dmMode && (
            <>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-orange-500/10 flex items-center gap-2 flex-shrink-0">
                <i className="ri-chat-1-line text-orange-500 text-sm" />
                <div>
                  <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">{currentChannel.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{currentChannel.description}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                    <i className="ri-chat-off-line text-3xl mb-2" />
                    <p className="text-sm">Sin mensajes aún. ¡Sé el primero!</p>
                  </div>
                ) : messages.map(msg => (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 font-bold text-sm">
                      {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{msg.sender_name}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{formatTime(msg.created_at)}</span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-slate-300 mt-0.5">
                        <MessageContent text={msg.text} mine={false} />
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-gray-100 dark:border-orange-500/10 flex-shrink-0 space-y-2">
                {channelSendError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                    <i className="ri-error-warning-line text-red-500 flex-shrink-0 text-sm" />
                    <p className="text-xs text-red-600 dark:text-red-400 flex-1">{channelSendError}</p>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <EmojiPicker onSelect={emoji => setInputMessage(prev => prev + emoji)} direction="up" />
                  <ChatInputAddons onSendAttachment={att => sendMessage(att, user?.full_name || 'Tú', user?.avatar_url || undefined)} />
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChannel()}
                    placeholder={`Escribe en ${currentChannel.name}...`}
                    className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm outline-none text-gray-800 dark:text-slate-200"
                  />
                  <button onClick={sendChannel} className="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex-shrink-0">
                    <i className="ri-send-plane-fill" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Vista: Mensajes directos ── */}
          {dmMode && (
            <>
              {/* Header DM */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-orange-500/10 flex items-center gap-3 flex-shrink-0">
                {isEmpresa && (
                  <>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                      ${selectedDM?.type === 'client' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                      {selectedDM ? selectedDM.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm truncate">{selectedDM?.name || 'Selecciona un contacto'}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {selectedDM?.type === 'client' ? 'Cliente' : selectedDM?.type === 'employee' ? 'Empleado' : ''}
                        {selectedDM?.email && ` · ${selectedDM.email}`}
                      </p>
                    </div>
                  </>
                )}
                {(isEmpleado || isCliente) && (
                  <>
                    <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <i className="ri-building-line text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm">Empresa</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">Mensajes directos con tu empresa</p>
                    </div>
                  </>
                )}
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 flex-shrink-0">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  En línea
                </span>

                {/* Botón eliminar chat — solo empresa con contacto seleccionado */}
                {isEmpresa && selectedDM && (
                  confirmDeleteChat ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-1.5 flex-shrink-0">
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">¿Eliminar chat?</span>
                      <button
                        onClick={() => deleteConversation(selectedDM.id, selectedDM.type === 'client' ? 'client' : 'employee')}
                        disabled={deletingChat}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1 font-medium disabled:opacity-50 whitespace-nowrap"
                      >
                        {deletingChat ? '...' : 'Sí, eliminar'}
                      </button>
                      <button onClick={() => setConfirmDeleteChat(false)} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 px-1">Cancelar</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteChat(true)}
                      title="Eliminar conversación"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all flex-shrink-0"
                    >
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  )
                )}
              </div>

              {/* Sin contacto seleccionado (empresa) */}
              {isEmpresa && !selectedDM && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 p-6">
                  <i className="ri-chat-private-line text-4xl mb-3 text-orange-300 dark:text-orange-500/40" />
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400 mb-1">Selecciona un contacto</p>
                  <p className="text-xs text-center text-gray-400 dark:text-slate-500">Elige un empleado o cliente del panel izquierdo para iniciar una conversación privada</p>
                </div>
              )}

              {/* Sin ID propio aún (empleado/cliente cargando) */}
              {(isEmpleado || isCliente) && !myDirectId && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm">Conectando...</p>
                </div>
              )}


              {/* Mensajes DM */}
              {showDmChat && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {dmMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                        <i className="ri-chat-private-line text-3xl mb-2" />
                        <p className="text-sm">Sin mensajes aún. ¡Empieza la conversación!</p>
                      </div>
                    ) : (
                      dmMessages.map((msg, i) => {
                        const mine = isMine(msg.sender_name);
                        const prevMsg = dmMessages[i - 1];
                        const showDate = !prevMsg || formatDate(prevMsg.created_at) !== formatDate(msg.created_at);
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center gap-3 my-2">
                                <div className="flex-1 h-px bg-gray-100 dark:bg-orange-500/10" />
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap">{formatDate(msg.created_at)}</span>
                                <div className="flex-1 h-px bg-gray-100 dark:bg-orange-500/10" />
                              </div>
                            )}
                            <div className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                              {!mine && (
                                <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 font-bold text-xs self-end">
                                  {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                              )}
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm
                                ${mine
                                  ? 'bg-orange-500 text-white rounded-br-md'
                                  : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-md'}`}>
                                {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{msg.sender_name}</p>}
                                <MessageContent text={msg.text} mine={mine} />
                                <p className={`text-[10px] mt-1 text-right ${mine ? 'text-orange-100' : 'text-gray-400 dark:text-slate-500'}`}>
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                              {mine && (
                                <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 font-bold text-xs self-end">
                                  {(user?.full_name || 'T').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={dmEndRef} />
                  </div>

                  {/* Input DM */}
                  <div className="p-3 border-t border-gray-100 dark:border-orange-500/10 flex-shrink-0 space-y-2">
                    {dmSendError && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                        <i className="ri-error-warning-line text-red-500 flex-shrink-0 text-sm" />
                        <p className="text-xs text-red-600 dark:text-red-400 flex-1">{dmSendError}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <EmojiPicker onSelect={emoji => setDmInput(prev => prev + emoji)} direction="up" />
                      <ChatInputAddons onSendAttachment={att => sendDM(att, user?.full_name || 'Tú', user?.avatar_url || undefined)} />
                      <input
                        type="text"
                        value={dmInput}
                        onChange={e => setDmInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendDirectMsg()}
                        placeholder={`Escribe a ${dmTitle}...`}
                        className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm outline-none text-gray-800 dark:text-slate-200"
                      />
                      <button onClick={sendDirectMsg} className="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex-shrink-0">
                        <i className="ri-send-plane-fill" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────────────────── */}
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
