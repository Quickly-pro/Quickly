import { useEffect, useRef, useState } from 'react';

interface Props {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

/**
 * Cámara integrada en la propia pantalla (sin abrir la app de cámara del
 * móvil). Así el empleado nunca sale de la ventana de confirmar entrega —
 * elimina cualquier riesgo de que el sistema cierre o reinicie la app al
 * cambiar a la cámara nativa y volver.
 */
export default function CameraCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara aquí dentro. Sube una foto desde la galería.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch(() => setError('No se pudo acceder a la cámara (revisa los permisos). Puedes subir una foto desde la galería.'));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedUrl(URL.createObjectURL(blob));
        }
      },
      'image/jpeg',
      0.85
    );
  };

  const retake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
  };

  const confirmPhoto = () => {
    if (!capturedBlob) return;
    onCapture(new File([capturedBlob], `entrega_${Date.now()}.jpg`, { type: 'image/jpeg' }));
  };

  const handleGalleryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  };

  return (
    <div className="space-y-2">
      {error ? (
        <div className="space-y-2">
          <p className="text-xs text-red-500">{error}</p>
          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg py-3 text-sm text-gray-500 dark:text-slate-400 cursor-pointer hover:border-green-300">
              <i className="ri-image-add-line" /> Subir desde galería
              <input type="file" accept="image/*" onChange={handleGalleryFile} className="hidden" />
            </label>
            <button onClick={onCancel} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">
              Cancelar
            </button>
          </div>
        </div>
      ) : capturedUrl ? (
        <>
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
            <img src={capturedUrl} alt="Foto capturada" className="w-full h-40 object-cover" />
          </div>
          <div className="flex gap-2">
            <button onClick={retake} className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
              <i className="ri-refresh-line" /> Repetir
            </button>
            <button onClick={confirmPhoto} className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
              <i className="ri-check-line" /> Usar esta foto
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg overflow-hidden bg-black relative" style={{ aspectRatio: '4/3' }}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">
              Cancelar
            </button>
            <button
              onClick={takePhoto}
              disabled={!ready}
              className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <i className="ri-camera-line text-base" /> Capturar foto
            </button>
          </div>
        </>
      )}
    </div>
  );
}
