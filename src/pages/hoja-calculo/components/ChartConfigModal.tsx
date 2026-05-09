import { useState, useCallback, useMemo } from 'react';

interface ChartConfig {
  title: string;
  type: 'bar' | 'pie' | 'line';
  labelCol: number;
  valueCol: number;
  color: string;
  startRow: number;
  endRow: number;
}

interface ChartConfigModalProps {
  range: { startRow: number; startCol: number; endRow: number; endCol: number };
  colLabels: string[];
  previewValues: string[][];
  onCreate: (config: ChartConfig) => void;
  onCancel: () => void;
}

const COLORS = ['#f97316', '#84cc16', '#06b6d4', '#ef4444', '#8b5cf6'];

export default function ChartConfigModal({
  range,
  colLabels,
  previewValues,
  onCreate,
  onCancel,
}: ChartConfigModalProps) {
  const [title, setTitle] = useState('Gráfico de datos');
  const [type, setType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [labelCol, setLabelCol] = useState(range.startCol);
  const [valueCol, setValueCol] = useState(
    range.startCol === range.endCol ? range.startCol : range.endCol
  );
  const [color, setColor] = useState(COLORS[0]);

  const previewRows = useMemo(() => {
    const rows: { label: string; value: number }[] = [];
    previewValues.forEach((row) => {
      const label = row[labelCol] || '';
      const rawVal = row[valueCol] || '';
      const cleaned = rawVal.replace(/\./g, '').replace(/,/g, '.');
      const num = parseFloat(cleaned);
      if (label && !Number.isNaN(num)) {
        rows.push({ label, value: num });
      }
    });
    return rows.slice(0, 8);
  }, [previewValues, labelCol, valueCol]);

  const handleCreate = useCallback(() => {
    onCreate({
      title,
      type,
      labelCol,
      valueCol,
      color,
      startRow: range.startRow,
      endRow: range.endRow,
    });
  }, [title, type, labelCol, valueCol, color, range, onCreate]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
              <i className="ri-bar-chart-box-line" />
            </div>
            <h3 className="text-base font-semibold text-gray-800">Crear gráfico</h3>
          </div>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Range info */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
            Rango seleccionado: <strong>{colLabels[range.startCol]}{range.startRow + 1}:{colLabels[range.endCol]}{range.endRow + 1}</strong>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Título del gráfico</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400"
              placeholder="Ej: Ventas por mes"
            />
          </div>

          {/* Chart type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo de gráfico</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'bar', label: 'Barras', icon: 'ri-bar-chart-grouped-line' },
                { key: 'pie', label: 'Pastel', icon: 'ri-pie-chart-line' },
                { key: 'line', label: 'Líneas', icon: 'ri-line-chart-line' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key as 'bar' | 'pie' | 'line')}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all ${
                    type === t.key
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={t.icon} />
                  </div>
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Column selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Columna de etiquetas</label>
              <select
                value={labelCol}
                onChange={e => setLabelCol(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
              >
                {colLabels.map((l, i) => (
                  <option key={i} value={i}>{l} (columna {l})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Columna de valores</label>
              <select
                value={valueCol}
                onChange={e => setValueCol(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
              >
                {colLabels.map((l, i) => (
                  <option key={i} value={i}>{l} (columna {l})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Color principal</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vista previa ({previewRows.length} puntos)</label>
            <div className="bg-gray-50 rounded-lg p-2 max-h-32 overflow-y-auto">
              {previewRows.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left py-1">Etiqueta</th>
                      <th className="text-right py-1">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1 text-gray-700">{r.label}</td>
                        <td className="py-1 text-right text-gray-700 font-medium">{r.value.toLocaleString('es-ES')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-gray-400 text-center py-3">Selecciona columnas válidas para ver la vista previa</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={previewRows.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              previewRows.length > 0
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Crear gráfico
          </button>
        </div>
      </div>
    </div>
  );
}