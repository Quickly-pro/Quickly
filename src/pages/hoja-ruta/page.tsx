import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface RouteRow {
  id: string;
  itemId: number;
  client: string;
  address: string;
  product: string;
  quantity: number;
  price: number;
  total: number;
  status: string;
  date: string;
  iva: string;
}

const ROWS_INITIAL = 15;

export default function HojaRuta() {
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState('');
  const [visibleCount, setVisibleCount] = useState(ROWS_INITIAL);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof RouteRow } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchAll = useCallback(async () => {
    const [{ data: pedidos }, { data: items }, { data: extras }] = await Promise.all([
      supabase.from('order_sheet_rows').select('*').order('id'),
      supabase.from('order_sheet_items').select('*').order('position'),
      supabase.from('route_sheet_extras').select('*'),
    ]);

    const pedidosById = new Map((pedidos || []).map((p: any) => [p.id, p]));
    const result: RouteRow[] = (items || [])
      .filter((it: any) => (it.product || it.quantity))
      .map((it: any) => {
        const parent = pedidosById.get(it.row_id);
        const extra = (extras || []).find((e: any) => e.item_id === it.id);
        return {
          id: `item-${it.id}`,
          itemId: it.id,
          client: parent?.employee || '',
          address: parent?.address || '',
          product: it.product || '',
          quantity: parseInt(it.quantity) || 0,
          price: extra ? Number(extra.price) : 0,
          total: extra ? Number(extra.total) : 0,
          status: extra?.status || '',
          date: parent?.date || '',
          iva: extra?.iva || '',
        };
      });
    setRows(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const sub = supabase
      .channel(`hoja_ruta_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_sheet_rows' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_sheet_items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_sheet_extras' }, fetchAll)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchAll]);

  const handleCellDoubleClick = (row: RouteRow, field: keyof RouteRow) => {
    if (field === 'client' || field === 'product' || field === 'quantity' || field === 'date' || field === 'address') return;
    setEditingCell({ rowId: row.id, field });
    setEditValue(String(row[field]));
  };

  const handleCellSave = async () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    const row = rows.find(r => r.id === rowId);
    if (!row) { setEditingCell(null); return; }

    const newValue = field === 'price' || field === 'total' ? (parseFloat(editValue) || 0) : editValue;
    const updated = { ...row, [field]: newValue } as RouteRow;
    setRows(prev => prev.map(r => r.id === rowId ? updated : r));
    setEditingCell(null);

    const { error } = await supabase.from('route_sheet_extras').upsert({
      item_id: row.itemId, price: updated.price, total: updated.total, status: updated.status, iva: updated.iva,
    }, { onConflict: 'item_id' });
    if (error) console.error('Error al guardar los datos de la hoja de ruta', error);
  };

  const syncFromPedidos = () => {
    fetchAll();
    setSyncMsg(`Sincronizado: ${rows.length} filas`);
    setTimeout(() => setSyncMsg(''), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellSave();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = ['#', 'Cliente', 'Dirección', 'Producto', 'Cant.', 'Precio', 'Total', 'Estado', 'Fecha', 'IVA'];
    const data = rows.map((r, i) => [i + 1, r.client, r.address, r.product, r.quantity, r.price, r.total, r.status, r.date, r.iva]);
    const csv = [headers, ...data].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hoja-de-ruta.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isEditing = (row: RouteRow, field: keyof RouteRow) => editingCell?.rowId === row.id && editingCell?.field === field;

  const rowBg = (idx: number) => {
    const palette = [
      'bg-white dark:bg-slate-900', 'bg-amber-50/40 dark:bg-amber-900/10', 'bg-teal-50/40 dark:bg-teal-900/10',
      'bg-rose-50/40 dark:bg-rose-900/10', 'bg-indigo-50/40 dark:bg-indigo-900/10', 'bg-orange-50/40 dark:bg-orange-900/10',
      'bg-emerald-50/40 dark:bg-emerald-900/10',
    ];
    return palette[idx % palette.length];
  };

  const visibleRows = rows.slice(0, visibleCount);

  const renderCell = (row: RouteRow, field: keyof RouteRow, editable: boolean) => (
    <div className="w-32 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 cursor-text"
      onDoubleClick={() => editable && handleCellDoubleClick(row, field)}>
      {isEditing(row, field) ? (
        <input type={field === 'price' || field === 'total' ? 'number' : 'text'} step="0.01" value={editValue}
          onChange={(e) => setEditValue(e.target.value)} onBlur={handleCellSave} onKeyDown={handleKeyDown} autoFocus
          className="w-full bg-white dark:bg-slate-800 border border-orange-300 rounded px-1 py-0.5 text-xs outline-none" />
      ) : field === 'status' && row.status ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">{row.status}</span>
      ) : field === 'price' || field === 'total' ? (
        <span>{(row[field] as number) ? (row[field] as number).toFixed(2) : ''}</span>
      ) : (
        <span className="truncate">{row[field] as string}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400">Sincronizada automáticamente con Hoja de Pedidos{loading && ' (cargando...)'}</p>
          {syncMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1"><i className="ri-check-line" /> {syncMsg}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncFromPedidos} className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap">
            <i className="ri-refresh-line" /> Sincronizar
          </button>
          <button onClick={handlePrint} className="px-3 py-2 bg-gray-800 dark:bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap">
            <i className="ri-printer-line" /> Imprimir
          </button>
          <button onClick={handleExportCSV} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2 whitespace-nowrap">
            <i className="ri-download-line" /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex border-b border-gray-200 dark:border-slate-700">
              <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500 flex-shrink-0">#</div>
              {['Cliente', 'Dirección', 'Producto', 'Cant.', 'Precio', 'Total', 'Estado', 'Fecha', 'IVA'].map((header) => (
                <div key={header} className="w-32 h-10 border-r border-gray-200 dark:border-slate-700 flex items-center px-3 text-xs font-bold text-gray-700 dark:text-slate-200 flex-shrink-0 bg-gray-100 dark:bg-slate-800">{header}</div>
              ))}
            </div>

            {visibleRows.length === 0 && !loading && (
              <div className="p-8 text-center text-sm text-gray-400 dark:text-slate-500">
                Sin filas aún — añade clientes y productos en Hoja de Pedidos primero.
              </div>
            )}

            {visibleRows.map((row, idx) => (
              <div key={row.id} className={`flex border-b border-gray-100 dark:border-slate-800 ${rowBg(idx)}`}>
                <div className="w-10 h-10 bg-gray-50 dark:bg-slate-800/30 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">{idx + 1}</div>
                {renderCell(row, 'client', false)}
                {renderCell(row, 'address', false)}
                {renderCell(row, 'product', false)}
                <div className="w-32 h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-3 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0"><span>{row.quantity || ''}</span></div>
                {renderCell(row, 'price', true)}
                {renderCell(row, 'total', true)}
                {renderCell(row, 'status', true)}
                {renderCell(row, 'date', false)}
                {renderCell(row, 'iva', true)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {rows.length > visibleCount && (
        <div className="flex justify-center">
          <button onClick={() => setVisibleCount(prev => prev + ROWS_INITIAL)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap">
            <i className="ri-add-line" /> Ver más filas
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-slate-500">
        Cliente, dirección, producto, cantidad y fecha vienen de Hoja de Pedidos — edítalos ahí. Aquí puedes rellenar precio, total, estado e IVA con doble clic.
      </p>
    </div>
  );
}
