import { useRef, useState, useEffect, useCallback } from 'react';

export interface CropData {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface AvatarCropEditorProps {
  imageSrc: string;
  initialCrop?: CropData;
  onSave: (croppedBase64: string, cropData: CropData) => void;
  onCancel: () => void;
}

export default function AvatarCropEditor({ imageSrc, initialCrop, onSave, onCancel }: AvatarCropEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Mutable drawing state (refs) so draw() always reads fresh values without stale closure issues
  const scaleRef = useRef(initialCrop?.scale ?? 1);
  const offsetXRef = useRef(initialCrop?.offsetX ?? 0);
  const offsetYRef = useRef(initialCrop?.offsetY ?? 0);

  // UI mirror state
  const [scaleUI, setScaleUI] = useState(initialCrop?.scale ?? 1);

  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  const CANVAS_SIZE = 320;
  const PREVIEW_SIZE = 180;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 4;

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Load image and compute initial scale
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;

      // If we already have a saved crop, keep it; otherwise auto-fit
      if (initialCrop && initialCrop.scale > 0) {
        scaleRef.current = initialCrop.scale;
        offsetXRef.current = initialCrop.offsetX;
        offsetYRef.current = initialCrop.offsetY;
      } else {
        const minDim = Math.min(img.width, img.height);
        const fitScale = CANVAS_SIZE / minDim;
        scaleRef.current = Math.max(fitScale * 1.1, 1);
        offsetXRef.current = 0;
        offsetYRef.current = 0;
      }

      setScaleUI(scaleRef.current);
      draw();
    };
    img.src = imageSrc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    const W = CANVAS_SIZE;
    const H = CANVAS_SIZE;
    const center = W / 2;
    const radius = center - 8;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const s = scaleRef.current;
    const ox = offsetXRef.current;
    const oy = offsetYRef.current;
    const imgW = img.width * s;
    const imgH = img.height * s;
    const drawX = center - imgW / 2 + ox;
    const drawY = center - imgH / 2 + oy;

    ctx.drawImage(img, drawX, drawY, imgW, imgH);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(center, center, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  // Draw whenever scaleUI changes (slider / buttons)
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleUI]);

  const updateScale = useCallback((next: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    scaleRef.current = clamped;
    setScaleUI(clamped);
    draw();
  }, [draw]);

  // Zoom helpers
  const zoomIn = useCallback(() => {
    updateScale(scaleRef.current + 0.2);
  }, [updateScale]);

  const zoomOut = useCallback(() => {
    updateScale(scaleRef.current - 0.2);
  }, [updateScale]);

  // Percentage label (base = image natural size)
  const zoomPercent = Math.round(scaleUI * 100);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    updateScale(scaleRef.current + delta);
  }, [updateScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - offsetXRef.current, y: e.clientY - offsetYRef.current });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    offsetXRef.current = e.clientX - dragStart.x;
    offsetYRef.current = e.clientY - dragStart.y;
    draw();
  }, [dragging, dragStart, draw]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragging(true);
    setDragStart({ x: touch.clientX - offsetXRef.current, y: touch.clientY - offsetYRef.current });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const touch = e.touches[0];
    offsetXRef.current = touch.clientX - dragStart.x;
    offsetYRef.current = touch.clientY - dragStart.y;
    draw();
  }, [dragging, dragStart, draw]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    const img = imgRef.current;
    if (!img) {
      setSaving(false);
      return;
    }

    const outCanvas = document.createElement('canvas');
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) {
      setSaving(false);
      return;
    }

    outCanvas.width = PREVIEW_SIZE;
    outCanvas.height = PREVIEW_SIZE;
    const center = PREVIEW_SIZE / 2;
    const radius = center;

    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    outCtx.beginPath();
    outCtx.arc(center, center, radius, 0, Math.PI * 2);
    outCtx.closePath();
    outCtx.clip();

    const s = scaleRef.current;
    const ox = offsetXRef.current;
    const oy = offsetYRef.current;
    const imgW = img.width * s * (PREVIEW_SIZE / CANVAS_SIZE);
    const imgH = img.height * s * (PREVIEW_SIZE / CANVAS_SIZE);
    const drawX = center - imgW / 2 + ox * (PREVIEW_SIZE / CANVAS_SIZE);
    const drawY = center - imgH / 2 + oy * (PREVIEW_SIZE / CANVAS_SIZE);

    outCtx.drawImage(img, drawX, drawY, imgW, imgH);

    const base64 = outCanvas.toDataURL('image/jpeg', 0.8);
    setSaving(false);

    onSave(base64, {
      scale: s,
      offsetX: ox,
      offsetY: oy,
    });
  }, [onSave]);

  const handleCancel = () => {
    setVisible(false);
    setTimeout(onCancel, 200);
  };

  const handleReset = () => {
    const img = imgRef.current;
    if (!img) return;
    const minDim = Math.min(img.width, img.height);
    const fitScale = CANVAS_SIZE / minDim;
    const initialScale = Math.max(fitScale * 1.1, 1);
    scaleRef.current = initialScale;
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    setScaleUI(initialScale);
    draw();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 transition-all duration-200 ease-out ${visible ? 'bg-black/60' : 'bg-black/0'}`}
      />
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full z-10 flex flex-col max-h-[90vh] transition-all duration-200 ease-out ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">Ajustar foto</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Arrastra para centrar · Rueda o slider para zoom
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        {/* Canvas */}
        <div className="p-4 flex justify-center flex-shrink-0">
          <div
            ref={containerRef}
            className="relative rounded-full overflow-hidden shadow-inner"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className={`block ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            />
          </div>
        </div>

        {/* Zoom percentage label */}
        <div className="px-6 pb-1 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 px-3 py-1 rounded-full">
            <i className="ri-search-line" />
            Zoom: {zoomPercent}%
          </span>
        </div>

        {/* Zoom slider */}
        <div className="px-6 py-2 flex items-center gap-3">
          <button
            onClick={zoomOut}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            <i className="ri-subtract-line text-xs text-gray-600 dark:text-slate-300" />
          </button>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.05}
            value={scaleUI}
            onChange={(e) => updateScale(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-orange-500 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <button
            onClick={zoomIn}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            <i className="ri-add-line text-xs text-gray-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Reset / Preview hint */}
        <div className="px-6 pb-2 text-center">
          <button
            onClick={handleReset}
            className="text-xs text-orange-600 hover:underline"
          >
            <i className="ri-refresh-line mr-1" />
            Reiniciar posición
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><i className="ri-loader-4-line animate-spin" /> Procesando...</>
            ) : (
              <><i className="ri-check-line" /> Guardar foto</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}