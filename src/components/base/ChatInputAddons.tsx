/**
 * Botones de adjuntos para los chats:
 *   📎 Clip   → seleccionar imagen o archivo
 *   🎤 Micro  → mantener presionado para grabar (estilo WhatsApp):
 *               - Soltar dentro del botón  → detener y previsualizar
 *               - Deslizar hacia arriba    → bloquear grabación (manos libres)
 *               - Deslizar hacia la izquierda → cancelar
 *
 * onSendAttachment recibe el texto codificado ([[ATTACH]]...) listo para enviar.
 *
 * Nota: la forma de onda mientras grabas es una animación puramente visual
 * (CSS), NO lee el micrófono en vivo. Antes se leía el audio en vivo con la
 * Web Audio API en paralelo al MediaRecorder — en algunos Android eso hacía
 * que la grabación real saliera vacía o corrupta. Se quitó por completo esa
 * combinación para que solo MediaRecorder toque el micrófono.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { encodeAttachment } from './MessageContent';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { supabase } from '@/lib/supabase';

interface Props {
  onSendAttachment: (encodedText: string) => void;
  disabled?: boolean;
}

const CANCEL_THRESHOLD = 80;  // px arrastrados a la izquierda para cancelar
const LOCK_THRESHOLD = 60;    // px arrastrados hacia arriba para bloquear
const MIN_VALID_BYTES = 800;  // por debajo de esto, tratamos el audio como vacío/corrupto

export default function ChatInputAddons({ onSendAttachment, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Estado de grabación ──────────────────────────────────────────────
  type RecState = 'idle' | 'recording' | 'preview' | 'uploading';
  const [recState, setRecState] = useState<RecState>('idle');
  const [locked, setLocked] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [recWarning, setRecWarning] = useState('');

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startPointRef = useRef({ x: 0, y: 0 });
  const cancelledRef = useRef(false);
  const lockedRef = useRef(false);
  const micBtnRef = useRef<HTMLButtonElement>(null);

  // ── Imagen / archivo (sin cambios) ──────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const isImage = file.type.startsWith('image/');

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo no puede superar los 10 MB.');
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 800;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          onSendAttachment(encodeAttachment({ type: 'image', data: compressed, name: file.name }));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        onSendAttachment(encodeAttachment({ type: 'file', data, name: file.name, size: file.size }));
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Iniciar grabación ────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const mediaRec = new MediaRecorder(stream, { mimeType });
      mediaRecRef.current = mediaRec;
      chunksRef.current = [];
      cancelledRef.current = false;
      setRecWarning('');

      mediaRec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mediaRec.onerror = () => {
        cancelledRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        stream.getTracks().forEach(t => t.stop());
        setRecState('idle');
        setLocked(false);
        lockedRef.current = false;
        setRecSeconds(0);
        alert('Hubo un error grabando el audio. Inténtalo de nuevo.');
      };

      mediaRec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        if (cancelledRef.current || chunksRef.current.length === 0) {
          setRecState('idle');
          setLocked(false);
          lockedRef.current = false;
          setRecSeconds(0);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });

        // Si la grabación duró varios segundos pero el archivo resultante es
        // diminuto, algo falló al capturar el micrófono — avisamos en vez de
        // dejar pasar un audio vacío silenciosamente.
        if (recSeconds >= 1 && blob.size < MIN_VALID_BYTES) {
          setRecState('idle');
          setLocked(false);
          lockedRef.current = false;
          setRecSeconds(0);
          setRecWarning('No se captó audio del micrófono. Revisa que no esté silenciado y vuelve a intentarlo.');
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioBlobUrl(blobUrl);
        setPreviewDuration(recSeconds);
        setRecState('preview');
        setLocked(false);
        lockedRef.current = false;
      };

      mediaRec.start(200);
      setRecState('recording');
      setRecSeconds(0);
      setDragX(0);
      setDragY(0);

      timerRef.current = setInterval(() => {
        setRecSeconds(s => {
          if (s >= 119) { // límite 2 min, como red de seguridad
            stopRecording();
            return 120;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
    }
  }, [recSeconds]);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current?.state === 'recording') mediaRecRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const cancelRecordingInProgress = useCallback(() => {
    cancelledRef.current = true;
    if (mediaRecRef.current?.state === 'recording') mediaRecRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── Gestos de presión (pointer events, funciona con mouse y táctil) ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    startPointRef.current = { x: e.clientX, y: e.clientY };
    startRecording();
  }, [disabled, startRecording]);

  // Los listeners de mover/soltar van en window (no en el botón), porque el
  // botón cambia de elemento del DOM al pasar de "idle" a "recording" —
  // pointer capture no sobrevive a ese cambio, pero window sí sigue el gesto.
  useEffect(() => {
    if (recState !== 'recording') return;

    const handleMove = (e: PointerEvent) => {
      if (lockedRef.current) return;
      const dx = e.clientX - startPointRef.current.x;
      const dy = e.clientY - startPointRef.current.y;
      setDragX(Math.min(0, dx));
      setDragY(Math.min(0, dy));

      if (dy <= -LOCK_THRESHOLD) {
        setLocked(true);
        lockedRef.current = true;
        setDragX(0);
        setDragY(0);
      } else if (dx <= -CANCEL_THRESHOLD) {
        cancelRecordingInProgress();
      }
    };

    const handleUp = () => {
      if (lockedRef.current) return; // bloqueado: seguir grabando hasta que toquen "detener"
      stopRecording();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [recState, cancelRecordingInProgress, stopRecording]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const discardPreview = useCallback(() => {
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    setAudioBlobUrl(null);
    setAudioBlob(null);
    setRecState('idle');
    setRecSeconds(0);
    setUploadError('');
  }, [audioBlobUrl]);

  // ── Subir a Supabase Storage y enviar ────────────────────────────────
  const sendAudio = useCallback(async () => {
    if (!audioBlob) return;
    setRecState('uploading');
    setUploadError('');
    try {
      const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-audio')
        .upload(path, audioBlob, { contentType: audioBlob.type, upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from('chat-audio').getPublicUrl(path);
      onSendAttachment(encodeAttachment({ type: 'audio', data: pub.publicUrl, duration: previewDuration }));

      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
      setAudioBlobUrl(null);
      setAudioBlob(null);
      setRecState('idle');
      setRecSeconds(0);
    } catch (err: any) {
      setUploadError(err?.message || 'No se pudo enviar la nota de voz. Inténtalo de nuevo.');
      setRecState('preview');
    }
  }, [audioBlob, audioBlobUrl, previewDuration, onSendAttachment]);

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Aviso de grabación vacía (se muestra en estado idle) ──────────────
  if (recState === 'idle' && recWarning) {
    return (
      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-2xl px-3 py-2 w-full">
        <i className="ri-error-warning-line text-red-500 flex-shrink-0" />
        <p className="text-xs text-red-600 dark:text-red-400 flex-1">{recWarning}</p>
        <button onClick={() => setRecWarning('')} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0">
          <i className="ri-close-line text-sm" />
        </button>
      </div>
    );
  }

  // ── Preview: revisar antes de enviar ─────────────────────────────────
  if (recState === 'preview' || recState === 'uploading') {
    return (
      <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-2xl px-3 py-1.5 w-full">
        <button
          type="button"
          onClick={discardPreview}
          disabled={recState === 'uploading'}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all flex-shrink-0 disabled:opacity-40"
          title="Descartar"
        >
          <i className="ri-delete-bin-line text-sm" />
        </button>

        {audioBlobUrl && (
          <div className="flex-1 min-w-0">
            <VoiceMessagePlayer src={audioBlobUrl} knownDuration={previewDuration} />
          </div>
        )}

        <button
          type="button"
          onClick={sendAudio}
          disabled={recState === 'uploading'}
          className="w-9 h-9 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-all flex-shrink-0 disabled:opacity-60"
          title="Enviar nota de voz"
        >
          {recState === 'uploading'
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <i className="ri-send-plane-fill text-sm" />}
        </button>

        {uploadError && (
          <span className="absolute -mt-8 text-[11px] text-red-500">{uploadError}</span>
        )}
      </div>
    );
  }

  // ── Grabando ─────────────────────────────────────────────────────────
  if (recState === 'recording') {
    const willCancel = dragX <= -CANCEL_THRESHOLD * 0.6;
    const dragProgress = Math.min(1, Math.abs(dragX) / CANCEL_THRESHOLD);

    return (
      <div className="relative flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-2xl px-3 py-1.5 w-full overflow-hidden">
        {/* Indicador de bloqueo, aparece al deslizar hacia arriba */}
        {!locked && (
          <div
            className="absolute -top-11 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 transition-opacity"
            style={{ opacity: Math.min(1, Math.abs(dragY) / LOCK_THRESHOLD + 0.35) }}
          >
            <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-gray-100 dark:border-slate-700 flex items-center justify-center">
              <i className="ri-lock-line text-orange-500 text-sm" />
            </div>
            <i className="ri-arrow-up-line text-gray-400 dark:text-slate-500 text-xs" />
          </div>
        )}

        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
        <span className="text-sm text-red-600 dark:text-red-400 font-medium flex-shrink-0 tabular-nums">
          {fmtTime(recSeconds)}
        </span>

        {/* Forma de onda animada (solo visual, no lee el micrófono) */}
        <div className="flex-1 flex items-center gap-[2px] h-6 min-w-0 justify-center">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-red-400 rec-bar"
              style={{ animationDelay: `${(i % 8) * 0.08}s` }}
            />
          ))}
        </div>

        {!locked ? (
          <div
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 flex-shrink-0 transition-transform"
            style={{ transform: `translateX(${dragX * 0.3}px)`, opacity: 1 - dragProgress * 0.6 }}
          >
            <i className="ri-arrow-left-line" />
            <span className="hidden sm:inline">{willCancel ? 'Suelta para cancelar' : 'Desliza para cancelar'}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={cancelRecordingInProgress}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-all flex-shrink-0"
            title="Cancelar"
          >
            <i className="ri-delete-bin-line text-sm" />
          </button>
        )}

        {locked ? (
          <button
            type="button"
            onClick={stopRecording}
            className="w-9 h-9 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full transition-all flex-shrink-0"
            title="Detener y revisar"
          >
            <i className="ri-stop-fill text-sm" />
          </button>
        ) : (
          <button
            ref={micBtnRef}
            type="button"
            onPointerDown={onPointerDown}
            className="w-9 h-9 flex items-center justify-center bg-red-500 text-white rounded-full transition-all flex-shrink-0 touch-none select-none"
            title="Grabando..."
          >
            <i className="ri-mic-fill text-sm" />
          </button>
        )}
      </div>
    );
  }

  // ── Idle: botones clip + mic ──────────────────────────────────────────
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        title="Adjuntar imagen o archivo"
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 dark:text-slate-500 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex-shrink-0 disabled:opacity-40"
      >
        <i className="ri-attachment-2 text-lg" />
      </button>

      <button
        ref={micBtnRef}
        type="button"
        disabled={disabled}
        onPointerDown={onPointerDown}
        title="Mantén presionado para grabar"
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 dark:text-slate-500 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex-shrink-0 disabled:opacity-40 touch-none select-none"
      >
        <i className="ri-mic-line text-lg" />
      </button>
    </>
  );
}
