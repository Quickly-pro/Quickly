import { useState, useMemo, useRef } from 'react';
import Modal from '@/components/base/Modal';
import { useRole } from '@/hooks/useRole';
import { useNotificationsContext } from '@/context/NotificationsContext';
import {
  albaranes as initialAlbaranes,
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_ICON,
  type Albaran,
  type AlbaranStatus,
  type AlbaranItem,
} from '@/mocks/albaranes';

const STATUSES: AlbaranStatus[] = ['pendiente', 'en-reparto', 'entregado', 'rechazado', 'facturado'];

const formatCurrency = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const formatDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const newAlbaranId = (existing: Albaran[]) => {
  const year = new Date().getFullYear();
  const nums = existing
    .map(a => a.id.match(/A-(\d{4})-(\d+)/))
    .filter(Boolean)
    .map(m => parseInt(m![2], 10));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `A-${year}-${String(next).padStart(4, '0')}`;
};

const emptyItem = (): AlbaranItem => ({ product: '', qty: 1, unit: 'unidad', price: 0, total: 0 });

const calcItemTotal = (it: AlbaranItem) => +(it.qty * (it.price || 0)).toFixed(2);

export default function Albaranes() {
  const { isEmpresa, isEmpleado } = useRole();
  const { addNotification } = useNotificationsContext();

  const [list, setList] = useState<Albaran[]>(initialAlbaranes);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | AlbaranStatus>('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Albaran | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDeliver, setShowDeliver] = useState<Albaran | null>(null);
  const [showReject, setShowReject] = useState<Albaran | null>(null);
  const [showSign, setShowSign] = useState<Albaran | null>(null);
  const [showDelete, setShowDelete] = useState<Albaran | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Filtros
  const filtered = useMemo(() => {
    return list.filter(a => {
      if (statusFilter !== 'todos' && a.status !== statusFilter) return false;
      if (dateFrom && a.date < dateFrom) return false;
      if (dateTo && a.date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.id.toLowerCase().includes(q) &&
            !a.client.toLowerCase().includes(q) &&
            !(a.driver || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [list, search, statusFilter, dateFrom, dateTo]);

  // KPIs
  const kpis = useMemo(() => {
    const pendientes = list.filter(a => a.status === 'pendiente').length;
    const enReparto = list.filter(a => a.status === 'en-reparto').length;
    const entregados = list.filter(a => a.status === 'entregado').length;
    const total = list.reduce((s, a) => s + a.total, 0);
    return { pendientes, enReparto, entregados, total };
  }, [list]);

  // CRUD ----------------------------------------------------------
  const createAlbaran = (data: Omit<Albaran, 'id'>) => {
    const newA: Albaran = { ...data, id: newAlbaranId(list) };
    setList(prev => [newA, ...prev]);
    addNotification('Albarán creado', `${newA.id} para ${newA.client}`, 'route');
    setShowCreate(false);
  };

  const markDelivered = (a: Albaran, deliveredBy: string, signatureName: string, notes: string) => {
    setList(prev => prev.map(x =>
      x.id === a.id
        ? {
            ...x,
            status: 'entregado',
            deliveredAt: new Date().toISOString(),
            deliveredBy: deliveredBy || x.driver || 'Repartidor',
            signature: signatureName || x.signature,
            notes: notes ? (x.notes ? x.notes + ' · ' : '') + notes : x.notes,
          }
        : x
    ));
    addNotification('Albarán entregado', `${a.id} entregado a ${a.client}`, 'route');
    setShowDeliver(null);
    setSelected(null);
  };

  const rejectAlbaran = (a: Albaran, reason: string) => {
    setList(prev => prev.map(x =>
      x.id === a.id ? { ...x, status: 'rechazado', rejectReason: reason, deliveredAt: new Date().toISOString() } : x
    ));
    addNotification('Albarán rechazado', `${a.id} rechazado por ${a.client}`, 'route');
    setShowReject(null);
    setSelected(null);
  };

  const updateStatus = (a: Albaran, status: AlbaranStatus) => {
    setList(prev => prev.map(x => x.id === a.id ? { ...x, status } : x));
    setSelected(prev => (prev && prev.id === a.id ? { ...prev, status } : prev));
    addNotification('Estado actualizado', `${a.id} ahora está "${STATUS_LABEL[status]}"`, 'route');
  };

  const convertToInvoice = (a: Albaran) => {
    const invoiceId = `F-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    setList(prev => prev.map(x => x.id === a.id ? { ...x, status: 'facturado', invoiceId } : x));
    setSelected(prev => (prev && prev.id === a.id ? { ...prev, status: 'facturado', invoiceId } : prev));
    addNotification('Factura generada', `${a.id} → ${invoiceId}`, 'invoice');
  };

  const deleteAlbaran = (a: Albaran) => {
    setList(prev => prev.filter(x => x.id !== a.id));
    addNotification('Albarán eliminado', `${a.id} se ha eliminado`, 'route');
    setShowDelete(null);
    setSelected(null);
  };

  const signAlbaran = (a: Albaran, name: string) => {
    setList(prev => prev.map(x => x.id === a.id ? { ...x, signature: name } : x));
    // Actualiza también el albarán abierto en el modal de detalle para que la firma se vea al instante.
    setSelected(prev => (prev && prev.id === a.id ? { ...prev, signature: name } : prev));
    addNotification('Albarán firmado', `${a.id} firmado por ${name}`, 'route');
    setShowSign(null);
  };

  const downloadAlbaran = (a: Albaran) => {
    const lines: string[] = [];
    lines.push(`ALBARÁN ${a.id}`);
    lines.push(`Fecha emisión: ${formatDate(a.date)}`);
    lines.push(`Fecha entrega: ${formatDate(a.deliveryDate)}`);
    lines.push('');
    lines.push(`Cliente: ${a.client}`);
    lines.push(`Dirección: ${a.clientAddress}`);
    if (a.clientPhone) lines.push(`Teléfono: ${a.clientPhone}`);
    if (a.clientEmail) lines.push(`Email: ${a.clientEmail}`);
    lines.push('');
    lines.push('LÍNEAS:');
    a.items.forEach(it => {
      lines.push(`  ${it.qty} x ${it.product} (${it.unit || 'ud'}) — ${formatCurrency(it.price || 0)} = ${formatCurrency(calcItemTotal(it))}`);
    });
    lines.push('');
    lines.push(`Subtotal: ${formatCurrency(a.subtotal)}`);
    lines.push(`IVA: ${formatCurrency(a.tax)}`);
    lines.push(`TOTAL: ${formatCurrency(a.total)}`);
    if (a.driver) lines.push(`Repartidor: ${a.driver}`);
    if (a.deliveredAt) lines.push(`Entregado: ${formatDateTime(a.deliveredAt)}`);
    if (a.signature) lines.push(`Firma: ${a.signature}`);
    if (a.notes) lines.push(`Notas: ${a.notes}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${a.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printAlbaran = () => {
    if (!selected) return;
    window.print();
  };

  return (
    <div className="space-y-5 print:block">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Albaranes</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Gestión de notas de entrega · seguimiento de mercancía hasta el cliente
          </p>
        </div>
        {isEmpresa && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium shadow-sm transition-all"
          >
            <i className="ri-add-line text-lg" />
            Nuevo albarán
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <KpiCard icon="ri-time-line" color="amber" label="Pendientes" value={String(kpis.pendientes)} />
        <KpiCard icon="ri-truck-line" color="blue" label="En reparto" value={String(kpis.enReparto)} />
        <KpiCard icon="ri-check-double-line" color="green" label="Entregados" value={String(kpis.entregados)} />
        <KpiCard icon="ri-money-euro-circle-line" color="purple" label="Total" value={formatCurrency(kpis.total)} />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nº, cliente o repartidor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="todos">Todos los estados</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {(search || statusFilter !== 'todos' || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('todos'); setDateFrom(''); setDateTo(''); }}
            className="mt-3 text-xs text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
          >
            <i className="ri-close-line" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Nº</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden md:table-cell">Repartidor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300 hidden lg:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Estado</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 dark:text-slate-500">
                    <i className="ri-file-list-3-line text-3xl mb-2 block" />
                    No hay albaranes que coincidan con los filtros
                  </td>
                </tr>
              )}
              {filtered.map(a => (
                <tr
                  key={a.id}
                  className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-orange-50/40 dark:hover:bg-orange-900/10 transition-colors cursor-pointer"
                  onClick={() => setSelected(a)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700 dark:text-slate-200">{a.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 dark:text-slate-200">{a.client}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[200px]">{a.clientAddress}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400 hidden md:table-cell">{a.driver || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400 hidden lg:table-cell">{formatDate(a.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLOR[a.status]}`}>
                      <i className={STATUS_ICON[a.status]} />
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-slate-200">
                    {formatCurrency(a.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelected(a)}
                        title="Ver detalle"
                        className="w-7 h-7 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 inline-flex items-center justify-center"
                      >
                        <i className="ri-eye-line text-sm" />
                      </button>
                      {(a.status === 'pendiente' || a.status === 'en-reparto') && (
                        <button
                          onClick={() => setShowDeliver(a)}
                          title="Marcar entregado"
                          className="w-7 h-7 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 inline-flex items-center justify-center"
                        >
                          <i className="ri-check-line text-sm" />
                        </button>
                      )}
                      <button
                        onClick={() => downloadAlbaran(a)}
                        title="Descargar"
                        className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 inline-flex items-center justify-center"
                      >
                        <i className="ri-download-2-line text-sm" />
                      </button>
                      {isEmpresa && (
                        <button
                          onClick={() => setShowDelete(a)}
                          title="Eliminar"
                          className="w-7 h-7 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 inline-flex items-center justify-center"
                        >
                          <i className="ri-delete-bin-line text-sm" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        size="2xl"
        title={selected ? (
          <div className="flex items-center gap-2">
            <span className="font-mono">{selected.id}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLOR[selected.status]}`}>
              <i className={STATUS_ICON[selected.status]} />
              {STATUS_LABEL[selected.status]}
            </span>
          </div>
        ) : ''}
      >
        {selected && (
          <div ref={printRef} className="space-y-5">
            {/* Cliente y datos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailBlock title="Cliente" icon="ri-user-line">
                <p className="font-semibold text-gray-800 dark:text-slate-100">{selected.client}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">{selected.clientAddress}</p>
                {selected.clientPhone && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1"><i className="ri-phone-line mr-1" />{selected.clientPhone}</p>}
                {selected.clientEmail && <p className="text-xs text-gray-500 dark:text-slate-400"><i className="ri-mail-line mr-1" />{selected.clientEmail}</p>}
              </DetailBlock>
              <DetailBlock title="Reparto" icon="ri-truck-line">
                <p className="text-sm"><span className="text-gray-500 dark:text-slate-400">Repartidor:</span> <span className="font-medium text-gray-700 dark:text-slate-200">{selected.driver || '—'}</span></p>
                <p className="text-sm"><span className="text-gray-500 dark:text-slate-400">Vehículo:</span> <span className="font-medium text-gray-700 dark:text-slate-200">{selected.vehicle || '—'}</span></p>
                <p className="text-sm"><span className="text-gray-500 dark:text-slate-400">Emitido:</span> <span className="text-gray-700 dark:text-slate-200">{formatDate(selected.date)}</span></p>
                <p className="text-sm"><span className="text-gray-500 dark:text-slate-400">Entrega prevista:</span> <span className="text-gray-700 dark:text-slate-200">{formatDate(selected.deliveryDate)}</span></p>
                {selected.deliveredAt && (
                  <p className="text-sm"><span className="text-gray-500 dark:text-slate-400">Entregado:</span> <span className="text-green-600 font-medium">{formatDateTime(selected.deliveredAt)}</span></p>
                )}
              </DetailBlock>
            </div>

            {/* Items */}
            <div className="border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                Líneas del albarán
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800">
                  <tr className="text-xs text-gray-500 dark:text-slate-400">
                    <th className="text-left px-4 py-2 font-medium">Producto</th>
                    <th className="text-right px-4 py-2 font-medium">Cant.</th>
                    <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">Precio</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-slate-800/40 last:border-b-0">
                      <td className="px-4 py-2 text-gray-700 dark:text-slate-200">{it.product}</td>
                      <td className="px-4 py-2 text-right text-gray-600 dark:text-slate-300">{it.qty} {it.unit || ''}</td>
                      <td className="px-4 py-2 text-right text-gray-600 dark:text-slate-300 hidden sm:table-cell">{formatCurrency(it.price || 0)}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-800 dark:text-slate-100">{formatCurrency(calcItemTotal(it))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="flex justify-end">
              <div className="w-full sm:w-72 space-y-1">
                <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selected.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                  <span>IVA</span>
                  <span>{formatCurrency(selected.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-gray-800 dark:text-slate-100 border-t border-gray-100 dark:border-slate-700 pt-2 mt-1">
                  <span>TOTAL</span>
                  <span>{formatCurrency(selected.total)}</span>
                </div>
              </div>
            </div>

            {/* Notas/firma/rechazo */}
            {selected.notes && (
              <div className="p-3 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                <span className="font-medium">📝 Notas:</span> {selected.notes}
              </div>
            )}
            {selected.rejectReason && (
              <div className="p-3 bg-red-50/60 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg text-sm text-red-800 dark:text-red-200">
                <span className="font-medium">❌ Motivo de rechazo:</span> {selected.rejectReason}
              </div>
            )}
            {selected.signature && (
              <div className="p-3 bg-green-50/60 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg text-sm text-green-800 dark:text-green-200">
                <span className="font-medium">✍️ Firmado por:</span> {selected.signature}
              </div>
            )}
            {selected.invoiceId && (
              <div className="p-3 bg-purple-50/60 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 rounded-lg text-sm text-purple-800 dark:text-purple-200">
                <span className="font-medium">🧾 Factura asociada:</span> {selected.invoiceId}
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 print:hidden">
              {(selected.status === 'pendiente' || selected.status === 'en-reparto') && (
                <>
                  <button
                    onClick={() => setShowDeliver(selected)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
                  >
                    <i className="ri-check-double-line" /> Marcar entregado
                  </button>
                  <button
                    onClick={() => setShowReject(selected)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg text-sm font-medium"
                  >
                    <i className="ri-close-circle-line" /> Rechazar
                  </button>
                  {selected.status === 'pendiente' && (
                    <button
                      onClick={() => updateStatus(selected, 'en-reparto')}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg text-sm font-medium"
                    >
                      <i className="ri-truck-line" /> Iniciar reparto
                    </button>
                  )}
                </>
              )}
              {selected.status === 'entregado' && !selected.invoiceId && isEmpresa && (
                <button
                  onClick={() => convertToInvoice(selected)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium"
                >
                  <i className="ri-bill-line" /> Convertir a factura
                </button>
              )}
              <button
                onClick={() => setShowSign(selected)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium"
              >
                <i className="ri-pen-nib-line" /> Firmar
              </button>
              <button
                onClick={() => downloadAlbaran(selected)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium"
              >
                <i className="ri-download-2-line" /> Descargar
              </button>
              <button
                onClick={printAlbaran}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium"
              >
                <i className="ri-printer-line" /> Imprimir
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE MODAL */}
      {showCreate && (
        <CreateAlbaranModal
          onClose={() => setShowCreate(false)}
          onCreate={createAlbaran}
        />
      )}

      {/* DELIVER MODAL */}
      <Modal
        isOpen={!!showDeliver}
        onClose={() => setShowDeliver(null)}
        size="md"
        title={<span className="text-green-700 dark:text-green-400"><i className="ri-check-double-line mr-1" />Confirmar entrega</span>}
      >
        {showDeliver && (
          <DeliverForm
            albaran={showDeliver}
            onConfirm={(by, sig, notes) => markDelivered(showDeliver, by, sig, notes)}
            onCancel={() => setShowDeliver(null)}
          />
        )}
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={!!showReject}
        onClose={() => setShowReject(null)}
        size="md"
        title={<span className="text-red-700 dark:text-red-400"><i className="ri-close-circle-line mr-1" />Rechazar albarán</span>}
      >
        {showReject && (
          <RejectForm
            onConfirm={(reason) => rejectAlbaran(showReject, reason)}
            onCancel={() => setShowReject(null)}
          />
        )}
      </Modal>

      {/* SIGN MODAL */}
      <Modal
        isOpen={!!showSign}
        onClose={() => setShowSign(null)}
        size="md"
        title="Firmar albarán"
      >
        {showSign && (
          <SignForm
            onConfirm={(name) => signAlbaran(showSign, name)}
            onCancel={() => setShowSign(null)}
          />
        )}
      </Modal>

      {/* DELETE MODAL */}
      <Modal
        isOpen={!!showDelete}
        onClose={() => setShowDelete(null)}
        size="sm"
        title="Eliminar albarán"
      >
        {showDelete && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              ¿Seguro que quieres eliminar el albarán <span className="font-mono font-bold">{showDelete.id}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDelete(null)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
              <button onClick={() => deleteAlbaran(showDelete)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium">Eliminar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------- Subcomponentes ----------

function KpiCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  const palette: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${palette[color]}`}>
          <i className={`${icon} text-xl`} />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
          <p className="text-lg font-bold text-gray-800 dark:text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800/40 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
        <i className={icon} /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DeliverForm({
  albaran,
  onConfirm,
  onCancel,
}: {
  albaran: Albaran;
  onConfirm: (deliveredBy: string, signature: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [deliveredBy, setDeliveredBy] = useState(albaran.driver || '');
  const [signature, setSignature] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-50/60 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg text-sm text-green-800 dark:text-green-200">
        Vas a marcar el albarán <span className="font-mono font-bold">{albaran.id}</span> de <span className="font-medium">{albaran.client}</span> como ENTREGADO. La empresa recibirá una notificación.
      </div>
      <div>
        <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Repartidor que entrega</label>
        <input
          type="text"
          value={deliveredBy}
          onChange={e => setDeliveredBy(e.target.value)}
          placeholder="Nombre del repartidor"
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <div>
        <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Firma del receptor (nombre)</label>
        <input
          type="text"
          value={signature}
          onChange={e => setSignature(e.target.value)}
          placeholder="Ej: Antonio Pérez (Jefe de cocina)"
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <div>
        <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Observaciones (opcional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Ej: Mercancía revisada y aceptada sin incidencias."
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
        <button
          onClick={() => onConfirm(deliveredBy, signature, notes)}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium inline-flex items-center gap-1"
        >
          <i className="ri-check-double-line" /> Confirmar entrega
        </button>
      </div>
    </div>
  );
}

function RejectForm({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Motivo del rechazo</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          placeholder="Indica por qué el cliente rechaza la entrega..."
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
        <button
          onClick={() => reason.trim() && onConfirm(reason.trim())}
          disabled={!reason.trim()}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar rechazo
        </button>
      </div>
    </div>
  );
}

function SignForm({ onConfirm, onCancel }: { onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Introduce el nombre completo de la persona que firma el albarán.
      </p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre y apellidos"
        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
        <button
          onClick={() => name.trim() && onConfirm(name.trim())}
          disabled={!name.trim()}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
        >
          Firmar
        </button>
      </div>
    </div>
  );
}

function CreateAlbaranModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (a: Omit<Albaran, 'id'>) => void;
}) {
  const [client, setClient] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [driver, setDriver] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<AlbaranItem[]>([emptyItem()]);

  const subtotal = items.reduce((s, it) => s + calcItemTotal(it), 0);
  const tax = +(subtotal * 0.21).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  const updateItem = (i: number, field: keyof AlbaranItem, value: any) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value, total: calcItemTotal({ ...it, [field]: value }) } : it));
  };

  const submit = () => {
    if (!client.trim() || !clientAddress.trim() || items.length === 0) return;
    onCreate({
      client: client.trim(),
      clientAddress: clientAddress.trim(),
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      date,
      deliveryDate,
      driver: driver.trim() || undefined,
      vehicle: vehicle.trim() || undefined,
      status: 'pendiente',
      items: items.filter(it => it.product.trim()),
      subtotal,
      tax,
      total,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="2xl" title="Nuevo albarán">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Cliente *" value={client} onChange={setClient} placeholder="Nombre del cliente" />
          <Input label="Dirección *" value={clientAddress} onChange={setClientAddress} placeholder="Dirección de entrega" />
          <Input label="Teléfono" value={clientPhone} onChange={setClientPhone} placeholder="+34 ..." />
          <Input label="Email" value={clientEmail} onChange={setClientEmail} placeholder="email@cliente.com" />
          <Input label="Fecha emisión" value={date} onChange={setDate} type="date" />
          <Input label="Fecha entrega" value={deliveryDate} onChange={setDeliveryDate} type="date" />
          <Input label="Repartidor" value={driver} onChange={setDriver} placeholder="Asignado a..." />
          <Input label="Vehículo" value={vehicle} onChange={setVehicle} placeholder="Furgoneta / matrícula" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Líneas del albarán</span>
            <button
              onClick={() => setItems(prev => [...prev, emptyItem()])}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
            >
              <i className="ri-add-line" /> Añadir línea
            </button>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="Producto"
                  value={it.product}
                  onChange={e => updateItem(i, 'product', e.target.value)}
                  className="col-span-5 px-2 py-1.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Cant."
                  value={it.qty}
                  onChange={e => updateItem(i, 'qty', +e.target.value)}
                  className="col-span-2 px-2 py-1.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Ud."
                  value={it.unit}
                  onChange={e => updateItem(i, 'unit', e.target.value)}
                  className="col-span-2 px-2 py-1.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Precio"
                  value={it.price}
                  onChange={e => updateItem(i, 'price', +e.target.value)}
                  className="col-span-2 px-2 py-1.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg"
                />
                <button
                  onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="col-span-1 w-7 h-7 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 disabled:opacity-30 inline-flex items-center justify-center mx-auto"
                >
                  <i className="ri-delete-bin-line text-sm" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-slate-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-gray-600 dark:text-slate-400"><span>IVA (21%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between font-bold text-gray-800 dark:text-slate-100 border-t border-gray-100 dark:border-slate-700 pt-1"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Instrucciones especiales para el reparto..."
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
          <button
            onClick={submit}
            disabled={!client.trim() || !clientAddress.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            Crear albarán
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Input({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  );
}
