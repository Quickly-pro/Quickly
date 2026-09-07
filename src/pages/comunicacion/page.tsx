import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import EmojiPicker from '@/components/base/EmojiPicker';
import ChatInputAddons from '@/components/base/ChatInputAddons';
import MessageContent from '@/components/base/MessageContent';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const CARGO_ISSUE_LABELS: Record<string, string> = {
  rotura: 'Rotura / Deterioro',
  perdida: 'Pérdida de mercancía',
  dano_transporte: 'Daño durante transporte',
  entrega_incorrecta: 'Entrega incorrecta',
  retraso: 'Retraso en entrega',
  documentacion: 'Problema de documentación',
  temperatura: 'Incidencia de temperatura (cadena frío)',
  defecto_fabrica: 'Defecto de fábrica / embalaje',
  otro: 'Otro',
};

interface DirectContact {
  id: string;
  name: string;
  type: 'client' | 'employee';
  dbId: number;
  email?: string;
}

async function fireBrowserChatNotif(senderName: string, text: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const body = text.length > 80 ? text.slice(0, 80) + '…' : text;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(`💬 ${senderName}`, { body, icon: '/favicon.svg' });
      return;
    }
  } catch {
    // seguir al método clásico de abajo
  }

  try {
    const n = new Notification(`💬 ${senderName}`, { body, icon: '/favicon.svg' });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  } catch {
    // Una notificación fallida nunca debe romper el chat.
  }
}

export default function Comunicacion() {
  const { user } = useAuth();
  const { isEmpresa, isEmpleado, isCliente } = useRole();

  // ── Canal general ──────────────────────────────────────────────────────
  const [inputMessage, setInputMessage] = useState('');
  const [sendAnimGeneral, setSendAnimGeneral] = useState(false);
  const { messages, sendMessage, sendError, editMessage, deleteForEveryone, hideForMe, markAsRead, toggleStar } = useChatMessages('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Mensajes directos ──────────────────────────────────────────────────
  const [dmMode, setDmMode] = useState(!isEmpresa);
  const [selectedDM, setSelectedDM] = useState<DirectContact | null>(null);
  const [directContacts, setDirectContacts] = useState<DirectContact[]>([]);
  const [myDirectId, setMyDirectId] = useState<string | null>(null);
  const [dmInput, setDmInput] = useState('');
  const [sendAnimDM, setSendAnimDM] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>(isEmpresa ? 'list' : 'chat');
  const [lastMessages, setLastMessages] = useState<Record<string, { text: string; time: string; mine: boolean; at?: string }>>({});
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const dmEndRef = useRef<HTMLDivElement>(null);

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

  const { messages: dmMessages, sendMessage: sendDM, sendError: dmSendError, editMessage: editDM, deleteForEveryone: deleteDMEveryone, hideForMe: hideDMForMe, markAsRead: markDMAsRead, toggleStar: toggleStarDM } = useChatMessages(dmChannel, dmTargetId);

  // ── Reacciones ───────────────────────────────────────────────────────
  const generalIds = useMemo(() => messages.map(m => m.id), [messages]);
  const dmIds = useMemo(() => dmMessages.map(m => m.id), [dmMessages]);
  const { byMessage: reactionsGeneral, react: reactGeneral } = useMessageReactions(generalIds, user?.id);
  const { byMessage: reactionsDM, react: reactDM } = useMessageReactions(dmIds, user?.id);

  // ── "Escribiendo..." ─────────────────────────────────────────────────
  const { typingUsers: typingGeneral, notifyTyping: notifyTypingGeneral } = useTypingIndicator('general', null, user?.full_name || 'Tú');
  const { typingUsers: typingDM, notifyTyping: notifyTypingDM } = useTypingIndicator(dmChannel, dmTargetId, user?.full_name || 'Tú');

  const loadContacts = useCallback(async () => {
    if (!isEmpresa) return;
    const [{ data: empProfiles }, { data: clts }, { data: recentMsgs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'empleado'),
      supabase.from('clients').select('id, name, email'),
      supabase.from('chat_messages')
        .select('target_id, text, sender_name, created_at')
        .not('target_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

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
    for (const p of (empProfiles || [])) {
      if (!seenIds.has(p.id)) {
        list.push({ id: p.id, name: p.full_name || 'Empleado', type: 'employee', dbId: 0 });
        seenIds.add(p.id);
      }
    }
    for (const c of (clts || [])) {
      const cid = `client_${c.id}`;
      if (!seenIds.has(cid)) {
        list.push({ id: cid, name: c.name, type: 'client', dbId: c.id, email: c.email });
        seenIds.add(cid);
      }
    }
    list.sort((a, b) => {
      const aAt = lastMap[a.id]?.at || '';
      const bAt = lastMap[b.id]?.at || '';
      if (bAt && !aAt) return 1;
      if (aAt && !bAt) return -1;
      return bAt.localeCompare(aAt);
    });
    setDirectContacts(list);
  }, [isEmpresa]);

  const findMyRecord = useCallback(async () => {
    if (!user) return;
    if (isEmpleado) {
      setMyDirectId(user.id);
    } else if (isCliente) {
      const { data, error } = await supabase.from('clients').select('id').ilike('email', user.email).maybeSingle();
      if (error) console.error('Error al buscar el registro del cliente', error);
      setMyDirectId(data ? `client_${data.id}` : `auth_${user.id}`);
    }
  }, [user, isEmpleado, isCliente]);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { findMyRecord(); }, [findMyRecord]);

  const deleteConversation = useCallback(async (targetId: string, channel: string) => {
    setDeletingChat(true);
    const { error } = await supabase.from('chat_messages').delete().eq('target_id', targetId).eq('channel', channel);
    if (error) console.error('Error al eliminar la conversación', error);
    setDeletingChat(false);
    setConfirmDeleteChat(false);
    setLastMessages(prev => { const n = { ...prev }; delete n[targetId]; return n; });
    if (selectedDM?.id === targetId) { setSelectedDM(null); setDmMode(false); }
  }, [selectedDM]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [dmMessages]);

  // Marcar como leído al ver la conversación (doble check azul)
  useEffect(() => { if (!dmMode && messages.length > 0) markAsRead(); }, [messages.length, dmMode, markAsRead]);
  useEffect(() => { if (dmMode && dmTargetId && dmMessages.length > 0) markDMAsRead(); }, [dmMessages.length, dmMode, dmTargetId, markDMAsRead]);

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

  // Notificaciones push – General
  const prevGeneralRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevGeneralRef.current === null) { prevGeneralRef.current = messages.length; return; }
    if (messages.length > prevGeneralRef.current) {
      messages.slice(prevGeneralRef.current).forEach(msg => {
        if (msg.sender_name !== (user?.full_name || 'Tú')) fireBrowserChatNotif(msg.sender_name || 'General', msg.text);
      });
      prevGeneralRef.current = messages.length;
    }
  }, [messages, user?.full_name]);

  // Notificaciones push – DM
  const prevDMRef = useRef<number | null>(null);
  useEffect(() => { prevDMRef.current = null; }, [dmTargetId]);
  useEffect(() => {
    if (prevDMRef.current === null) { prevDMRef.current = dmMessages.length; return; }
    if (dmMessages.length > prevDMRef.current) {
      dmMessages.slice(prevDMRef.current).forEach(msg => {
        if (msg.sender_name !== (user?.full_name || 'Tú')) fireBrowserChatNotif(msg.sender_name || 'Mensaje directo', msg.text);
      });
      prevDMRef.current = dmMessages.length;
    }
  }, [dmMessages, user?.full_name]);

  const filteredContacts = useMemo(() => {
    if (!dmSearch.trim()) return directContacts;
    return directContacts.filter(c => c.name.toLowerCase().includes(dmSearch.toLowerCase()));
  }, [directContacts, dmSearch]);

  // ── Menú de acciones por mensaje ────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: number; scope: 'general' | 'dm' } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: number; text: string; sender: string; scope: 'general' | 'dm' } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // ── Reenviar ─────────────────────────────────────────────────────────
  const [forwardingText, setForwardingText] = useState<string | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSentTo, setForwardSentTo] = useState<string | null>(null);

  // ── Destacados ───────────────────────────────────────────────────────
  const [showStarredModal, setShowStarredModal] = useState(false);
  const [starredMessages, setStarredMessages] = useState<any[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(false);

  useEffect(() => {
    if (openMenuId === null) return;
    const closeMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.msg-menu-trigger') && !target.closest('.msg-menu-panel')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [openMenuId]);

  const startEdit = (msg: any, scope: 'general' | 'dm') => {
    setEditingMessage({ id: msg.id, scope });
    setReplyingTo(null);
    if (scope === 'general') setInputMessage(msg.text);
    else setDmInput(msg.text);
    setOpenMenuId(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputMessage('');
    setDmInput('');
  };

  const startReply = (msg: any, scope: 'general' | 'dm') => {
    setEditingMessage(null);
    setReplyingTo({ id: msg.id, text: msg.text, sender: msg.sender_name, scope });
    setOpenMenuId(null);
  };

  const cancelReply = () => setReplyingTo(null);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
    setOpenMenuId(null);
  };

  const handleDeleteForMe = (id: number, scope: 'general' | 'dm') => {
    (scope === 'general' ? hideForMe : hideDMForMe)(id);
    setOpenMenuId(null);
  };

  const handleDeleteForEveryone = (id: number, scope: 'general' | 'dm') => {
    (scope === 'general' ? deleteForEveryone : deleteDMEveryone)(id);
    setOpenMenuId(null);
  };

  const handleToggleStar = (id: number, scope: 'general' | 'dm') => {
    (scope === 'general' ? toggleStar : toggleStarDM)(id);
    setOpenMenuId(null);
  };

  const handleReact = (id: number, scope: 'general' | 'dm', emoji: string) => {
    (scope === 'general' ? reactGeneral : reactDM)(id, emoji);
    setOpenMenuId(null);
  };

  const openForward = (text: string) => {
    setForwardingText(text);
    setShowForwardModal(true);
    setForwardSentTo(null);
    setOpenMenuId(null);
  };

  const forwardTo = async (destChannel: string, destTargetId: string | null, label: string) => {
    if (!forwardingText) return;
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) console.error('Error al obtener el usuario autenticado', authError);
    const { error } = await supabase.from('chat_messages').insert({
      sender_id: authUser?.id ?? null,
      sender_name: user?.full_name || 'Tú',
      text: forwardingText,
      channel: destChannel,
      target_id: destTargetId,
      avatar_url: user?.avatar_url ?? null,
      sender_type: 'user',
      forwarded: true,
    });
    if (error) console.error('Error al reenviar el mensaje', error);
    setForwardSentTo(label);
    setTimeout(() => { setShowForwardModal(false); setForwardingText(null); setForwardSentTo(null); }, 1200);
  };

  const openStarred = async () => {
    setShowStarredModal(true);
    setLoadingStarred(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .contains('starred_by', [user?.id])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) console.error('Error al cargar los mensajes destacados', error);
    setStarredMessages(data || []);
    setLoadingStarred(false);
  };

  const send = () => {
    if (editingMessage && editingMessage.scope === 'general') {
      if (!inputMessage.trim()) return;
      editMessage(editingMessage.id, inputMessage.trim());
      setInputMessage('');
      setEditingMessage(null);
      return;
    }
    if (!inputMessage.trim()) return;
    sendMessage(inputMessage.trim(), user?.full_name || 'Tú', user?.avatar_url || undefined, { replyToId: replyingTo?.scope === 'general' ? replyingTo.id : null });
    setInputMessage('');
    setReplyingTo(null);
    setSendAnimGeneral(true);
    setTimeout(() => setSendAnimGeneral(false), 600);
  };

  const sendDirectMsg = () => {
    if (editingMessage && editingMessage.scope === 'dm') {
      if (!dmInput.trim()) return;
      editDM(editingMessage.id, dmInput.trim());
      setDmInput('');
      setEditingMessage(null);
      return;
    }
    if (!dmInput.trim()) return;
    sendDM(dmInput.trim(), user?.full_name || 'Tú', user?.avatar_url || undefined, { replyToId: replyingTo?.scope === 'dm' ? replyingTo.id : null });
    setDmInput('');
    setReplyingTo(null);
    setSendAnimDM(true);
    setTimeout(() => setSendAnimDM(false), 600);
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

  const dmTitle = useMemo(() => {
    if (isEmpresa && selectedDM) return selectedDM.name;
    if (isEmpleado || isCliente) return 'Empresa';
    return 'Chat privado';
  }, [isEmpresa, isEmpleado, isCliente, selectedDM]);

  const showDmChat = dmMode && (
    (isEmpresa && selectedDM !== null) ||
    ((isEmpleado || isCliente) && !!myDirectId)
  );

  // Destinos disponibles para reenviar, según el rol
  const forwardDestinations = useMemo(() => {
    const dests: { label: string; channel: string; targetId: string | null }[] = [
      { label: 'General', channel: 'general', targetId: null },
    ];
    if (isEmpresa) {
      directContacts.forEach(c => dests.push({ label: c.name, channel: c.type === 'client' ? 'client' : 'employee', targetId: c.id }));
    } else if ((isEmpleado || isCliente) && myDirectId) {
      dests.push({ label: 'Empresa', channel: dmChannel === '__none__' ? (isEmpleado ? 'employee' : 'client') : dmChannel, targetId: myDirectId });
    }
    return dests;
  }, [isEmpresa, isEmpleado, isCliente, directContacts, myDirectId, dmChannel]);

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
    // Se guarda como una incidencia de producto real (misma tabla que usa
    // Incidencias) — antes este formulario se enviaba a un endpoint de
    // Readdy.ai (la herramienta de prototipado), así que ningún reporte
    // llegaba de verdad a la empresa.
    const { error } = await supabase.from('product_incidents').insert([{
      product_name: reportForm.product,
      type: CARGO_ISSUE_LABELS[reportForm.reason] || reportForm.reason,
      description: reportForm.notes || '(sin notas adicionales)',
      status: 'abierta',
      date: new Date().toISOString().split('T')[0],
      photo: uploadedFile || null,
      reported_by: user?.full_name || user?.email || '',
    }]);
    if (!error) {
      setSubmitStatus('success');
      setReportForm({ product: '', reason: '', notes: '' });
      setUploadedFile(null); setUploadedFileName('');
      setTimeout(() => { setShowReportModal(false); setSubmitStatus('idle'); }, 2000);
    } else setSubmitStatus('error');
  };

  // ── Render de burbujas (reutilizable) ──────────────────────────────────
  const renderBubbles = (
    msgListRaw: any[],
    endRef: React.RefObject<HTMLDivElement>,
    scope: 'general' | 'dm',
    reactionsOf: (id: number) => { emoji: string; count: number; mine: boolean }[]
  ) => {
    const msgList = msgListRaw.filter(m => !m.hidden_for?.includes(user?.id));
    return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
      {msgList.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center mb-3">
            <i className="ri-chat-smile-3-line text-3xl text-orange-200 dark:text-orange-500/30" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Sin mensajes aún</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">¡Sé el primero en escribir!</p>
        </div>
      ) : msgList.map((msg, idx) => {
        const mine = isMine(msg.sender_name);
        const prevMsg = msgList[idx - 1];
        const showDate = !prevMsg || formatDate(prevMsg.created_at) !== formatDate(msg.created_at);
        const isConsecutive = !showDate && prevMsg && prevMsg.sender_name === msg.sender_name;
        const senderColor = getSenderColor(msg.sender_name || '');
        const isAttachment = msg.text?.startsWith('[[ATTACH]]');
        const menuOpen = openMenuId === msg.id;
        const reactions = reactionsOf(msg.id);
        const repliedMsg = msg.reply_to_id ? msgList.find(m => m.id === msg.reply_to_id) : null;
        const isStarred = msg.starred_by?.includes(user?.id);
        const isRead = mine && (msg.read_by?.length || 0) > 0;
        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200/60 dark:bg-slate-700/30" />
                <span className="text-[11px] text-gray-400 dark:text-slate-500 px-3 py-1 bg-gray-100 dark:bg-slate-800/60 rounded-full">{formatDate(msg.created_at)}</span>
                <div className="flex-1 h-px bg-gray-200/60 dark:bg-slate-700/30" />
              </div>
            )}
            <div className={`flex gap-2 items-end group ${mine ? 'justify-end pl-10' : 'justify-start pr-10'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}>
              {!mine && (
                isConsecutive
                  ? <div className="w-7 flex-shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center font-bold text-[11px] flex-shrink-0 self-end text-orange-600 dark:text-orange-400">
                      {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
              )}
              <div className={`flex flex-col relative ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && !isConsecutive && (
                  <span className={`text-[11px] font-semibold mb-1 pl-1 ${senderColor}`}>{msg.sender_name}</span>
                )}
                <div className="relative flex items-center gap-1">
                  {mine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : msg.id); }}
                      className="msg-menu-trigger opacity-0 group-hover:opacity-100 focus:opacity-100 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-opacity flex-shrink-0 order-first"
                    >
                      <i className="ri-more-2-fill text-sm" />
                    </button>
                  )}
                  <div className={`px-3.5 py-2.5 text-sm max-w-[70vw] sm:max-w-sm
                    ${mine
                      ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-[18px] rounded-br-[5px] shadow-sm shadow-orange-200 dark:shadow-orange-900/30'
                      : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-[18px] rounded-bl-[5px] shadow-sm'}`}>
                    {msg.forwarded && (
                      <p className={`text-[10px] italic mb-1 flex items-center gap-1 ${mine ? 'text-orange-100' : 'text-gray-400 dark:text-slate-500'}`}>
                        <i className="ri-share-forward-line" /> Reenviado
                      </p>
                    )}
                    {repliedMsg && (
                      <div className={`mb-1.5 pl-2 border-l-2 rounded-sm py-1 px-1.5 text-xs
                        ${mine ? 'border-orange-100/60 bg-black/10' : 'border-orange-400 bg-gray-50 dark:bg-slate-700/60'}`}>
                        <p className={`font-semibold ${mine ? 'text-orange-50' : 'text-orange-600 dark:text-orange-400'}`}>{repliedMsg.sender_name}</p>
                        <p className={`truncate ${mine ? 'text-orange-100/80' : 'text-gray-500 dark:text-slate-400'}`}>
                          {repliedMsg.text?.startsWith('[[ATTACH]]') ? '📎 Adjunto' : repliedMsg.text}
                        </p>
                      </div>
                    )}
                    <MessageContent text={msg.text} mine={mine} />
                  </div>
                  {!mine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : msg.id); }}
                      className="msg-menu-trigger opacity-0 group-hover:opacity-100 focus:opacity-100 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-opacity flex-shrink-0"
                    >
                      <i className="ri-more-2-fill text-sm" />
                    </button>
                  )}

                  {menuOpen && (
                    <div className={`msg-menu-panel absolute z-20 top-full mt-1 ${mine ? 'right-0' : 'left-0'} w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden py-1`}>
                      <div className="flex items-center justify-around px-2 py-1.5 border-b border-gray-100 dark:border-slate-700">
                        {QUICK_REACTIONS.map(emoji => (
                          <button key={emoji} onClick={() => handleReact(msg.id, scope, emoji)} className="text-lg hover:scale-125 transition-transform">
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => startReply(msg, scope)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <i className="ri-reply-line" /> Responder
                      </button>
                      {!isAttachment && (
                        <button onClick={() => handleCopy(msg.text, msg.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                          <i className="ri-file-copy-line" /> {copiedId === msg.id ? '¡Copiado!' : 'Copiar'}
                        </button>
                      )}
                      <button onClick={() => openForward(msg.text)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <i className="ri-share-forward-line" /> Reenviar
                      </button>
                      <button onClick={() => handleToggleStar(msg.id, scope)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <i className={isStarred ? 'ri-star-fill text-amber-400' : 'ri-star-line'} /> {isStarred ? 'Quitar destacado' : 'Destacar'}
                      </button>
                      {mine && !isAttachment && (
                        <button onClick={() => startEdit(msg, scope)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                          <i className="ri-pencil-line" /> Editar
                        </button>
                      )}
                      <button onClick={() => handleDeleteForMe(msg.id, scope)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                        <i className="ri-delete-bin-line" /> Eliminar para mí
                      </button>
                      {mine && (
                        <button onClick={() => handleDeleteForEveryone(msg.id, scope)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <i className="ri-delete-bin-2-line" /> Eliminar para todos
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {reactions.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                    {reactions.map(r => (
                      <button
                        key={r.emoji}
                        onClick={() => handleReact(msg.id, scope, r.emoji)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-all
                          ${r.mine ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600'}`}
                      >
                        <span>{r.emoji}</span>
                        {r.count > 1 && <span className="text-gray-500 dark:text-slate-400">{r.count}</span>}
                      </button>
                    ))}
                  </div>
                )}

                <span className={`text-[10px] mt-0.5 flex items-center gap-1 ${mine ? 'pr-1 text-gray-400 dark:text-slate-500' : 'pl-1 text-gray-400 dark:text-slate-500'}`}>
                  {isStarred && <i className="ri-star-fill text-amber-400" />}
                  {msg.edited_at && <span className="italic">editado ·</span>}
                  {formatTime(msg.created_at)}
                  {mine && (
                    <i className={isRead ? 'ri-check-double-line text-blue-400' : 'ri-check-line'} />
                  )}
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
      <div ref={endRef} />
    </div>
  );
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100svh-5.5rem-92px)] sm:h-[calc(100svh-6rem-92px)] md:h-[calc(100svh-7rem)]">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Comunicación</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Chat grupal y mensajes privados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openStarred}
            title="Mensajes destacados"
            className="w-9 h-9 flex items-center justify-center border border-gray-200 dark:border-slate-700 text-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all"
          >
            <i className="ri-star-line" />
          </button>
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

      {/* Top cards — solo desktop */}
      <div className="hidden md:grid grid-cols-3 gap-3 flex-shrink-0">
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

      {/* ── Chat layout ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 rounded-2xl border border-gray-100 dark:border-slate-700/60 overflow-hidden shadow-sm">

        {/* ── Sidebar ── */}
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[260px] flex-shrink-0 border-r border-gray-100 dark:border-slate-700/60 bg-white dark:bg-slate-900`}>

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

          {/* Empresa: General + lista de contactos */}
          {isEmpresa && (
            <>
              <button
                onClick={() => { setDmMode(false); setSelectedDM(null); setConfirmDeleteChat(false); setMobileView('chat'); }}
                className={`flex items-center gap-3 w-full px-4 py-3 transition-all border-l-[3px] flex-shrink-0
                  ${!dmMode ? 'bg-orange-50 dark:bg-orange-900/10 border-l-orange-500' : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0
                  ${!dmMode ? 'bg-orange-500 shadow-md shadow-orange-200 dark:shadow-orange-900/40' : 'bg-orange-100 dark:bg-orange-900/20'}`}>
                  <i className={`ri-global-line text-base ${!dmMode ? 'text-white' : 'text-orange-500'}`} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-semibold ${!dmMode ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>General</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">Chat grupal · todos los miembros</p>
                </div>
                {messages.length > 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{messages.length}</span>
                )}
              </button>

              <div className="mx-4 my-1 border-t border-gray-100 dark:border-slate-700/40 flex-shrink-0" />
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex-shrink-0">Chats privados</p>

              <div className="flex-1 overflow-y-auto">
                {directContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-2">
                      <i className="ri-user-line text-gray-300 dark:text-slate-600 text-lg" />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500">No hay empleados ni clientes registrados</p>
                  </div>
                ) : (() => {
                  const employees = filteredContacts.filter(c => c.type === 'employee');
                  const clients = filteredContacts.filter(c => c.type === 'client');
                  const renderContact = (contact: DirectContact) => {
                    const lastMsg = lastMessages[contact.id];
                    const isActive = dmMode && selectedDM?.id === contact.id;
                    return (
                      <button
                        key={contact.id}
                        onClick={() => { setSelectedDM(contact); setDmMode(true); setConfirmDeleteChat(false); setMobileView('chat'); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 transition-all border-l-[3px]
                          ${isActive ? 'bg-orange-50 dark:bg-orange-900/10 border-l-orange-500' : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                            ${contact.type === 'client' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          {lastMsg
                            ? <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-slate-900" />
                            : <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-200 dark:bg-slate-600 rounded-full border-2 border-white dark:border-slate-900" />
                          }
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-sm font-semibold truncate ${isActive ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>
                              {contact.name}
                            </span>
                            {lastMsg && <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{lastMsg.time}</span>}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">
                            {lastMsg
                              ? (lastMsg.mine ? 'Tú: ' : '') + lastMsg.text
                              : <span className="italic text-gray-300 dark:text-slate-600">Toca para enviar un mensaje</span>
                            }
                          </p>
                        </div>
                        {!lastMsg && (
                          <i className="ri-chat-new-line text-gray-300 dark:text-slate-600 text-base flex-shrink-0" />
                        )}
                      </button>
                    );
                  };
                  return (
                    <>
                      {employees.length > 0 && (
                        <>
                          <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">
                            Empleados · {employees.length}
                          </p>
                          {employees.map(renderContact)}
                        </>
                      )}
                      {clients.length > 0 && (
                        <>
                          <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider">
                            Clientes · {clients.length}
                          </p>
                          {clients.map(renderContact)}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {/* Empleado / Cliente */}
          {(isEmpleado || isCliente) && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* General */}
              <button
                onClick={() => { setDmMode(false); setMobileView('chat'); }}
                className={`flex items-center gap-3 w-full px-4 py-3 border-l-[3px] transition-all flex-shrink-0
                  ${!dmMode ? 'bg-orange-50 dark:bg-orange-900/10 border-l-orange-500' : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0
                  ${!dmMode ? 'bg-orange-500' : 'bg-orange-100 dark:bg-orange-900/20'}`}>
                  <i className={`ri-global-line text-base ${!dmMode ? 'text-white' : 'text-orange-500'}`} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-semibold ${!dmMode ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>General</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Chat grupal · todos los miembros</p>
                </div>
              </button>

              <div className="mx-4 my-1 border-t border-gray-100 dark:border-slate-700/40 flex-shrink-0" />
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex-shrink-0">Chat privado</p>

              {/* Empresa (DM) */}
              <button
                onClick={() => { setDmMode(true); setMobileView('chat'); }}
                className={`flex items-center gap-3 w-full px-4 py-3 border-l-[3px] transition-all flex-shrink-0
                  ${dmMode ? 'bg-orange-50 dark:bg-orange-900/10 border-l-orange-500' : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <i className="ri-building-line text-orange-500 text-base" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-slate-900" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm font-semibold ${dmMode ? 'text-orange-700 dark:text-orange-400' : 'text-gray-800 dark:text-slate-200'}`}>Empresa</p>
                  {myDirectId
                    ? <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                        {lastMessages[myDirectId]
                          ? (lastMessages[myDirectId].mine ? 'Tú: ' : '') + lastMessages[myDirectId].text
                          : 'Escribe tu primer mensaje privado...'}
                      </p>
                    : <p className="text-xs text-orange-400 animate-pulse">Conectando...</p>
                  }
                </div>
              </button>
            </div>
          )}
        </div>

        {/* ── Área de chat ── */}
        <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-gray-50 dark:bg-slate-950 min-w-0`}>

          {/* Vista General */}
          {!dmMode && (
            <>
              <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700/50 flex items-center gap-3 flex-shrink-0">
                <button onClick={() => setMobileView('list')} className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 flex-shrink-0 -ml-1">
                  <i className="ri-arrow-left-line text-base" />
                </button>
                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                  <i className="ri-global-line text-orange-500 text-lg" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">Chat General</p>
                  {typingGeneral.length > 0 ? (
                    <p className="text-xs text-orange-500 italic">{typingGeneral.join(', ')} escribiendo...</p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-slate-500">{messages.length} mensaje{messages.length !== 1 ? 's' : ''} · todos los miembros</p>
                  )}
                </div>
              </div>

              {renderBubbles(messages, messagesEndRef, 'general', reactionsGeneral)}

              <div className="px-4 pt-3 pb-[calc(0.75rem+92px)] md:pb-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700/50 flex-shrink-0 space-y-2">
                {sendError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
                    <i className="ri-error-warning-line text-red-500 flex-shrink-0 text-sm" />
                    <p className="text-xs text-red-600 dark:text-red-400 flex-1">{sendError}</p>
                  </div>
                )}
                {editingMessage?.scope === 'general' && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <i className="ri-pencil-line" /> Editando mensaje
                    </span>
                    <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                      <i className="ri-close-line" />
                    </button>
                  </div>
                )}
                {replyingTo?.scope === 'general' && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-xl">
                    <div className="min-w-0">
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1.5">
                        <i className="ri-reply-line" /> Respondiendo a {replyingTo.sender}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{replyingTo.text.startsWith('[[ATTACH]]') ? '📎 Adjunto' : replyingTo.text}</p>
                    </div>
                    <button onClick={cancelReply} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 flex-shrink-0">
                      <i className="ri-close-line" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 rounded-2xl px-2 py-1">
                  <EmojiPicker onSelect={emoji => setInputMessage(prev => prev + emoji)} direction="up" />
                  <ChatInputAddons onSendAttachment={att => sendMessage(att, user?.full_name || 'Tú', user?.avatar_url || undefined)} />
                  <input
                    type="text" value={inputMessage}
                    onChange={e => { setInputMessage(e.target.value); notifyTypingGeneral(); }}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Escribe en General..."
                    className="chat-input-field flex-1 min-w-0 bg-transparent py-2.5 text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600"
                  />
                  <button onClick={send} disabled={!inputMessage.trim()} className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 flex-shrink-0 transition-all shadow-sm disabled:opacity-40 overflow-visible">
                    {editingMessage?.scope === 'general'
                      ? <i className="ri-check-line text-base" />
                      : <i className={`ri-send-plane-fill text-sm inline-block ${sendAnimGeneral ? 'send-fly-animate' : ''}`} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Vista DM */}
          {dmMode && (
            <>
              <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700/50 flex items-center gap-3 flex-shrink-0">
                <button onClick={() => setMobileView('list')} className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 flex-shrink-0 -ml-1">
                  <i className="ri-arrow-left-line text-base" />
                </button>

                {isEmpresa && selectedDM ? (
                  <>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
                      ${selectedDM.type === 'client' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                      {selectedDM.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{selectedDM.name}</p>
                      {typingDM.length > 0 ? (
                        <p className="text-xs text-orange-500 italic">escribiendo...</p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                          <span className="text-xs text-gray-400 dark:text-slate-500">
                            {selectedDM.type === 'client' ? 'Cliente' : 'Empleado'}
                            {selectedDM.email && ` · ${selectedDM.email}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <i className="ri-building-line text-orange-500 text-base" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100">Empresa</p>
                      {typingDM.length > 0 ? (
                        <p className="text-xs text-orange-500 italic">escribiendo...</p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                          <span className="text-xs text-gray-400 dark:text-slate-500">Chat privado · En línea</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {isEmpresa && selectedDM && (
                  confirmDeleteChat ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-3 py-1.5 flex-shrink-0">
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">¿Eliminar?</span>
                      <button
                        onClick={() => deleteConversation(selectedDM.id, selectedDM.type === 'client' ? 'client' : 'employee')}
                        disabled={deletingChat}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1 font-medium disabled:opacity-50"
                      >{deletingChat ? '...' : 'Sí'}</button>
                      <button onClick={() => setConfirmDeleteChat(false)} className="text-xs text-gray-500 dark:text-slate-400 px-1">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteChat(true)} title="Eliminar conversación"
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all flex-shrink-0">
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  )
                )}
              </div>

              {isEmpresa && !selectedDM && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/10 flex items-center justify-center mb-4">
                    <i className="ri-chat-private-line text-2xl text-orange-200 dark:text-orange-500/30" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-slate-400 mb-1">Selecciona un contacto</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed max-w-xs">Elige un empleado o cliente del panel para iniciar un chat privado</p>
                </div>
              )}

              {(isEmpleado || isCliente) && !myDirectId && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-400 dark:text-slate-500">Conectando...</p>
                </div>
              )}

              {showDmChat && (
                <>
                  {renderBubbles(dmMessages, dmEndRef, 'dm', reactionsDM)}

                  <div className="px-4 pt-3 pb-[calc(0.75rem+92px)] md:pb-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700/50 flex-shrink-0 space-y-2">
                    {dmSendError && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
                        <i className="ri-error-warning-line text-red-500 flex-shrink-0 text-sm" />
                        <p className="text-xs text-red-600 dark:text-red-400 flex-1">{dmSendError}</p>
                      </div>
                    )}
                    {editingMessage?.scope === 'dm' && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <i className="ri-pencil-line" /> Editando mensaje
                        </span>
                        <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    {replyingTo?.scope === 'dm' && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-xl">
                        <div className="min-w-0">
                          <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1.5">
                            <i className="ri-reply-line" /> Respondiendo a {replyingTo.sender}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{replyingTo.text.startsWith('[[ATTACH]]') ? '📎 Adjunto' : replyingTo.text}</p>
                        </div>
                        <button onClick={cancelReply} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 flex-shrink-0">
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 rounded-2xl px-2 py-1">
                      <EmojiPicker onSelect={emoji => setDmInput(prev => prev + emoji)} direction="up" />
                      <ChatInputAddons onSendAttachment={att => sendDM(att, user?.full_name || 'Tú', user?.avatar_url || undefined)} />
                      <input
                        type="text" value={dmInput}
                        onChange={e => { setDmInput(e.target.value); notifyTypingDM(); }}
                        onKeyDown={e => e.key === 'Enter' && sendDirectMsg()}
                        placeholder={`Escribe a ${dmTitle}...`}
                        className="chat-input-field flex-1 min-w-0 bg-transparent py-2.5 text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600"
                      />
                      <button onClick={sendDirectMsg} disabled={!dmInput.trim()} className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 flex-shrink-0 transition-all shadow-sm disabled:opacity-40 overflow-visible">
                        {editingMessage?.scope === 'dm'
                          ? <i className="ri-check-line text-base" />
                          : <i className={`ri-send-plane-fill text-sm inline-block ${sendAnimDM ? 'send-fly-animate' : ''}`} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal: Reenviar ─────────────────────────────────────────────────── */}
      <Modal isOpen={showForwardModal} onClose={() => { setShowForwardModal(false); setForwardingText(null); }} title="Reenviar mensaje" size="sm">
        <div className="space-y-2">
          {forwardSentTo ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
              <i className="ri-check-double-line text-green-500 text-2xl block mb-1" />
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">Reenviado a {forwardSentTo}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Elige a quién reenviar este mensaje:</p>
              {forwardDestinations.map(dest => (
                <button
                  key={`${dest.channel}_${dest.targetId}`}
                  onClick={() => forwardTo(dest.channel, dest.targetId, dest.label)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-xs flex-shrink-0">
                    {dest.label.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-slate-200">{dest.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </Modal>

      {/* ── Modal: Destacados ───────────────────────────────────────────────── */}
      <Modal isOpen={showStarredModal} onClose={() => setShowStarredModal(false)} title="Mensajes destacados" size="md">
        {loadingStarred ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : starredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <i className="ri-star-line text-3xl text-gray-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-slate-500">Aún no has destacado ningún mensaje</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {starredMessages.map(msg => (
              <div key={msg.id} className="p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">{msg.sender_name}</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">{formatDate(msg.created_at)} · {formatTime(msg.created_at)}</span>
                </div>
                <MessageContent text={msg.text} mine={false} />
              </div>
            ))}
          </div>
        )}
      </Modal>

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
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
