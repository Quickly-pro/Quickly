import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  onChange: (dataUrl: string | null) => void;
}

/**
 * Panel de firma táctil sencillo — dibuja con el dedo/ratón sobre un
 * canvas y exporta el resultado como imagen (data URL PNG).
 */
export default function SignaturePad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getCtx = () => canvasRef.current?.getContext('2d') || null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ajustar resolución real al tamaño mostrado, para que no se vea borroso
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = getCtx();
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1f2937';
    }
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = getCtx();
    const { x, y } = getPoint(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = getCtx();
    const { x, y } = getPoint(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasSignature) onChange(canvas.toDataURL('image/png'));
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onChange(null);
    }
  }, [onChange]);

  return (
    <div>
      <div className="relative border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden" style={{ height: 140 }}>
        {!hasSignature && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 dark:text-slate-600 pointer-events-none">
            Firma aquí con el dedo
          </span>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      {hasSignature && (
        <button type="button" onClick={clear} className="mt-1 text-xs text-gray-400 hover:text-red-500">
          <i className="ri-eraser-line mr-1" />Borrar firma
        </button>
      )}
    </div>
  );
}
