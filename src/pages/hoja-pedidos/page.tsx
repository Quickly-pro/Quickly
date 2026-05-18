import { useState } from 'react';
import { useRole } from '@/hooks/useRole';

interface OrderRow {
  id: number;
  employee: string;
  date: string;
  product1: string;
  cant1: string;
  product2: string;
  cant2: string;
  product3: string;
  cant3: string;
  product4: string;
  cant4: string;
}

const INITIAL_ROWS = 20;
const ROWS_ADD = 20;

const sampleData: OrderRow[] = [
  { id: 1, employee: 'Juan García', date: '01/05/2026', product1: 'Leche 1L', cant1: '10', product2: 'Pan', cant2: '5', product3: 'Aceite 5L', cant3: '2', product4: 'Cerveza', cant4: '24' },
  { id: 2, employee: 'María López', date: '01/05/2026', product1: 'Harina 10kg', cant1: '3', product2: 'Azúcar', cant2: '5', product3: '', cant3: '', product4: '', cant4: '' },
  { id: 3, employee: 'Carlos Ruiz', date: '01/05/2026', product1: 'Agua 1.5L', cant1: '20', product2: 'Coca-Cola', cant2: '12', product3: 'Zumo', cant3: '6', product4: '', cant4: '' },
  { id: 4, employee: 'Ana Martínez', date: '01/05/2026', product1: 'Vino Tinto', cant1: '6', product2: 'Cerveza', cant2: '12', product3: '', cant3: '', product4: '', cant4: '' },
  { id: 5, employee: 'Pedro Sánchez', date: '01/05/2026', product1: 'Leche 1L', cant1: '15', product2: 'Pan', cant2: '8', product3: 'Mantequilla', cant3: '4', product4: '', cant4: '' },
];

const defaultRow = (id: number): OrderRow => ({
  id,
  employee: '',
  date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'),
  product1: '', cant1: '',
  product2: '', cant2: '',
  product3: '', cant3: '',
  product4: '', cant4: '',
});

const rowBg = (idx: number) => {
  const palette = [
    'bg-white dark:bg-slate-900',
    'bg-slate-50/60 dark:bg-slate-800/30',
    'bg-amber-50/40 dark:bg-amber-900/10',
    'bg-teal-50/40 dark:bg-teal-900/10',
    'bg-rose-50/40 dark:bg-rose-900/10',
    'bg-indigo-50/40 dark:bg-indigo-900/10',
  ];
  return palette[idx % palette.length];
};

const LS_KEY = 'hoja-pedidos-rows';

function loadRows(): OrderRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as OrderRow[];
  } catch { /* ignore */ }
  return [
    ...sampleData,
    ...Array.from({ length: INITIAL_ROWS - sampleData.length }).map((_, i) => defaultRow(sampleData.length + i + 1)),
  ];
}

export default function HojaPedidos() {
  const { isEmpresa } = useRole();
  const [rows, setRows] = useState<OrderRow[]>(loadRows);
  const [editingCell, setEditingCell] = useState<{ rowId: number; field: keyof OrderRow } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const handleCellClick = (row: OrderRow, field: keyof OrderRow) => {
    if (!isEmpresa) return;
    setEditingCell({ rowId: row.id, field });
    setEditValue(String(row[field]));
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    setRows(prev => prev.map(r => {
      if (r.id !== editingCell.rowId) return r;
      return { ...r, [editingCell.field]: editValue };
    }));
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellSave();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const addRows = () => {
    const startId = rows.length + 1;
    const newRows = Array.from({ length: ROWS_ADD }).map((_, i) => defaultRow(startId + i));
    setRows(prev => [...prev, ...newRows]);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(rows));
    } catch { /* ignore quota errors */ }
    setSavedMessage('Hoja de pedidos guardada correctamente');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const isEditing = (row: OrderRow, field: keyof OrderRow) =>
    editingCell?.rowId === row.id && editingCell?.field === field;

  const renderCell = (row: OrderRow, field: keyof OrderRow, width: string = 'w-36') => (
    <div
      className={`${width} h-10 border-r border-gray-100 dark:border-slate-800 flex items-center px-2 text-xs text-gray-600 dark:text-slate-300 flex-shrink-0 ${isEmpresa ? 'cursor-text' : 'cursor-default select-none'}`}
      onClick={() => handleCellClick(row, field)}
    >
      {isEditing(row, field) ? (
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
        <span className="truncate">{row[field] || ''}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Hoja de Pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {isEmpresa ? 'Editable · ' : 'Solo lectura · '}{rows.length} filas
          </p>
        </div>
        {isEmpresa && (
          <div className="flex items-center gap-2">
            <button
              onClick={addRows}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-add-line" />
              </div>
              Añadir {ROWS_ADD} filas
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-save-line" />
              </div>
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Saved message */}
      {savedMessage && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line" />
          </div>
          {savedMessage}
        </div>
      )}

      {/* Read-only banner for empleado */}
      {!isEmpresa && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <i className="ri-eye-line" />
          </div>
          Modo lectura — solo puedes consultar esta hoja.
        </div>
      )}

      {/* Spreadsheet */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Column headers (A, B, C...) */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
              <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500 flex-shrink-0">
                #
              </div>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((label) => (
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
              {['CLIENTE', 'FECHA', 'PRODUCTO 1', 'CANT. 1', 'PRODUCTO 2', 'CANT. 2', 'PRODUCTO 3', 'CANT. 3', 'PRODUCTO 4'].map((header) => (
                <div
                  key={header}
                  className="w-36 h-10 border-r border-gray-200 dark:border-slate-700 flex items-center px-3 text-xs font-bold text-gray-700 dark:text-slate-200 flex-shrink-0"
                >
                  {header}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {rows.map((row, idx) => (
              <div key={row.id} className={`flex border-b border-gray-50 dark:border-slate-800 ${rowBg(idx)}`}>
                <div className="w-10 h-10 bg-gray-50 dark:bg-slate-800/30 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                  {idx + 2}
                </div>
                {renderCell(row, 'employee')}
                {renderCell(row, 'date')}
                {renderCell(row, 'product1')}
                {renderCell(row, 'cant1')}
                {renderCell(row, 'product2')}
                {renderCell(row, 'cant2')}
                {renderCell(row, 'product3')}
                {renderCell(row, 'cant3')}
                {renderCell(row, 'product4')}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-information-line" />
        </div>
        {isEmpresa ? 'Haz clic en cualquier celda para editarla. Pulsa Enter para guardar.' : 'Solo consulta. Sin edición disponible para tu rol.'}
      </div>
    </div>
  );
}
