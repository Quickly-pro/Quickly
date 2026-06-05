import { useState } from 'react';

interface RouteRow {
  id: number;
  client: string;
  product: string;
  quantity: number;
  price: number;
  total: number;
  status: string;
  date: string;
  iva: string;
}

const PEDIDOS_KEY = 'hoja-pedidos-rows';
const RUTA_KEY = 'hoja-ruta-rows';

const ROWS_INITIAL = 15;
const ROWS_ADD = 20;

// Convierte filas de Hoja de Pedidos → filas de Hoja de Ruta (expande productos)
function pedidosToRuta(pedidos: any[]): RouteRow[] {
  const result: RouteRow[] = [];
  let id = 1;
  for (const row of pedidos) {
    if (!row.employee) continue;
    const products: [string, string][] = [
      [row.product1, row.cant1],
      [row.product2, row.cant2],
      [row.product3, row.cant3],
      [row.product4, row.cant4],
    ].filter(([p]) => !!p) as [string, string][];
    for (const [product, cant] of products) {
      result.push({
        id: id++,
        client: row.employee,
        product,
        quantity: parseInt(cant) || 0,
        price: 0,
        total: 0,
        status: '',
        date: row.date || '',
        iva: '',
      });
    }
  }
  return result;
}

function loadRutaRows(): RouteRow[] {
  try {
    const pedidosRaw = localStorage.getItem(PEDIDOS_KEY);
    if (pedidosRaw) {
      const pedidos = JSON.parse(pedidosRaw);
      const derived = pedidosToRuta(pedidos);
      if (derived.length > 0) {
        // Merge con extras guardados (precio, total, estado, IVA)
        const rutaRaw = localStorage.getItem(RUTA_KEY);
        if (rutaRaw) {
          const saved: RouteRow[] = JSON.parse(rutaRaw);
          return derived.map(row => {
            const match = saved.find(s =>
              s.client === row.client &&
              s.product === row.product &&
              s.date === row.date
            );
            return match
              ? { ...row, price: match.price, total: match.total, status: match.status, iva: match.iva }
              : row;
          });
        }
        return derived;
      }
    }
  } catch { /* ignore */ }
  // Fallback: datos guardados anteriores
  try {
    const rutaRaw = localStorage.getItem(RUTA_KEY);
    if (rutaRaw) return JSON.parse(rutaRaw) as RouteRow[];
  } catch { /* ignore */ }
  return [];
}

export default function HojaRuta() {
  const [rows, setRows] = useState<RouteRow[]>(loadRutaRows);
  const [syncMsg, setSyncMsg] = useState('');
  const [visibleCount, setVisibleCount] = useState(ROWS_INITIAL);
  const [editingCell, setEditingCell] = useState<{ rowId: number; field: keyof RouteRow } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCellDoubleClick = (row: RouteRow, field: keyof RouteRow) => {
    setEditingCell({ rowId: row.id, field });
    setEditValue(String(row[field]));
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const newRows = rows.map(r => {
      if (r.id !== editingCell.rowId) return r;
      const newValue = editingCell.field === 'quantity' || editingCell.field === 'price' || editingCell.field === 'total'
        ? parseFloat(editValue) || 0
        : editValue;
      return { ...r, [editingCell.field]: newValue };
    });
    setRows(newRows);
    setEditingCell(null);
    try { localStorage.setItem(RUTA_KEY, JSON.stringify(newRows)); } catch { /* ignore */ }
  };

  const syncFromPedidos = () => {
    try {
      const pedidosRaw = localStorage.getItem(PEDIDOS_KEY);
      if (!pedidosRaw) { setSyncMsg('No hay datos en Hoja de Pedidos'); setTimeout(() => setSyncMsg(''), 3000); return; }
      const pedidos = JSON.parse(pedidosRaw);
      const derived = pedidosToRuta(pedidos);
      // Merge con extras actuales
      const merged = derived.map(row => {
        const match = rows.find(s =>
          s.client === row.client && s.product === row.product && s.date === row.date
        );
        return match ? { ...row, price: match.price, total: match.total, status: match.status, iva: match.iva } : row;
      });
      setRows(merged);
      try { localStorage.setItem(RUTA_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      setSyncMsg(`Sincronizado: ${merged.length} filas`);
      setTimeout(() => setSyncMsg(''), 3000);
    } catch { setSyncMsg('Error al sincronizar'); setTimeout(() => setSyncMsg(''), 3000); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellSave();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const addRows = () => {
    const newRows: RouteRow[] = Array.from({ length: ROWS_ADD }).map((_, i) => ({
      id: rows.length + i + 1,
      client: '',
      product: '',
      quantity: 0,
      price: 0,
      total: 0,
      status: '',
      date: '',
      iva: '',
    }));
    setRows(prev => [...prev, ...newRows]);
    setVisibleCount(prev => prev + ROWS_ADD);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['#', 'Cliente', 'Producto', 'Cant.', 'Precio', 'Total', 'Estado', 'Fecha', 'IVA'];
    const data = rows.map(r => [r.id, r.client, r.product, r.quantity, r.price, r.total, r.status, r.date, r.iva]);
    const csv = [headers, ...data].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hoja-de-ruta.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isEditing = (row: RouteRow, field: keyof RouteRow) =>
    editingCell?.rowId === row.id && editingCell?.field === field;

  const rowBg = (idx: number) => {
    if (idx === 0) return 'bg-gray-50/80 dark:bg-slate-800/50';
    const palette = [
      'bg-white dark:bg-slate-900',
      'bg-amber-50/40 dark:bg-amber-900/10',
      'bg-teal-50/40 dark:bg-teal-900/10',
      'bg-rose-50/40 dark:bg-rose-900/10',
      'bg-indigo-50/40 dark:bg-indigo-900/10',
      'bg-orange-50/40 dark:bg-orange-900/10',
      'bg-emerald-50/40 dark:bg-emerald-900/10',
    ];
    return palette[idx % palette.length];
  };

  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = rows.length > visibleCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400">Sincronizada automáticamente con Hoja de Pedidos</p>
          {syncMsg && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
              <i className="ri-check-line" /> {syncMsg}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncFromPedidos}
            className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-refresh-line" />
            </div>
            Sincronizar
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-gray-800 dark:bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-printer-line" />
            </div>
            Imprimir
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-download-line" />
            </div>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Column headers */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
              <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500 flex-shrink-0">
                #
              </div>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label, idx) => (
                <div
                  key={label}
                  className="w-36 h-10 bg-gray-100 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500 flex-shrink-0"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Data header row */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
              <div className="w-10 h-10 bg-gray-50 dark:bg-slate-800/50 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-slate-400 flex-shrink-0">
                1
              </div>
              {['Cliente', 'Producto', 'Cant.', 'Precio', 'Total', 'Estado', 'Fecha', 'IVA'].map((header) => (
                <div
                  key={header}
                  className="w-36 h-10 border-r border-gray-200 dark:border-slate-700 flex items-center px-3 text-xs font-bold text-gray-700 dark:text-slate-200 flex-shrink-0"
                >
                  {header}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {visibleRows.map((row, idx) => (
              <div key={row.id} className={`flex border-b border-gray-100 dark:border-slate-800 ${rowBg(idx)}`}>
                <div className="w-10 h-10 bg-gray-50 dark:bg-slate-800/30 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                  {idx + 2}
                </div>
                {/* Cliente */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'client')}
                >
                  {isEditing(row, 'client') ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span className="truncate">{row.client}</span>
                  )}
                </div>
                {/* Producto */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'product')}
                >
                  {isEditing(row, 'product') ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span className="truncate">{row.product}</span>
                  )}
                </div>
                {/* Cant. */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'quantity')}
                >
                  {isEditing(row, 'quantity') ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span>{row.quantity || ''}</span>
                  )}
                </div>
                {/* Precio */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'price')}
                >
                  {isEditing(row, 'price') ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span>{row.price ? row.price.toFixed(2) : ''}</span>
                  )}
                </div>
                {/* Total */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'total')}
                >
                  {isEditing(row, 'total') ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span>{row.total ? row.total.toFixed(2) : ''}</span>
                  )}
                </div>
                {/* Estado */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'status')}
                >
                  {isEditing(row, 'status') ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    row.status ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                        {row.status}
                      </span>
                    ) : null
                  )}
                </div>
                {/* Fecha */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'date')}
                >
                  {isEditing(row, 'date') ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span>{row.date}</span>
                  )}
                </div>
                {/* IVA */}
                <div
                  className="w-36 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
                  onDoubleClick={() => handleCellDoubleClick(row, 'iva')}
                >
                  {isEditing(row, 'iva') ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span>{row.iva}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add more rows button */}
      <div className="flex justify-center">
        <button
          onClick={addRows}
          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <i className="ri-add-line" />
          + {ROWS_ADD} filas más
        </button>
      </div>

    </div>
  );
}