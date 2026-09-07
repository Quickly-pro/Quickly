import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/lib/supabase';

interface OrderItem {
  id: number;
  product: string;
  quantity: string;
  position: number;
}

interface OrderRow {
  id: number;
  employee: string;
  address: string;
  phone: string;
  date: string;
  turno: number;
  clientNote?: string;
  verification?: 'complete' | 'missing' | null;
  items: OrderItem[];
}

const todayStr = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

const blockColors = [
  'border-l-orange-300', 'border-l-blue-300', 'border-l-teal-300',
  'border-l-rose-300', 'border-l-indigo-300', 'border-l-emerald-300',
];

export default function HojaPedidos() {
  const { isEmpresa, isEmpleado } = useRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingField, setEditingField] = useState<{ rowId: number; field: 'employee' | 'address' | 'date' | 'turno' | 'phone' } | null>(null);
  const [editingItem, setEditingItem] = useState<{ itemId: number; field: 'product' | 'quantity' } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Note popover
  const [notePopover, setNotePopover] = useState<number | null>(null);
  const [noteEdit, setNoteEdit] = useState('');
  const [notePos, setNotePos] = useState({ top: 0, left: 0 });
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Nuevo pedido
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ employee: '', address: '', phone: '', date: todayStr(), turno: 1 });
  const [newItems, setNewItems] = useState<{ product: string; quantity: string }[]>([{ product: '', quantity: '' }]);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [newOrderError, setNewOrderError] = useState('');

  const fetchAll = useCallback(async () => {
    const [{ data: rowsData, error: rowsError }, { data: itemsData }, { data: notesData }] = await Promise.all([
      supabase.from('order_sheet_rows').select('*').order('turno').order('id'),
      supabase.from('order_sheet_items').select('*').order('position'),
      supabase.from('order_sheet_notes').select('row_id, note'),
    ]);

    if (rowsError) {
      console.error('Error cargando la hoja de pedidos:', rowsError);
      setLoading(false);
      return;
    }

    let mapped: OrderRow[] = (rowsData || []).map((r: any) => ({
      id: r.id, employee: r.employee || '', address: r.address || '', phone: r.phone || '', date: r.date || '',
      turno: r.turno || 1,
      verification: r.verification || null,
      items: (itemsData || []).filter((it: any) => it.row_id === r.id).map((it: any) => ({ id: it.id, product: it.product || '', quantity: it.quantity || '', position: it.position })),
    }));

    if (mapped.length === 0) {
      const { data: inserted, error: seedError } = await supabase.from('order_sheet_rows').insert(
        Array.from({ length: 5 }).map(() => ({ employee: '', address: '', phone: '', date: '', turno: 1 }))
      ).select('*');
      if (seedError) console.error('Error creando filas iniciales:', seedError);
      mapped = (inserted || []).map((r: any) => ({ id: r.id, employee: '', address: '', phone: '', date: '', turno: 1, verification: null, items: [] }));
    }

    if (notesData) {
      mapped = mapped.map(r => {
        const match = notesData.find((n: any) => n.row_id === r.id);
        return match ? { ...r, clientNote: match.note } : r;
      });
    }

    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const sub = supabase
      .channel(`hoja_pedidos_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_sheet_rows' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_sheet_items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_sheet_notes' }, fetchAll)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchAll]);

  const groupedByTurno = useMemo(() => {
    const map = new Map<number, OrderRow[]>();
    rows.forEach(r => {
      if (!map.has(r.turno)) map.set(r.turno, []);
      map.get(r.turno)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [rows]);

  // ── Edición de campos de cliente (nombre / dirección / fecha / turno) ──
  const openFieldEdit = (row: OrderRow, field: 'employee' | 'address' | 'date' | 'turno' | 'phone') => {
    if (!isEmpresa) return;
    setEditingField({ rowId: row.id, field });
    setEditValue(String(row[field]));
  };

  const saveFieldEdit = async () => {
    if (!editingField) return;
    const { rowId, field } = editingField;
    const value: any = field === 'turno' ? (parseInt(editValue) || 1) : editValue;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    setEditingField(null);
    await supabase.from('order_sheet_rows').update({ [field]: value }).eq('id', rowId);
  };

  // ── Edición de líneas de producto ──────────────────────────────────────
  const openItemEdit = (item: OrderItem, field: 'product' | 'quantity') => {
    if (!isEmpresa) return;
    setEditingItem({ itemId: item.id, field });
    setEditValue(item[field]);
  };

  const saveItemEdit = async () => {
    if (!editingItem) return;
    const { itemId, field } = editingItem;
    setRows(prev => prev.map(r => ({ ...r, items: r.items.map(it => it.id === itemId ? { ...it, [field]: editValue } : it) })));
    setEditingItem(null);
    await supabase.from('order_sheet_items').update({ [field]: editValue }).eq('id', itemId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, save: () => void, cancel: () => void) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  const addItemLine = async (row: OrderRow) => {
    const nextPos = row.items.length > 0 ? Math.max(...row.items.map(i => i.position)) + 1 : 1;
    const { data } = await supabase.from('order_sheet_items').insert({ row_id: row.id, product: '', quantity: '', position: nextPos }).select('*').single();
    if (data) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, items: [...r.items, { id: data.id, product: '', quantity: '', position: data.position }] } : r));
    }
  };

  const removeItemLine = async (rowId: number, itemId: number) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, items: r.items.filter(it => it.id !== itemId) } : r));
    await supabase.from('order_sheet_items').delete().eq('id', itemId);
  };

  // ── Notas ───────────────────────────────────────────────────────────
  const handleNoteOpen = (e: React.MouseEvent<HTMLButtonElement>, row: OrderRow) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverW = 288;
    let left = rect.left;
    if (left + popoverW > window.innerWidth - 12) left = window.innerWidth - popoverW - 12;
    const popoverH = 230;
    let top = rect.bottom + 8;
    if (top + popoverH > window.innerHeight - 12) top = rect.top - popoverH - 8;
    setNotePos({ top, left });
    setNotePopover(row.id);
    setNoteEdit(row.clientNote || '');
    setNoteError('');
  };

  const handleNoteSave = async () => {
    if (notePopover === null || !isEmpresa) return;
    const row = rows.find(r => r.id === notePopover);
    setSavingNote(true);
    setNoteError('');
    const { data, error } = await supabase.rpc('save_order_note', {
      p_row_id: notePopover, p_employee_name: row?.employee || '', p_note: noteEdit,
    });
    setSavingNote(false);
    if (error || !data?.success) { setNoteError(data?.error || error?.message || 'No se pudo guardar la nota'); return; }
    setRows(prev => prev.map(r => r.id === notePopover ? { ...r, clientNote: noteEdit } : r));
    setNotePopover(null);
  };

  const handleNoteDelete = async () => {
    if (notePopover === null || !isEmpresa) return;
    const row = rows.find(r => r.id === notePopover);
    await supabase.rpc('save_order_note', { p_row_id: notePopover, p_employee_name: row?.employee || '', p_note: '' });
    setRows(prev => prev.map(r => r.id === notePopover ? { ...r, clientNote: '' } : r));
    setNotePopover(null);
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setNotePopover(null);
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleNoteSave();
  };

  // ── Verificación ────────────────────────────────────────────────────
  const toggleVerification = async (row: OrderRow) => {
    if (!isEmpleado) return;
    const next: Record<string, 'complete' | 'missing' | null> = { 'null': 'complete', 'complete': 'missing', 'missing': null };
    const newVal = next[String(row.verification)] ?? 'complete';
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, verification: newVal } : r));
    await supabase.from('order_sheet_rows').update({ verification: newVal }).eq('id', row.id);
  };

  // ── Añadir cliente (fila en blanco) / Nuevo pedido guiado ─────────────
  const addBlankClient = async (turno = 1) => {
    const { data } = await supabase.from('order_sheet_rows').insert({ employee: '', address: '', phone: '', date: '', turno }).select('*').single();
    if (data) setRows(prev => [...prev, { id: data.id, employee: '', address: '', phone: '', date: '', turno, verification: null, items: [] }]);
  };

  const handleCreateOrder = async () => {
    if (!newOrder.employee.trim()) { setNewOrderError('Falta el nombre del cliente'); return; }
    setCreatingOrder(true);
    setNewOrderError('');
    const items = newItems.filter(it => it.product.trim() || it.quantity.trim());
    const { data, error } = await supabase.rpc('create_order_row', {
      p_employee: newOrder.employee.trim(),
      p_date: newOrder.date,
      p_address: newOrder.address.trim(),
      p_items: items,
      p_turno: newOrder.turno,
      p_phone: newOrder.phone.trim(),
    });
    setCreatingOrder(false);
    if (error || !data?.success) { setNewOrderError(data?.error || error?.message || 'No se pudo crear el pedido'); return; }
    setShowNewOrder(false);
    setNewOrder({ employee: '', address: '', phone: '', date: todayStr(), turno: 1 });
    setNewItems([{ product: '', quantity: '' }]);
    fetchAll();
  };

  // ── Ir a Rutas y añadir esta dirección al GPS (solo empleado) ───────
  const goToRoute = (row: OrderRow) => {
    if (!isEmpleado || !row.address) return;
    const params = new URLSearchParams({
      name: row.employee || 'Cliente',
      address: row.address,
      autoAdd: '1',
    });
    if (row.phone) params.set('phone', row.phone);
    navigate(`/mapa-reparto?${params.toString()}`);
  };

  const nextTurnoNumber = rows.length > 0 ? Math.max(...rows.map(r => r.turno)) + 1 : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Hoja de Pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {isEmpresa ? 'Editable · ' : 'Solo lectura · '}{rows.length} cliente{rows.length !== 1 ? 's' : ''} en {groupedByTurno.length} turno{groupedByTurno.length !== 1 ? 's' : ''}{loading && ' (cargando...)'}
          </p>
        </div>
        {isEmpresa && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewOrder(true)} className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap">
              <i className="ri-add-circle-line" /> Nuevo Pedido
            </button>
            <button onClick={() => addBlankClient(nextTurnoNumber)} className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap">
              <i className="ri-add-line" /> Nuevo turno ({nextTurnoNumber})
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {loading && rows.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400 dark:text-slate-500">Cargando...</div>
        )}
        {groupedByTurno.map(([turno, turnoRows]) => (
          <div key={turno}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{turno}</div>
              <p className="text-sm font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wide">Turno {turno}</p>
              <span className="text-xs text-gray-400 dark:text-slate-500">· {turnoRows.length} cliente{turnoRows.length !== 1 ? 's' : ''}</span>
              {isEmpresa && (
                <button onClick={() => addBlankClient(turno)} className="ml-auto text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1">
                  <i className="ri-add-line" /> Añadir cliente a este turno
                </button>
              )}
            </div>

            <div className="space-y-3">
              {turnoRows.map((row, idx) => (
                <div key={row.id} className={`bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 border-l-4 ${blockColors[idx % blockColors.length]} overflow-hidden`}>
                  {/* Client header */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-gray-50 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-1.5 min-w-[140px] group">
                      <i className="ri-user-line text-gray-400 text-sm" />
                      {editingField?.rowId === row.id && editingField.field === 'employee' ? (
                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveFieldEdit}
                          onKeyDown={e => handleKeyDown(e, saveFieldEdit, () => setEditingField(null))}
                          className="px-1.5 py-0.5 text-sm font-semibold bg-white dark:bg-slate-800 border border-orange-300 rounded outline-none" />
                      ) : (
                        <span onClick={() => openFieldEdit(row, 'employee')} className={`text-sm font-semibold text-gray-800 dark:text-slate-100 ${isEmpresa ? 'cursor-text hover:underline decoration-dotted' : ''}`}>
                          {row.employee || (isEmpresa ? 'Nombre del cliente...' : '—')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
                      <i className="ri-map-pin-line text-gray-400 text-sm" />
                      {editingField?.rowId === row.id && editingField.field === 'address' ? (
                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveFieldEdit}
                          onKeyDown={e => handleKeyDown(e, saveFieldEdit, () => setEditingField(null))}
                          placeholder="Calle, número, ciudad..."
                          className="flex-1 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-orange-300 rounded outline-none" />
                      ) : isEmpleado && row.address ? (
                        <button
                          onClick={() => goToRoute(row)}
                          title="Ir a Rutas y añadir esta dirección al GPS"
                          className="text-xs text-blue-600 dark:text-blue-400 truncate hover:underline flex items-center gap-1"
                        >
                          {row.address}
                          <i className="ri-navigation-line text-[10px] flex-shrink-0" />
                        </button>
                      ) : (
                        <span onClick={() => openFieldEdit(row, 'address')} className={`text-xs text-gray-500 dark:text-slate-400 truncate ${isEmpresa ? 'cursor-text hover:underline decoration-dotted' : ''}`}>
                          {row.address || (isEmpresa ? 'Añadir dirección...' : 'Sin dirección')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <i className="ri-phone-line text-gray-400 text-sm" />
                      {editingField?.rowId === row.id && editingField.field === 'phone' ? (
                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveFieldEdit}
                          onKeyDown={e => handleKeyDown(e, saveFieldEdit, () => setEditingField(null))}
                          placeholder="+34 600 00 00 00"
                          className="w-32 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-orange-300 rounded outline-none" />
                      ) : (
                        <span onClick={() => openFieldEdit(row, 'phone')} className={`text-xs text-gray-500 dark:text-slate-400 ${isEmpresa ? 'cursor-text hover:underline decoration-dotted' : ''}`}>
                          {row.phone || (isEmpresa ? 'Añadir móvil...' : '')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <i className="ri-calendar-line text-gray-400 text-sm" />
                      {editingField?.rowId === row.id && editingField.field === 'date' ? (
                        <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveFieldEdit}
                          onKeyDown={e => handleKeyDown(e, saveFieldEdit, () => setEditingField(null))}
                          className="w-24 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-orange-300 rounded outline-none" />
                      ) : (
                        <span onClick={() => openFieldEdit(row, 'date')} className={`text-xs text-gray-500 dark:text-slate-400 ${isEmpresa ? 'cursor-text hover:underline decoration-dotted' : ''}`}>
                          {row.date || (isEmpresa ? 'Fecha...' : '—')}
                        </span>
                      )}
                    </div>

                    {isEmpresa && (
                      <div className="flex items-center gap-1.5">
                        <i className="ri-time-line text-gray-400 text-sm" />
                        {editingField?.rowId === row.id && editingField.field === 'turno' ? (
                          <input autoFocus type="number" min={1} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveFieldEdit}
                            onKeyDown={e => handleKeyDown(e, saveFieldEdit, () => setEditingField(null))}
                            className="w-14 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-orange-300 rounded outline-none" />
                        ) : (
                          <span onClick={() => openFieldEdit(row, 'turno')} className="text-xs text-gray-500 dark:text-slate-400 cursor-text hover:underline decoration-dotted">
                            Turno {row.turno}
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={(e) => handleNoteOpen(e, row)}
                      title={row.clientNote ? 'Ver nota' : (isEmpresa ? 'Añadir nota' : 'Sin nota')}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0
                        ${row.clientNote ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-500 dark:text-orange-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-500'}`}
                    >
                      <i className="ri-sticky-note-line" />
                    </button>

                    <div
                      className={`ml-auto flex items-center gap-1.5 transition-transform duration-150 ${isEmpleado ? 'cursor-pointer active:scale-90' : ''}`}
                      onClick={() => toggleVerification(row)}
                      title={isEmpleado ? 'Toca para marcar: completo / falta algo / sin marcar' : ''}
                    >
                      {row.verification === 'complete' && (
                        <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center animate-[popIn_0.25s_ease-out]"><i className="ri-check-line text-sm font-bold" /></span>
                      )}
                      {row.verification === 'missing' && (
                        <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center animate-[popIn_0.25s_ease-out]"><i className="ri-close-line text-sm font-bold" /></span>
                      )}
                      {!row.verification && isEmpleado && (
                        <span className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-orange-300" />
                      )}
                    </div>
                  </div>

                  {/* Product lines */}
                  <div className="divide-y divide-gray-50 dark:divide-slate-800">
                    {row.items.length === 0 && (
                      <div className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 italic">Sin productos todavía</div>
                    )}
                    {row.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2 group">
                        <i className="ri-corner-down-right-line text-gray-300 dark:text-slate-600 text-sm flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {editingItem?.itemId === item.id && editingItem.field === 'product' ? (
                            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveItemEdit}
                              onKeyDown={e => handleKeyDown(e, saveItemEdit, () => setEditingItem(null))}
                              placeholder="Producto"
                              className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-orange-300 rounded outline-none" />
                          ) : (
                            <span onClick={() => openItemEdit(item, 'product')} className={`text-sm text-gray-700 dark:text-slate-200 ${isEmpresa ? 'cursor-text hover:underline decoration-dotted' : ''}`}>
                              {item.product || (isEmpresa ? 'Producto...' : '—')}
                            </span>
                          )}
                        </div>
                        <div className="w-24 flex-shrink-0">
                          {editingItem?.itemId === item.id && editingItem.field === 'quantity' ? (
                            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveItemEdit}
                              onKeyDown={e => handleKeyDown(e, saveItemEdit, () => setEditingItem(null))}
                              placeholder="Cant."
                              className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-orange-300 rounded outline-none" />
                          ) : (
                            <span onClick={() => openItemEdit(item, 'quantity')} className={`text-sm text-gray-600 dark:text-slate-300 ${isEmpresa ? 'cursor-text hover:underline decoration-dotted' : ''}`}>
                              {item.quantity || (isEmpresa ? 'Cant....' : '—')}
                            </span>
                          )}
                        </div>
                        {isEmpresa && (
                          <button onClick={() => removeItemLine(row.id, item.id)} className="w-6 h-6 flex items-center justify-center text-gray-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <i className="ri-close-line text-sm" />
                          </button>
                        )}
                      </div>
                    ))}
                    {isEmpresa && (
                      <button onClick={() => addItemLine(row)} className="w-full text-left px-4 py-2 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 flex items-center gap-1.5">
                        <i className="ri-add-line" /> Añadir producto
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
        <i className="ri-information-line" />
        {isEmpresa
          ? 'Toca cualquier campo para editarlo, incluido el turno. Cada producto es una línea independiente — añade o quita las que necesites.'
          : 'Toca la dirección de un cliente para llevarla directamente a Rutas y verla en el mapa. Toca el círculo de la derecha para marcar cada pedido: ✓ verde si está completo, ✗ roja si falta algo.'}
      </div>

      {/* Note popover */}
      {notePopover !== null && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setNotePopover(null)} />
          <div className="fixed z-50 w-72 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-2xl p-4" style={{ top: notePos.top, left: notePos.left }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center">
                  <i className="ri-sticky-note-line text-orange-500 dark:text-orange-400 text-sm" />
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{isEmpresa ? 'Nota para el empleado' : 'Nota de la empresa'}</p>
              </div>
              <button onClick={() => setNotePopover(null)} className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"><i className="ri-close-line text-sm" /></button>
            </div>
            {isEmpresa ? (
              <>
                <textarea value={noteEdit} onChange={(e) => setNoteEdit(e.target.value)} onKeyDown={handleNoteKeyDown} rows={4} autoFocus
                  placeholder="Ej: Sin gluten, entregar antes de las 10h..."
                  className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-slate-300 resize-none focus:outline-none focus:border-orange-400" />
                {noteError && <p className="text-[10px] text-red-500 mt-1.5">{noteError}</p>}
                <div className="flex items-center justify-between mt-3">
                  {rows.find(r => r.id === notePopover)?.clientNote && (
                    <button onClick={handleNoteDelete} className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-1"><i className="ri-delete-bin-line text-xs" />Eliminar</button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => setNotePopover(null)} className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">Cancelar</button>
                    <button onClick={handleNoteSave} disabled={savingNote} className="px-4 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-60">
                      {savingNote ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <i className="ri-check-line text-xs" />}
                      Guardar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {noteEdit ? <p className="text-xs text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2.5 whitespace-pre-wrap">{noteEdit}</p> : <p className="text-xs text-gray-400 italic">Sin notas.</p>}
                <div className="flex justify-end mt-3"><button onClick={() => setNotePopover(null)} className="px-3 py-1.5 text-xs text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">Cerrar</button></div>
              </>
            )}
          </div>
        </>
      )}

      {/* Nuevo pedido */}
      {showNewOrder && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowNewOrder(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <p className="font-semibold text-gray-800 dark:text-slate-100">Nuevo pedido</p>
                <button onClick={() => setShowNewOrder(false)} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"><i className="ri-close-line" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Cliente *</label>
                    <input type="text" value={newOrder.employee} onChange={(e) => setNewOrder({ ...newOrder, employee: e.target.value })}
                      placeholder="Nombre exacto de la cuenta, para avisarle"
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Dirección</label>
                    <input type="text" value={newOrder.address} onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                      placeholder="Calle, número, ciudad..."
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Móvil</label>
                    <input type="tel" value={newOrder.phone} onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                      placeholder="+34 600 00 00 00"
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Fecha</label>
                    <input type="text" value={newOrder.date} onChange={(e) => setNewOrder({ ...newOrder, date: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Turno</label>
                    <input type="number" min={1} value={newOrder.turno} onChange={(e) => setNewOrder({ ...newOrder, turno: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Productos</p>
                  <div className="space-y-2">
                    {newItems.map((it, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={it.product} onChange={(e) => setNewItems(prev => prev.map((p, idx) => idx === i ? { ...p, product: e.target.value } : p))}
                          placeholder="Producto" className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-300" />
                        <input type="text" value={it.quantity} onChange={(e) => setNewItems(prev => prev.map((p, idx) => idx === i ? { ...p, quantity: e.target.value } : p))}
                          placeholder="Cant." className="w-20 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-300" />
                        <button onClick={() => setNewItems(prev => prev.filter((_, idx) => idx !== i))} disabled={newItems.length === 1}
                          className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 disabled:opacity-30 rounded-lg">
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setNewItems(prev => [...prev, { product: '', quantity: '' }])} className="mt-2 text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                    <i className="ri-add-line" /> Añadir línea de producto
                  </button>
                </div>

                {newOrderError && <p className="text-xs text-red-500">{newOrderError}</p>}
                <p className="text-[11px] text-gray-400 dark:text-slate-500">Si el nombre coincide con la cuenta de un empleado, recibirá una notificación automática.</p>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <button onClick={() => setShowNewOrder(false)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
                  <button onClick={handleCreateOrder} disabled={creatingOrder || !newOrder.employee.trim()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                    {creatingOrder && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Crear pedido
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
