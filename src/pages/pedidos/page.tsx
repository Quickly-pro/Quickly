import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useClickOutside } from '@/hooks/useClickOutside';
import Modal from '@/components/base/Modal';

const statusConfig: Record<string, { label: string; color: string; darkColor: string }> = {
  pending_payment: { label: 'Pendiente Pago', color: 'bg-amber-50 text-amber-600', darkColor: 'dark:bg-amber-900/20 dark:text-amber-400' },
  paid: { label: 'Pagado', color: 'bg-green-50 text-green-600', darkColor: 'dark:bg-green-900/20 dark:text-green-400' },
  processing: { label: 'En Preparación', color: 'bg-blue-50 text-blue-600', darkColor: 'dark:bg-blue-900/20 dark:text-blue-400' },
  shipped: { label: 'Enviado', color: 'bg-orange-50 text-orange-600', darkColor: 'dark:bg-orange-900/20 dark:text-orange-400' },
  delivered: { label: 'Entregado', color: 'bg-green-50 text-green-600', darkColor: 'dark:bg-green-900/20 dark:text-green-400' },
  cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-600', darkColor: 'dark:bg-red-900/20 dark:text-red-400' },
  refunded: { label: 'Reembolsado', color: 'bg-gray-50 text-gray-600', darkColor: 'dark:bg-slate-800 dark:text-slate-400' },
  en_proceso: { label: 'En Proceso', color: 'bg-amber-50 text-amber-600', darkColor: 'dark:bg-amber-900/20 dark:text-amber-400' },
  recibido: { label: 'Recibido', color: 'bg-green-50 text-green-600', darkColor: 'dark:bg-green-900/20 dark:text-green-400' },
};

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending_payment', label: 'Pendiente Pago' },
  { value: 'paid', label: 'Pagado' },
  { value: 'processing', label: 'En Preparación' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'refunded', label: 'Reembolsado' },
];

const paymentOptions = [
  { value: '', label: 'Todos los métodos' },
  { value: 'manual', label: 'Manual' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' },
];

const ITEMS_PER_PAGE = 10;

export default function Pedidos() {
  const [activeTab, setActiveTab] = useState<'client' | 'factory'>('client');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showNewFactoryOrder, setShowNewFactoryOrder] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [clientOrders, setClientOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [factoryOrders, setFactoryOrders] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortField, setSortField] = useState<'id' | 'date' | 'total'>('id');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // New order form
  const [newFactoryOrder, setNewFactoryOrder] = useState({ factory: '', product: '', qty: '', unitPrice: '', expectedDelivery: '' });
  const [newOrderForm, setNewOrderForm] = useState({ clientId: '', currency: 'EUR', payment: 'manual', notes: '' });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const [{ data: ohData }, { data: oiData }, { data: clData }] = await Promise.all([
      supabase.from('order_headers').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('order_items').select('*'),
      supabase.from('clients').select('id, name'),
    ]);
    if (ohData) setClientOrders(ohData);
    if (oiData) setOrderItems(oiData);
    if (clData) setClientsList(clData);
    setFactoryOrders([
      { id: 'FAB-001', factory: 'Aceites del Sur S.A.', product: 'Aceite Oliva Virgen 5L', qty: 500, unitPrice: 18.50, total: 9250, status: 'en_proceso', expectedDelivery: '2026-05-15' },
      { id: 'FAB-002', factory: 'Lácteos del Norte', product: 'Leche Entera 1L pack x6', qty: 1200, unitPrice: 4.20, total: 5040, status: 'recibido', expectedDelivery: '2026-04-28' },
      { id: 'FAB-003', factory: 'Conservas La Sierra', product: 'Tomate Triturado 400g', qty: 800, unitPrice: 1.85, total: 1480, status: 'en_proceso', expectedDelivery: '2026-05-10' },
      { id: 'FAB-004', factory: 'Panadería El Horno', product: 'Harina de trigo 5kg', qty: 300, unitPrice: 3.50, total: 1050, status: 'en_proceso', expectedDelivery: '2026-05-05' },
      { id: 'FAB-005', factory: 'Bebidas Premium', product: 'Agua mineral pack x12', qty: 2000, unitPrice: 2.10, total: 4200, status: 'recibido', expectedDelivery: '2026-04-25' },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getItemsForOrder = (orderId: number) => orderItems.filter(i => i.order_id === orderId);

  const getClientName = (order: any) => {
    const cid = order.customer_id;
    if (!cid) return order.recipient?.name || 'Sin nombre';
    const found = clientsList.find(c => String(c.id) === String(cid) || String(c.id) === String(cid).replace(/[^0-9]/g, ''));
    return found?.name || order.recipient?.name || 'Sin nombre';
  };

  const totalAmount = (order: any) => {
    const items = getItemsForOrder(order.id);
    return items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
      + Number(order.shipping_total || 0)
      + Number(order.tax_total || 0)
      - Number(order.discount_price || 0);
  };

  // Filtering and sorting
  const filteredOrders = useMemo(() => {
    let data = [...clientOrders];

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      data = data.filter(o => {
        const name = getClientName(o).toLowerCase();
        const phone = (o.recipient?.phone || '').toLowerCase();
        const address = (o.recipient?.address || '').toLowerCase();
        const itemsText = getItemsForOrder(o.id).map((i: any) => i.product_name).join(' ').toLowerCase();
        return name.includes(q) || phone.includes(q) || address.includes(q) || itemsText.includes(q) || String(o.id).includes(q);
      });
    }

    if (filterStatus) data = data.filter(o => o.status === filterStatus);
    if (filterPayment) data = data.filter(o => o.payment_provider === filterPayment);
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      data = data.filter(o => new Date(o.created_at) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo + 'T23:59:59');
      data = data.filter(o => new Date(o.created_at) <= to);
    }

    data.sort((a, b) => {
      if (sortField === 'id') return sortAsc ? a.id - b.id : b.id - a.id;
      if (sortField === 'date') {
        return sortAsc
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortField === 'total') {
        return sortAsc ? totalAmount(a) - totalAmount(b) : totalAmount(b) - totalAmount(a);
      }
      return 0;
    });

    return data;
  }, [clientOrders, searchText, filterStatus, filterPayment, filterDateFrom, filterDateTo, sortField, sortAsc, clientsList, orderItems]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice((currentPageSafe - 1) * ITEMS_PER_PAGE, currentPageSafe * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchText('');
    setFilterStatus('');
    setFilterPayment('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSortField('id');
    setSortAsc(false);
    setCurrentPage(1);
  };

  const activeFilterCount = [filterStatus, filterPayment, filterDateFrom, filterDateTo].filter(Boolean).length;

  const addFactoryOrder = () => {
    if (!newFactoryOrder.factory || !newFactoryOrder.product) return;
    const newId = `FAB-${String(factoryOrders.length + 1).padStart(3, '0')}`;
    const total = Number(newFactoryOrder.qty || 0) * Number(newFactoryOrder.unitPrice || 0);
    setFactoryOrders(prev => [
      { id: newId, factory: newFactoryOrder.factory, product: newFactoryOrder.product, qty: Number(newFactoryOrder.qty), unitPrice: Number(newFactoryOrder.unitPrice), total, status: 'en_proceso', expectedDelivery: newFactoryOrder.expectedDelivery },
      ...prev,
    ]);
    setNewFactoryOrder({ factory: '', product: '', qty: '', unitPrice: '', expectedDelivery: '' });
    setShowNewFactoryOrder(false);
  };

  const orderDetailRef = useRef<HTMLDivElement>(null);
  const newOrderRef = useRef<HTMLDivElement>(null);
  const newFactoryOrderRef = useRef<HTMLDivElement>(null);
  useClickOutside(orderDetailRef, () => setShowOrderDetail(false), showOrderDetail);
  useClickOutside(newOrderRef, () => setShowNewOrder(false), showNewOrder);
  useClickOutside(newFactoryOrderRef, () => setShowNewFactoryOrder(false), showNewFactoryOrder);

  const createOrder = async () => {
    if (!newOrderForm.clientId) return;
    const { error } = await supabase.from('order_headers').insert({
      customer_id: newOrderForm.clientId,
      currency: newOrderForm.currency,
      payment_provider: newOrderForm.payment,
      customer_notes: newOrderForm.notes || null,
      status: 'pending_payment',
    });
    if (!error) {
      setShowNewOrder(false);
      setNewOrderForm({ clientId: '', currency: 'EUR', payment: 'manual', notes: '' });
      fetchOrders();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Gestión de Pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Pedidos de clientes y pedidos a fábricas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('client')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === 'client' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            Pedidos Clientes
          </button>
          <button
            onClick={() => setActiveTab('factory')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === 'factory' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            Pedidos Fábrica
          </button>
        </div>
      </div>

      {activeTab === 'client' && (
        <>
          {/* KPIs */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">Total Pedidos</p>
              <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{clientOrders.length}{loading && '...'}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">Pendientes Pago</p>
              <p className="text-xl font-bold text-amber-600">{clientOrders.filter(o => o.status === 'pending_payment').length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">Pagados</p>
              <p className="text-xl font-bold text-green-600">{clientOrders.filter(o => o.status === 'paid').length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">Enviados</p>
              <p className="text-xl font-bold text-blue-600">{clientOrders.filter(o => o.status === 'shipped').length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">Total Facturado</p>
              <p className="text-xl font-bold text-orange-600">
                €{clientOrders.reduce((sum, o) => sum + totalAmount(o), 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] relative">
                <div className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                  <i className="ri-search-line text-gray-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por cliente, producto, teléfono, dirección..."
                  value={searchText}
                  onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              >
                {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select
                value={filterPayment}
                onChange={e => { setFilterPayment(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              >
                {paymentOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                title="Desde"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                title="Hasta"
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg whitespace-nowrap"
                >
                  Limpiar filtros ({activeFilterCount})
                </button>
              )}
              <button
                onClick={() => setShowNewOrder(true)}
                className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
                Nuevo Pedido
              </button>
            </div>

            {/* Sort + Results info */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {filteredOrders.length} resultado{filteredOrders.length !== 1 ? 's' : ''} {searchText && `(búsqueda: "${searchText}")`}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-slate-400">Ordenar:</span>
                <button
                  onClick={() => { setSortField('id'); setSortAsc(!sortAsc); }}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${sortField === 'id' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'}`}
                >
                  ID {sortField === 'id' && (sortAsc ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => { setSortField('date'); setSortAsc(!sortAsc); }}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${sortField === 'date' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'}`}
                >
                  Fecha {sortField === 'date' && (sortAsc ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => { setSortField('total'); setSortAsc(!sortAsc); }}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${sortField === 'total' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'}`}
                >
                  Total {sortField === 'total' && (sortAsc ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">ID Pedido</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Cliente</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Productos</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Total</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Pago</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500">Cargando pedidos...</td></tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500">
                      No hay pedidos que coincidan con los filtros.
                    </td></tr>
                  ) : (
                    paginatedOrders.map((order) => {
                      const items = getItemsForOrder(order.id);
                      const clientName = getClientName(order);
                      return (
                        <tr key={order.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">
                            PED-{String(order.id).padStart(6, '0')}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700 dark:text-slate-300 font-medium text-sm">{clientName}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{order.recipient?.phone || '-'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-700 dark:text-slate-300">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[180px]">
                              {items.map(i => i.product_name).join(', ') || 'Sin items'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{formatDate(order.created_at)}</td>
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">
                            €{totalAmount(order).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status]?.color || 'bg-gray-50 text-gray-600'} ${statusConfig[order.status]?.darkColor || ''}`}>
                              {statusConfig[order.status]?.label || order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400 capitalize">{order.payment_provider || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setSelectedOrder(order); setShowOrderDetail(true); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                                title="Ver detalle"
                              >
                                <i className="ri-eye-line text-gray-500 dark:text-slate-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredOrders.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Mostrando {((currentPageSafe - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPageSafe * ITEMS_PER_PAGE, filteredOrders.length)} de {filteredOrders.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPageSafe <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <i className="ri-arrow-left-s-line text-gray-600 dark:text-slate-400" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all
                        ${p === currentPageSafe ? 'bg-orange-500 text-white' : 'border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPageSafe >= totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <i className="ri-arrow-right-s-line text-gray-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'factory' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">Total Pedidos Fábrica</p>
                <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{factoryOrders.length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">En Proceso</p>
                <p className="text-xl font-bold text-amber-600">{factoryOrders.filter(o => o.status === 'en_proceso').length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">Recibidos</p>
                <p className="text-xl font-bold text-green-600">{factoryOrders.filter(o => o.status === 'recibido').length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-400">Valor Total</p>
                <p className="text-xl font-bold text-orange-600">€{factoryOrders.reduce((sum, o) => sum + Number(o.total), 0).toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewFactoryOrder(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
              Pedido a Fábrica
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">ID</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Fábrica</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Producto</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Cantidad</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Precio Unit.</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Total</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Entrega Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {factoryOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">{order.id}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{order.factory}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{order.product}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{order.qty} unid.</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300">€{Number(order.unitPrice).toFixed(2)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">€{Number(order.total).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status]?.color || 'bg-gray-50 text-gray-600'} ${statusConfig[order.status]?.darkColor || ''}`}>
                          {statusConfig[order.status]?.label || order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{order.expectedDelivery}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Order Detail Modal */}
      <Modal
        isOpen={showOrderDetail && !!selectedOrder}
        onClose={() => { setShowOrderDetail(false); setSelectedOrder(null); }}
        title={selectedOrder ? `Pedido PED-${String(selectedOrder.id).padStart(6, '0')}` : ''}
        size="2xl"
      >
        {selectedOrder && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500">Cliente</p>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{getClientName(selectedOrder)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500">Teléfono</p>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{selectedOrder.recipient?.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500">Dirección</p>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{selectedOrder.recipient?.address || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500">Fecha</p>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{formatDate(selectedOrder.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500">Estado</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedOrder.status]?.color || 'bg-gray-50 text-gray-600'} ${statusConfig[selectedOrder.status]?.darkColor || ''}`}>
                  {statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500">Método de Pago</p>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-200 capitalize">{selectedOrder.payment_provider}</p>
              </div>
            </div>

            {selectedOrder.customer_notes && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Notas del cliente</p>
                <p className="text-sm text-amber-800 dark:text-amber-300">{selectedOrder.customer_notes}</p>
              </div>
            )}

            <h3 className="font-semibold text-sm text-gray-800 dark:text-slate-100">Productos</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="text-left py-2 text-gray-500 dark:text-slate-400 font-medium">Producto</th>
                  <th className="text-right py-2 text-gray-500 dark:text-slate-400 font-medium">Cant.</th>
                  <th className="text-right py-2 text-gray-500 dark:text-slate-400 font-medium">Precio</th>
                  <th className="text-right py-2 text-gray-500 dark:text-slate-400 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {getItemsForOrder(selectedOrder.id).map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50 dark:border-slate-800">
                    <td className="py-2 text-gray-700 dark:text-slate-300">{item.product_name}</td>
                    <td className="py-2 text-right text-gray-700 dark:text-slate-300">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-700 dark:text-slate-300">€{Number(item.final_price || item.unit_price).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium text-gray-800 dark:text-slate-200">€{Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Subtotal</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">€{Number(selectedOrder.subtotal_items || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Envío</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">€{Number(selectedOrder.shipping_total || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Impuestos</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">€{Number(selectedOrder.tax_total || 0).toFixed(2)}</span>
              </div>
              {selectedOrder.discount_price > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Descuento</span>
                  <span className="font-medium text-green-600">-€{Number(selectedOrder.discount_price).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span className="text-gray-800 dark:text-slate-100">TOTAL</span>
                <span className="text-orange-600">€{totalAmount(selectedOrder).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-truck-line" /></div>
                Actualizar Estado
              </button>
              <button className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-text-line" /></div>
                Generar Factura
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Order Modal */}
      <Modal
        isOpen={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        title="Nuevo Pedido"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Cliente</label>
            <select
              value={newOrderForm.clientId}
              onChange={e => setNewOrderForm(prev => ({ ...prev, clientId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
            >
              <option value="">Seleccionar cliente...</option>
              {clientsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Moneda</label>
              <select
                value={newOrderForm.currency}
                onChange={e => setNewOrderForm(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Método de Pago</label>
              <select
                value={newOrderForm.payment}
                onChange={e => setNewOrderForm(prev => ({ ...prev, payment: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              >
                <option value="manual">Manual</option>
                <option value="stripe">Stripe</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Notas del cliente</label>
            <textarea
              value={newOrderForm.notes}
              onChange={e => setNewOrderForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300 resize-none"
              rows={2}
              maxLength={500}
              placeholder="Instrucciones especiales..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowNewOrder(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={createOrder} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Crear Pedido</button>
          </div>
        </div>
      </Modal>

      {/* New Factory Order Modal */}
      <Modal
        isOpen={showNewFactoryOrder}
        onClose={() => setShowNewFactoryOrder(false)}
        title="Pedido a Fábrica"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Fábrica / Proveedor</label>
            <input type="text" placeholder="Nombre de la fábrica..." value={newFactoryOrder.factory} onChange={e => setNewFactoryOrder({...newFactoryOrder, factory: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Producto</label>
            <input type="text" placeholder="Nombre del producto..." value={newFactoryOrder.product} onChange={e => setNewFactoryOrder({...newFactoryOrder, product: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Cantidad</label>
              <input type="number" placeholder="0" value={newFactoryOrder.qty} onChange={e => setNewFactoryOrder({...newFactoryOrder, qty: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Precio Unit.</label>
              <input type="number" placeholder="0.00" value={newFactoryOrder.unitPrice} onChange={e => setNewFactoryOrder({...newFactoryOrder, unitPrice: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Entrega Est.</label>
              <input type="date" value={newFactoryOrder.expectedDelivery} onChange={e => setNewFactoryOrder({...newFactoryOrder, expectedDelivery: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
            </div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-slate-400">Total estimado: <span className="font-bold text-orange-600">€{(Number(newFactoryOrder.qty || 0) * Number(newFactoryOrder.unitPrice || 0)).toFixed(2)}</span></p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowNewFactoryOrder(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={addFactoryOrder} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Enviar Pedido</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}