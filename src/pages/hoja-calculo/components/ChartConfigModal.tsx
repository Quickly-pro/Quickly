import { useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { parseNumericValue, detectBestColumns } from '../lib/numberParser';

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

const COLORS = [
  '#f97316', '#84cc16', '#06b6d4', '#ef4444', '#8b5cf6',
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1',
  '#f44336', '#ffc107', '#009688', '#651fff', '#00bcd4',
];

type SortMode = 'none' | 'value_desc' | 'value_asc' | 'label_asc';

export default function ChartConfigModal({
  range,
  colLabels,
  previewValues,
  onCreate,
  onCancel,
}: ChartConfigModalProps) {
  const suggested = useMemo(() => detectBestColumns(previewValues, colLabels.length), [previewValues, colLabels.length]);

  const [title, setTitle] = useState('Gráfico de datos');
  const [type, setType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [labelCol, setLabelCol] = useState(suggested.labelCol);
  const [valueCol, setValueCol] = useState(suggested.valueCol);
  const [color, setColor] = useState(COLORS[0]);
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [maxPoints, setMaxPoints] = useState(15);

  const allRows = useMemo(() => {
    const rows: { label: string; value: number }[] = [];
    previewValues.forEach((row) => {
      const label = row[labelCol] || '';
      const num = parseNumericValue(row[valueCol] || '');
      if (label && !Number.isNaN(num)) {
        rows.push({ label, value: num });
      }
    });
    return rows;
  }, [previewValues, labelCol, valueCol]);

  const sortedRows = useMemo(() => {
    let rows = [...allRows];
    if (sortMode === 'value_desc') rows.sort((a, b) => b.value - a.value);
    else if (sortMode === 'value_asc') rows.sort((a, b) => a.value - b.value);
    else if (sortMode === 'label_asc') rows.sort((a, b) => a.label.localeCompare(b.label));
    return rows.slice(0, maxPoints);
  }, [allRows, sortMode, maxPoints]);

  const previewRows = sortedRows.slice(0, 8);

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400">
              <i className="ri-bar-chart-box-line" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-slate-100">Crear gráfico</h3>
          </div>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
          {/* Range info */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-slate-300 flex items-center justify-between flex-wrap gap-1">
            <span>Rango seleccionado: <strong>{colLabels[range.startCol]}{range.startRow + 1}:{colLabels[range.endCol]}{range.endRow + 1}</strong></span>
            <span className="text-xs text-gray-400 dark:text-slate-500">Puedes cambiar las columnas abajo — no tienen que ser las del rango</span>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Título del gráfico</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 dark:bg-slate-800 outline-none focus:border-orange-400"
              placeholder="Ej: Ventas por mes"
            />
          </div>

          {/* Chart type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Tipo de gráfico</label>
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
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
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
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Columna de etiquetas</label>
              <select
                value={labelCol}
                onChange={e => setLabelCol(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 dark:bg-slate-800 outline-none focus:border-orange-400"
              >
                {colLabels.map((l, i) => (
                  <option key={i} value={i}>{l} (columna {l}){i === suggested.labelCol ? ' — sugerida' : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Columna de valores</label>
              <select
                value={valueCol}
                onChange={e => setValueCol(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 dark:bg-slate-800 outline-none focus:border-orange-400"
              >
                {colLabels.map((l, i) => (
                  <option key={i} value={i}>{l} (columna {l}){i === suggested.valueCol ? ' — sugerida' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort + limit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ordenar por</label>
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 dark:bg-slate-800 outline-none focus:border-orange-400"
              >
                <option value="none">Orden original</option>
                <option value="value_desc">Valor: mayor a menor</option>
                <option value="value_asc">Valor: menor a mayor</option>
                <option value="label_asc">Etiqueta: A-Z</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Máximo de puntos</label>
              <select
                value={maxPoints}
                onChange={e => setMaxPoints(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 dark:bg-slate-800 outline-none focus:border-orange-400"
              >
                {[5, 10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Color principal</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Live chart preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              Vista previa ({allRows.length} puntos encontrados{maxPoints < allRows.length ? `, mostrando ${sortedRows.length}` : ''})
            </label>
            {sortedRows.length > 0 ? (
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2">
                <ResponsiveContainer key={`${type}-${labelCol}-${valueCol}-${sortMode}-${sortedRows.length}`} width="100%" height={200}>
                  {type === 'bar' ? (
                    <BarChart data={sortedRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [v.toLocaleString('es-ES'), 'Valor']} />
                      <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  ) : type === 'line' ? (
                    <LineChart data={sortedRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [v.toLocaleString('es-ES'), 'Valor']} />
                      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                    </LineChart>
                  ) : (
                    <PieChart>
                      <Pie data={sortedRows} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={70} innerRadius={30}
                        label={(props: any) => `${((props.percent || 0) * 100).toFixed(0)}%`} labelLine={false} isAnimationActive={false}>
                        {sortedRows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [v.toLocaleString('es-ES'), n]} />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2">
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">
                  No se encontraron números válidos en la columna de valores elegida — prueba a cambiarla arriba.
                </p>
              </div>
            )}
          </div>

          {previewRows.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Datos (primeros {previewRows.length})</label>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2 max-h-28 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-slate-700 first:border-t-0">
                        <td className="py-1 text-gray-700 dark:text-slate-300">{r.label}</td>
                        <td className="py-1 text-right text-gray-700 dark:text-slate-300 font-medium">{r.value.toLocaleString('es-ES')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex-shrink-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={sortedRows.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sortedRows.length > 0
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            Crear gráfico
          </button>
        </div>
      </div>
    </div>
  );
}
