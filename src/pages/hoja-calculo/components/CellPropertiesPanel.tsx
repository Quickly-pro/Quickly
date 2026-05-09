import { useState, useCallback, useRef, useEffect } from 'react';

interface CellMeta {
  value?: string;
  color_index?: number;
  is_bold?: boolean;
  text_align?: string;
  number_format?: string;
}

interface CellPropertiesPanelProps {
  selectedCell: string | null;
  cellMeta: CellMeta | null;
  onBoldChange: (bold: boolean) => void;
  onAlignChange: (align: string) => void;
  onFormatChange: (format: string) => void;
  onColorToggle: () => void;
  activePaletteColors: string[];
  cellColor: string;
  onClose?: () => void;
}

export default function CellPropertiesPanel({
  selectedCell,
  cellMeta,
  onBoldChange,
  onAlignChange,
  onFormatChange,
  onColorToggle,
  activePaletteColors,
  cellColor,
  onClose,
}: CellPropertiesPanelProps) {
  const [showPalette, setShowPalette] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowPalette(false);
      }
    };
    if (showPalette) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPalette]);

  const isBold = cellMeta?.is_bold || false;
  const align = cellMeta?.text_align || 'left';
  const format = cellMeta?.number_format || 'text';

  const handleColorPick = useCallback(() => {
    setShowPalette(false);
    onColorToggle();
  }, [onColorToggle]);

  if (!selectedCell) {
    return (
      <div className="w-64 bg-white border-l border-gray-100 p-4 flex-shrink-0">
        <p className="text-sm text-gray-400 text-center py-8">Selecciona una celda para ver sus propiedades</p>
      </div>
    );
  }

  const [row, col] = selectedCell.split('-').map(Number);
  const colLabel = String.fromCharCode(65 + col);
  const cellRef = `${colLabel}${row + 1}`;
  const isHeader = row === 0;

  return (
    <div className="w-64 bg-white border-l border-gray-100 flex-shrink-0 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">{cellRef}</span>
        {onClose && (
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <i className="ri-close-line" />
          </button>
        )}
      </div>

      {isHeader && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-700">Fila de cabecera — edición limitada</p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {/* Formula info */}
        {cellMeta?.value?.startsWith('=') && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fórmula</label>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-sm text-emerald-800 font-mono truncate">
              {cellMeta.value}
            </div>
          </div>
        )}

        {/* Bold */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estilo</label>
          <div className="flex gap-1">
            <button
              onClick={() => onBoldChange(!isBold)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all border
                ${isBold ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              title="Negrita"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-bold" />
              </div>
              <span className="font-bold">B</span>
            </button>
          </div>
        </div>

        {/* Alignment */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Alineación</label>
          <div className="flex gap-1">
            {[
              { key: 'left', icon: 'ri-align-left', label: 'Izq' },
              { key: 'center', icon: 'ri-align-center', label: 'Cen' },
              { key: 'right', icon: 'ri-align-right', label: 'Der' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => onAlignChange(opt.key)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs transition-all border
                  ${align === opt.key ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                title={opt.label}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={opt.icon} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Number Format */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Formato numérico</label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { key: 'text', label: 'Texto', example: 'abc' },
              { key: 'number', label: 'Número', example: '1.234' },
              { key: 'currency', label: 'Moneda', example: '12,34 €' },
              { key: 'percentage', label: 'Porcentaje', example: '45%' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => onFormatChange(opt.key)}
                className={`px-2 py-2 rounded-lg text-xs transition-all border text-left
                  ${format === opt.key ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="block text-[10px] text-gray-400 mt-0.5">{opt.example}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Color de fondo</label>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"
              style={{ backgroundColor: cellColor }}
              onClick={() => setShowPalette(!showPalette)}
            />
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="flex-1 text-left text-xs text-gray-600 hover:text-gray-800 py-2"
            >
              {showPalette ? 'Cerrar paleta' : 'Cambiar color...'}
            </button>
          </div>
          {showPalette && (
            <div ref={paletteRef} className="grid grid-cols-5 gap-1.5 mt-2 p-2 bg-gray-50 rounded-lg">
              {activePaletteColors.map((c, i) => (
                <button
                  key={i}
                  onClick={handleColorPick}
                  className="w-7 h-7 rounded-md border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  title={`Color ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Value preview */}
        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</label>
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 break-all">
            {cellMeta?.value || <span className="text-gray-400 italic">Vacío</span>}
          </div>
        </div>
      </div>
    </div>
  );
}