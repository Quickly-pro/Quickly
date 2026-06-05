/**
 * Botones de adjuntos para los chats:
 *   📎 Clip   → seleccionar imagen o archivo
 *   🎤 Micro  → grabar nota de voz (click = iniciar, click = detener + previsualizar)
 *
 * onSendAttachment recibe el texto codificado ([[ATTACH]]...) listo para enviar.
 */
import { useState, useRef, useCallback } from 'react';
import { encodeAttachment } from './MessageContent';

interface Props {
  onSendAttachment: (encodedText: string) => void;
  disabled?: boolean;
}

export default function ChatInputAddons({ onSendAttachment, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Estado de grabación ──────────────────────────────────────────────
  type RecState = 'idle' | 'recording' | 'preview';
  const [recState, setRecState] = useState<RecState>('idle');
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Imagen / archivo ─────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';  // permite re-seleccionar el mismo archivo

    const isImage = file.type.startsWith('image/');

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo no puede superar los 10 MB.');
      return;
    }

    if (isImage) {
      // Comprimir imagen con canvas (max 800 px, JPEG 80%)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 800;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height);
            width  = Math.round(width  * ratio);
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
      // Archivo genérico → base64
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        onSendAttachment(encodeAttachment({ type: 'file', data, name: file.name, size: file.size }));
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Nota de voz ──────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRec = new MediaRecorder(stream, { mimeType });
      mediaRecRef.current = mediaRec;
      chunksRef.current   = [];

      mediaRec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        setAudioBlobUrl(blobUrl);

        const reader = new FileReader();
        reader.onload = (ev) => setAudioBase64(ev.target?.result as string);
        reader.readAsDataURL(blob);

        setRecState('preview');
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRec.start(200);
      setRecState('recording');
      setRecSeconds(0);

      timerRef.current = setInterval(() => {
        setRecSeconds(s => {
          if (s >= 59) {
            stopRecording();
            return 60;
          }
          return s + 1;
        });
      }, 1000);

    } catch {
      alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    setAudioBlobUrl(null);
    setAudioBase64(null);
    setRecState('idle');
    setRecSeconds(0);
  }, [audioBlobUrl]);

  const sendAudio = useCallback(() => {
    if (!audioBase64) return;
    onSendAttachment(encodeAttachment({ type: 'audio', data: audioBase64 }));
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    setAudioBlobUrl(null);
    setAudioBase64(null);
    setRecState('idle');
    setRecSeconds(0);
  }, [audioBase64, audioBlobUrl, onSendAttachment]);

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  // ── Preview de nota de voz ───────────────────────────────────────────
  if (recState === 'preview') {
    return (
      <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-xl px-3 py-2 w-full">
        <i className="ri-mic-line text-orange-500 flex-shrink-0" />
        {audioBlobUrl && (
          <audio controls src={audioBlobUrl} className="flex-1 h-8" style={{ minWidth: 0 }} />
        )}
        <button
          type="button"
          onClick={sendAudio}
          disabled={!audioBase64}
          className="w-8 h-8 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
          title="Enviar nota de voz"
        >
          <i className="ri-send-plane-fill text-sm" />
        </button>
        <button
          type="button"
          onClick={cancelRecording}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all flex-shrink-0"
          title="Cancelar"
        >
          <i className="ri-delete-bin-line text-sm" />
        </button>
      </div>
    );
  }

  // ── Grabando ─────────────────────────────────────────────────────────
  if (recState === 'recording') {
    return (
      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl px-3 py-2 w-full">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
        <span className="text-xs text-red-600 dark:text-red-400 font-medium flex-1">
          Grabando… {fmtTime(recSeconds)}
        </span>
        <button
          type="button"
          onClick={stopRecording}
          className="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all flex-shrink-0"
          title="Detener grabación"
        >
          <i className="ri-stop-line text-sm" />
        </button>
        <button
          type="button"
          onClick={cancelRecording}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-lg transition-all flex-shrink-0"
          title="Cancelar"
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>
    );
  }

  // ── Idle: botones clip + mic ──────────────────────────────────────────
  return (
    <>
      {/* Input oculto para archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Clip */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        title="Adjuntar imagen o archivo"
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 dark:text-slate-500 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex-shrink-0 disabled:opacity-40"
      >
        <i className="ri-attachment-2 text-lg" />
      </button>

      {/* Micrófono */}
      <button
        type="button"
        disabled={disabled}
        onClick={startRecording}
        title="Grabar nota de voz"
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 dark:text-slate-500 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex-shrink-0 disabled:opacity-40"
      >
        <i className="ri-mic-line text-lg" />
      </button>
    </>
  );
}
