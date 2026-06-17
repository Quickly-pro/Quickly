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
  { id: 'general', name: 'General', description: 'Canal general', icon: 'ri-chat-1-line', badge: 0, clienteVisible: true },
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

  // ── Feed agregado para empresa en General (todos los mensajes de todos los canales) ──
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const fetchAllMessages = useCallback(async () => {
    if (!isEmpresa) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);
    if (data) setAllMessages(data);
  }, [isEmpresa]);

  useEffect(() => {
    if (!isEmpresa) return;
    fetchAllMessages();
    const interval = setInterval(fetchAllMessages, 4000);
    const sub = supabase
      .channel('all_msgs_empresa_' + Math.random())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, fetchAllMessages)
      .subscribe();
    return () => { clearInterval(interval); sub.unsubscribe(); };
  }, [isEmpresa, fetchAllMessages]);

  // ── Mensajes directos ──────────────────────────────────────────────────
  // Para empresa: empieza en modo canal; para empleado/cliente: empieza en modo DM
  const [dmMode, setDmMode] = useState(!isEmpresa);
  const [directContacts, setDirectContacts] = useState<DirectContact[]>([]);
  const [selectedDM, setSelectedDM] = useState<DirectContact | null>(null);
  const [myDirectId, setMyDirectId] = useState<string | null>(null);
  const [dmInput, setDmInput] = useState('');
  const [dmSearch, setDmSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>(isEmpresa ? 'list' : 'chat');
  const [lastMessages, setLastMessages] = useState<Record<string, { text: string; time: string; mine: boolean; at?: string }>>({});
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
    const lastMap: Record<string, { text: string; time: string; mine: boolean; at?: string }> = {};
    for (const msg of (recentMsgs || [])) {
      if (msg.target_id && !lastMap[msg.target_id]) {
        lastMap[msg.target_id] = {
          text: msg.text,
          time: new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          mine: false,
          at: msg.created_at,
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

    // Solo mostrar contactos que han enviado al menos un mensaje, ordenados por más reciente
    const withMessages = list.filter(c => !!lastMap[c.id]);
    withMessages.sort((a, b) => (lastMap[b.id]?.at || '').localeCompare(lastMap[a.id]?.at || ''));

    setDirectContacts(withMessages);
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
          at: last.created_at,
        },
      }));
    }
  }, [dmMessages, dmTargetId, user]);

  // Auto-scroll al final de mensajes
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, allMessages]);
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

  const SENDER_COLORS = ['text-blue-400', 'text-emerald-400', 'text-purple-400', 'text-pink-400', 'text-yellow-400', 'text-teal-400', 'text-cyan-400'];
  const getSenderColor = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
  };

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
      <div className={`grid grid-cols-1 gap-3 ${isEmpresa ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {!isEmpresa && (
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
        )}
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
      <div className="flex min-h-0 rounded-2xl border border-gray-100 dark:border-slate-700/60 overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 280px)' }}>

        {/* ── Sidebar ── */}
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[260px] flex-shrink-0 border-r border-gray-100 dark:border-slate-700/60 bg-white dark:bg-slate-900`}>

          {/* Sidebar header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-slate-700/40 flex-shrink-0">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-base mb-3">Mensajes</h2>
            {isEmpresa && (
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm pointer-events-none" />
                <input
                  placeholder="Buscar contacto..."
                  value={dmSearch}
                  onChange={e => setDmSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm outline-none text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-600"
                />
              </div>
            )}
          </div>

          {/* Para empresa: botón General + lista de contactos */}
          {isEmpresa && (
            <>
              <button
                onClick={() => { setDmMode(false); setSelectedDM(null); setActiveChannel('general'); setConfirmDeleteChat(false); setMobileView('chat'); }}
                className={`flex items-center gap-3 w-full px-4 py-3 transition-all border-l-[3px] flex-shrink-0
                  ${!dmMode
                    ? 'bg-orange-50 dark:bg-orange-900/10 border-l-orange-500'
                    : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all
                  ${!dmMode
                    ? 'bg-orange-500 shadow-md shadow-orange-200 dark:shadow-orange-900/40'
                    : 'bg-orange-100 dark:bg-orange-900/20'}`}>
                  <i className={`ri-global-line text-base ${!dmMode ? 'text-white' : 'text-orange-500'}`} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-semibold ${!dmMode ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>
                    General
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">Todas las conversaciones</p>
                </div>
                {allMessages.length > 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{allMessages.length}</span>
                )}
              </button>

              <div className="mx-4 border-t border-gray-100 dark:border-slate-700/40 flex-shrink-0" />

              {/* Lista de contactos */}
              <div className="flex-1 overflow-y-auto">
                {filteredContacts.length === 0 && directContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <i className="ri-user-add-line text-gray-300 dark:text-slate-600 text-xl" />
                    </div>
                    <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Sin contactos aún</p>
                    <p className="text-xs text-gray-300 dark:text-slate-600 mt-1 leading-relaxed">Los clientes y empleados registrados aparecerán aquí</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <i className="ri-search-line text-2xl text-gray-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs text-gray-400 dark:text-slate-500">Sin resultados</p>
                  </div>
                ) : (
                  filteredContacts.map(contact => {
                    const lastMsg = lastMessages[contact.id];
                    const isActive = dmMode && selectedDM?.id === contact.id;
                    return (
                      <button
                        key={contact.id}
                        onClick={() => { setSelectedDM(contact); setDmMode(true); setActiveChannel('general'); setConfirmDeleteChat(false); setMobileView('chat'); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 transition-all border-l-[3px]
                          ${isActive
                            ? 'bg-orange-50 dark:bg-orange-900/10 border-l-orange-500'
                            : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                            ${contact.type === 'client'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-200 dark:bg-slate-600 rounded-full border-2 border-white dark:border-slate-900" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-sm font-semibold truncate ${isActive ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>
                              {contact.name}
                            </span>
                            {lastMsg && (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0 whitespace-nowrap">{lastMsg.time}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0
                              ${contact.type === 'client'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400'
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400'}`}>
                              {contact.type === 'client' ? 'CLI' : 'EMP'}
                            </span>
                            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                              {lastMsg
                                ? (lastMsg.mine ? 'Tú: ' : '') + lastMsg.text
                                : contact.email || 'Sin mensajes aún'}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Para empleado/cliente: entrada única a la empresa */}
          {(isEmpleado || isCliente) && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <button
                onClick={() => { setDmMode(true); setMobileView('chat'); }}
                className={`flex items-center gap-3 w-full px-4 py-3 border-l-[3px] transition-all flex-shrink-0
                  ${dmMode
                    ? 'bg-orange-50 dark:bg-orange-900/10 border-l-orange-500'
                    : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <i className="ri-building-line text-orange-500 text-base" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-slate-900" />
                </div>
                <div className="flex-1 min-w-0 text-left">
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
              </button>
            </div>
          )}
        </div>

        {/* ── Área de chat ── */}
        <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-gray-50 dark:bg-slate-950 min-w-0`}>

          {/* ── Vista: Canal general ── */}
          {!dmMode && (
            <>
              <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700/50 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 flex-shrink-0 -ml-1"
                >
                  <i className="ri-arrow-left-line text-base" />
                </button>
                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                  <i className="ri-global-line text-orange-500 text-lg" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">General</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {isEmpresa
                      ? `${allMessages.length} mensaje${allMessages.length !== 1 ? 's' : ''} · clientes y empleados`
                      : currentChannel.description}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
                {(isEmpresa ? allMessages : messages).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center mb-3">
                      <i className="ri-chat-smile-3-line text-3xl text-orange-200 dark:text-orange-500/30" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Sin mensajes aún</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      {isEmpresa ? 'Los mensajes de clientes y empleados aparecerán aquí' : '¡Sé el primero en escribir!'}
                    </p>
                  </div>
                ) : (isEmpresa ? allMessages : messages).map((msg, idx) => {
                  const mine = isMine(msg.sender_name);
                  const prevMsg = (isEmpresa ? allMessages : messages)[idx - 1];
                  const showDate = !prevMsg || formatDate(prevMsg.created_at) !== formatDate(msg.created_at);
                  const isConsecutive = !showDate && prevMsg && prevMsg.sender_name === msg.sender_name;
                  const senderColor = getSenderColor(msg.sender_name || '');
                  const channelLabel = msg.channel === 'client' ? 'CLI' : msg.channel === 'employee' ? 'EMP' : null;
                  const avatarCls =
                    msg.channel === 'client' ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                    msg.channel === 'employee' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                    'bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400';
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-gray-200/60 dark:bg-slate-700/30" />
                          <span className="text-[11px] text-gray-400 dark:text-slate-500 px-3 py-1 bg-gray-100 dark:bg-slate-800/60 rounded-full">{formatDate(msg.created_at)}</span>
                          <div className="flex-1 h-px bg-gray-200/60 dark:bg-slate-700/30" />
                        </div>
                      )}
                      <div className={`flex gap-2 items-end ${mine ? 'justify-end pl-10' : 'justify-start pr-10'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}>
                        {/* Avatar recibido */}
                        {!mine && (
                          isConsecutive
                            ? <div className="w-7 flex-shrink-0" />
                            : <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 self-end ${avatarCls}`}>
                                {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                        )}
                        {/* Burbuja */}
                        <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                          {!mine && !isConsecutive && (
                            <div className="flex items-center gap-1.5 mb-1 pl-1">
                              <span className={`text-[11px] font-semibold ${senderColor}`}>{msg.sender_name}</span>
                              {channelLabel && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold
                                  ${msg.channel === 'client' ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-500 dark:text-emerald-400'}`}>
                                  {channelLabel}
                                </span>
                              )}
                            </div>
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
                        {/* Avatar enviado */}
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

              <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700/50 flex-shrink-0 space-y-2">
                {channelSendError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
                    <i className="ri-error-warning-line text-red-500 flex-shrink-0 text-sm" />
                    <p className="text-xs text-red-600 dark:text-red-400 flex-1">{channelSendError}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-2xl px-3 py-1">
                  <EmojiPicker onSelect={emoji => setInputMessage(prev => prev + emoji)} direction="up" />
                  <ChatInputAddons onSendAttachment={att => sendMessage(att, user?.full_name || 'Tú', user?.avatar_url || undefined)} />
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChannel()}
                    placeholder="Escribe en General..."
                    className="flex-1 bg-transparent py-2.5 text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600"
                  />
                  <button
                    onClick={sendChannel}
                    className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 flex-shrink-0 transition-all shadow-sm shadow-orange-200 dark:shadow-orange-900/30"
                  >
                    <i className="ri-send-plane-fill text-sm" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Vista: Mensajes directos ── */}
          {dmMode && (
            <>
              {/* Header DM */}
              <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700/50 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 flex-shrink-0 -ml-1"
                >
                  <i className="ri-arrow-left-line text-base" />
                </button>
                {isEmpresa && selectedDM && (
                  <>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
                      ${selectedDM.type === 'client'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                      {selectedDM.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{selectedDM.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          {selectedDM.type === 'client' ? 'Cliente' : 'Empleado'}
                          {selectedDM.email && ` · ${selectedDM.email}`}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {(isEmpleado || isCliente) && (
                  <>
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <i className="ri-building-line text-orange-500 text-base" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100">Empresa</p>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        <span className="text-xs text-gray-400 dark:text-slate-500">En línea</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Botón eliminar */}
                {isEmpresa && selectedDM && (
                  confirmDeleteChat ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-3 py-1.5 flex-shrink-0">
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">¿Eliminar?</span>
                      <button
                        onClick={() => deleteConversation(selectedDM.id, selectedDM.type === 'client' ? 'client' : 'employee')}
                        disabled={deletingChat}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1 font-medium disabled:opacity-50"
                      >
                        {deletingChat ? '...' : 'Sí'}
                      </button>
                      <button onClick={() => setConfirmDeleteChat(false)} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 px-1">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteChat(true)}
                      title="Eliminar conversación"
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all flex-shrink-0"
                    >
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  )
                )}
              </div>

              {/* Sin contacto seleccionado (empresa) */}
              {isEmpresa && !selectedDM && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center mb-4">
                    <i className="ri-chat-private-line text-2xl text-orange-200 dark:text-orange-500/30" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-slate-400 mb-1">Selecciona un contacto</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed max-w-xs">Elige un empleado o cliente del panel izquierdo para iniciar una conversación privada</p>
                </div>
              )}

              {/* Cargando (empleado/cliente) */}
              {(isEmpleado || isCliente) && !myDirectId && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-400 dark:text-slate-500">Conectando...</p>
                </div>
              )}

              {/* Mensajes DM */}
              {showDmChat && (
                <>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                    {dmMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center mb-3">
                          <i className="ri-chat-smile-3-line text-3xl text-orange-200 dark:text-orange-500/30" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Sin mensajes aún</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Empieza la conversación</p>
                      </div>
                    ) : dmMessages.map((msg, i) => {
                      const mine = isMine(msg.sender_name);
                      const prevMsg = dmMessages[i - 1];
                      const showDate = !prevMsg || formatDate(prevMsg.created_at) !== formatDate(msg.created_at);
                      const isConsecutive = !showDate && prevMsg && isMine(prevMsg.sender_name) === mine;
                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700/40" />
                              <span className="text-[11px] text-gray-400 dark:text-slate-500 px-2">{formatDate(msg.created_at)}</span>
                              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700/40" />
                            </div>
                          )}
                          <div className={`flex gap-2.5 items-end ${mine ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}>
                            {/* Avatar recibido */}
                            {!mine ? (
                              isConsecutive
                                ? <div className="w-8 flex-shrink-0" />
                                : <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 font-bold text-xs">
                                    {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                            ) : null}

                            {/* Burbuja */}
                            <div className="max-w-[68%]">
                              {!mine && !isConsecutive && (
                                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 mb-1 pl-1">{msg.sender_name}</p>
                              )}
                              <div className={`px-4 py-2.5 text-sm leading-relaxed
                                ${mine
                                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl rounded-br-sm shadow-sm shadow-orange-200 dark:shadow-orange-900/40'
                                  : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-2xl rounded-bl-sm shadow-sm'}`}>
                                <MessageContent text={msg.text} mine={mine} />
                              </div>
                              <p className={`text-[10px] mt-1 ${mine ? 'text-right pr-1 text-gray-400 dark:text-slate-500' : 'pl-1 text-gray-400 dark:text-slate-500'}`}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>

                            {/* Avatar enviado */}
                            {mine ? (
                              isConsecutive
                                ? <div className="w-8 flex-shrink-0" />
                                : <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 font-bold text-xs">
                                    {(user?.full_name || 'T').charAt(0).toUpperCase()}
                                  </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={dmEndRef} />
                  </div>

                  {/* Input DM */}
                  <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700/50 flex-shrink-0 space-y-2">
                    {dmSendError && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
                        <i className="ri-error-warning-line text-red-500 flex-shrink-0 text-sm" />
                        <p className="text-xs text-red-600 dark:text-red-400 flex-1">{dmSendError}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-2xl px-3 py-1">
                      <EmojiPicker onSelect={emoji => setDmInput(prev => prev + emoji)} direction="up" />
                      <ChatInputAddons onSendAttachment={att => sendDM(att, user?.full_name || 'Tú', user?.avatar_url || undefined)} />
                      <input
                        type="text"
                        value={dmInput}
                        onChange={e => setDmInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendDirectMsg()}
                        placeholder={`Escribe a ${dmTitle}...`}
                        className="flex-1 bg-transparent py-2.5 text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600"
                      />
                      <button
                        onClick={sendDirectMsg}
                        className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 flex-shrink-0 transition-all shadow-sm shadow-orange-200 dark:shadow-orange-900/30"
                      >
                        <i className="ri-send-plane-fill text-sm" />
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
