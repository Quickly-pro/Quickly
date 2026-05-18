import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import Modal from '@/components/base/Modal';

const statusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600' },
  cobrado: { label: 'Cobrado', color: 'bg-green-50 text-green-600' },
  vencida: { label: 'Vencida', color: 'bg-red-50 text-red-600' },
};

interface InvoiceLine {
  id: number;
  product: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export default function Facturacion() {
  const { user } = useAuth();
  const { isCliente } = useRole();
  const [activeTab, setActiveTab] = useState<'invoices' | 'cobros'>('invoices');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterClient, setFilterClient] = useState<string>('todos');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showNewCobro, setShowNewCobro] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [myClientName, setMyClientName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotificationsContext();

  const [invoiceClient, setInvoiceClient] = useState('');
  const [invoiceClientName, setInvoiceClientName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState('Transferencia');
  const [invoiceVatPercent, setInvoiceVatPercent] = useState(21);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [invoiceFormError, setInvoiceFormError] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [cobroInvoiceId, setCobroInvoiceId] = useState<number | null>(null);
  const [cobroMethod, setCobroMethod] = useState('Efectivo');
  const [sentReminders, setSentReminders] = useState<Set<number>>(new Set());

  const invoiceDetailRef = useRef<HTMLDivElement>(null);
  const pdfModalRef = useRef<HTMLDivElement>(null);
  const emailModalRef = useRef<HTMLDivElement>(null);
  const newInvoiceRef = useRef<HTMLDivElement>(null);
  const newCobroRef = useRef<HTMLDivElement>(null);
  useClickOutside(invoiceDetailRef, () => setShowInvoiceDetail(false), showInvoiceDetail);
  useClickOutside(pdfModalRef, () => setShowPdfModal(false), showPdfModal);
  useClickOutside(emailModalRef, () => setShowEmailModal(false), showEmailModal);
  useClickOutside(newInvoiceRef, () => setShowNewInvoice(false), showNewInvoice);
  useClickOutside(newCobroRef, () => setShowNewCobro(false), showNewCobro);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);

    // If cliente, resolve name for filtering
    let clientName = '';
    if (isCliente && user?.email) {
      const { data: c } = await supabase
        .from('clients')
        .select('name')
        .eq('email', user.email)
        .maybeSingle();
      if (c?.name) clientName = c.name;
      setMyClientName(clientName);
    }

    const query = supabase.from('invoices').select('*').order('id', { ascending: false });
    if (isCliente && clientName) {
      query.eq('client', clientName);
    }

    const [{ data: invData }, { data: itemsData }, { data: clientsData }] = await Promise.all([
      query,
      supabase.from('invoice_items').select('*'),
      supabase.from('clients').select('id, name, address, email, phone').order('name'),
    ]);

    if (invData) setInvoices(invData);
    if (itemsData) setInvoiceItems(itemsData);
    if (clientsData) setClients(clientsData);
    setLoading(false);
  }, [isCliente, user?.email]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    let data = invoices;
    if (filterStatus !== 'todos') {
      data = data.filter(inv => inv.status === filterStatus);
    }
    if (filterClient !== 'todos') {
      data = data.filter(inv => inv.client === filterClient);
    }
    if (filterDateFrom) {
      data = data.filter(inv => inv.date >= filterDateFrom);
    }
    if (filterDateTo) {
      data = data.filter(inv => inv.date <= filterDateTo);
    }
    if (filterMinAmount) {
      data = data.filter(inv => Number(inv.amount) >= Number(filterMinAmount));
    }
    if (filterMaxAmount) {
      data = data.filter(inv => Number(inv.amount) <= Number(filterMaxAmount));
    }
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase();
      data = data.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.client?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [invoices, filterStatus, filterClient, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount, invoiceSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  const getItemsForInvoice = (invoiceId: number) => invoiceItems.filter(i => i.invoice_id === invoiceId);

  const totalPendiente = invoices.filter(i => i.status === 'pendiente').reduce((sum, i) => sum + Number(i.amount), 0);
  const totalCobrado = invoices.filter(i => i.status === 'cobrado').reduce((sum, i) => sum + Number(i.amount), 0);
  const totalVencido = invoices.filter(i => i.status === 'vencida').reduce((sum, i) => sum + Number(i.amount), 0);
  const totalDeuda = totalPendiente + totalVencido;

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), [lines]);
  const discountTotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unitPrice * (l.discount / 100), 0), [lines]);
  const subtotalAfterDiscount = subtotal - discountTotal;
  const taxAmount = subtotalAfterDiscount * (invoiceVatPercent / 100);
  const total = subtotalAfterDiscount + taxAmount;

  const addLine = () => {
    setLines(prev => [...prev, { id: Date.now(), product: '', description: '', qty: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeLine = (id: number) => setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = (id: number, field: keyof InvoiceLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const openNewInvoice = () => {
    setInvoiceClient('');
    setInvoiceClientName('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceDueDate('');
    setInvoicePaymentMethod('Transferencia');
    setInvoiceVatPercent(21);
    setInvoiceNotes('');
    setLines([{ id: Date.now(), product: '', description: '', qty: 1, unitPrice: 0, discount: 0 }]);
    setShowNewInvoice(true);
  };

  const createInvoice = async (sendEmail = false) => {
    setInvoiceFormError('');
    if (!invoiceClient) { setInvoiceFormError('Selecciona un cliente'); return; }
    if (!invoiceDate) { setInvoiceFormError('Indica la fecha de emisión'); return; }
    if (!invoiceDueDate) { setInvoiceFormError('Indica la fecha de vencimiento'); return; }
    if (lines.length === 0 || lines.every(l => !l.product.trim())) { setInvoiceFormError('Añade al menos una línea de producto'); return; }
    setCreatingInvoice(true);
    const invNum = `F-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;
    const invoicePayload = {
      invoice_number: invNum,
      client: invoiceClient,
      date: invoiceDate,
      due_date: invoiceDueDate || invoiceDate,
      amount: total,
      subtotal: subtotal,
      tax: taxAmount,
      status: 'pendiente',
      payment_method: invoicePaymentMethod,
      notes: invoiceNotes || null,
    };
    const { data, error } = await supabase.from('invoices').insert([invoicePayload]).select();
    if (!error && data) {
      const invoiceId = data[0].id;
      const itemsPayload = lines.map(l => ({
        invoice_id: invoiceId,
        product: l.product || 'Producto',
        description: l.description || '',
        qty: l.qty,
        price: l.unitPrice,
        total: l.qty * l.unitPrice * (1 - l.discount / 100),
      }));
      await supabase.from('invoice_items').insert(itemsPayload);

      // Send email if requested
      if (sendEmail) {
        const clientEmail = clients.find(c => c.name === invoiceClient)?.email;
        if (clientEmail) {
          await supabase.functions.invoke('send-invoice-email', {
            body: {
              invoice: { ...invoicePayload, id: invoiceId },
              items: itemsPayload,
              toEmail: clientEmail,
              companyName: 'Quickly',
            },
          });
          addNotification('Factura enviada por email', `Factura ${invNum} enviada a ${clientEmail}`, 'invoice');
        } else {
          addNotification('Factura creada', `${invNum} creada pero el cliente no tiene email registrado`, 'invoice');
        }
      } else {
        addNotification('Nueva factura creada', `Factura ${invNum} para ${invoiceClient} - €${total.toFixed(2)}`, 'invoice');
      }

      setShowNewInvoice(false);
      setInvoiceFormError('');
      setCreatingInvoice(false);
      fetchInvoices();
    } else {
      setCreatingInvoice(false);
      setInvoiceFormError(error?.message || 'Error al crear la factura');
    }
  };

  const registerCobro = async () => {
    if (!cobroInvoiceId) return;
    const invoice = invoices.find(i => i.id === cobroInvoiceId);
    if (!invoice) return;
    const { error } = await supabase.from('invoices').update({ status: 'cobrado' }).eq('id', cobroInvoiceId);
    if (!error) {
      addNotification('Cobro registrado', `Factura ${invoice.invoice_number} de ${invoice.client} cobrada por €${Number(invoice.amount).toFixed(2)} via ${cobroMethod}`, 'invoice');
      setShowNewCobro(false);
      setCobroInvoiceId(null);
      setCobroMethod('Efectivo');
      fetchInvoices();
    }
  };

  const selectedClientData = clients.find(c => c.name === invoiceClient);

  // --- PDF Generation ---
  const generateInvoicePDF = (invoice: any, items: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html><head><title>Factura ${invoice.invoice_number}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#333;max-width:800px;margin:0 auto}h1{font-size:24px;margin-bottom:4px}h2{font-size:16px;color:#666;margin-top:32px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}th,td{padding:10px 8px;border-bottom:1px solid #ddd;text-align:left}th{color:#666;font-weight:600}.right{text-align:right}.total-row{font-weight:bold;font-size:16px;border-top:2px solid #333;border-bottom:none}.header-row{display:flex;justify-content:space-between;margin-bottom:32px}.badge{display:inline-block;padding:4px 12px;border-radius:16px;font-size:12px;font-weight:600;color:#fff;background:#f59e0b}</style>
      </head><body>
      <div class="header-row">
        <div>
          <h1>Factura ${invoice.invoice_number}</h1>
          <p style="color:#666">${invoice.client}</p>
        </div>
        <div class="badge">${statusConfig[invoice.status]?.label || invoice.status}</div>
      </div>
      <div style="display:flex;gap:48px;margin-bottom:32px">
        <div><p style="color:#666;font-size:12px">Fecha emision</p><p>${invoice.date}</p></div>
        <div><p style="color:#666;font-size:12px">Vencimiento</p><p>${invoice.due_date}</p></div>
        <div><p style="color:#666;font-size:12px">Metodo de pago</p><p>${invoice.payment_method || 'Transferencia'}</p></div>
      </div>
      <h2>Lineas de factura</h2>
      <table><thead><tr><th>Producto</th><th>Descripcion</th><th class="right">Cant.</th><th class="right">Precio</th><th class="right">Total</th></tr></thead><tbody>
      ${items.map(item => `
        <tr><td>${item.product}</td><td>${item.description || '-'}</td><td class="right">${item.qty}</td><td class="right">€${Number(item.price).toFixed(2)}</td><td class="right">€${Number(item.total).toFixed(2)}</td></tr>
      `).join('')}
      </tbody></table>
      <div style="margin-top:24px;width:280px;margin-left:auto">
        <div style="display:flex;justify-content:space-between;padding:8px 0"><span>Subtotal</span><span>€${Number(invoice.subtotal).toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0"><span>IVA</span><span>€${Number(invoice.tax).toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:bold;font-size:18px;border-top:2px solid #333"><span>TOTAL</span><span>€${Number(invoice.amount).toFixed(2)}</span></div>
      </div>
      ${invoice.notes ? `<div style="margin-top:32px"><p style="color:#666;font-size:12px">Notas</p><p>${invoice.notes}</p></div>` : ''}
      </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // --- Email Functionality ---
  const sendInvoiceEmail = async (invoice: any, items: any[], toEmail: string) => {
    if (!toEmail) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoice,
          items,
          toEmail,
          companyName: 'Quickly',
        },
      });
      if (error || data?.error) {
        setEmailError(error?.message || data?.error || 'Error al enviar el email');
      } else {
        setEmailSent(true);
        setShowEmailModal(false);
        addNotification('Email enviado', `Factura ${invoice.invoice_number} enviada a ${toEmail}`, 'info');
        setTimeout(() => setEmailSent(false), 4000);
      }
    } catch (err: any) {
      setEmailError(err.message || 'Error inesperado');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Facturacion y Cobros</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{isCliente ? 'Consulta y descarga tus facturas' : 'Gestiona facturas, cobros y deudas'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'invoices' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Facturas</button>
          {!isCliente && (
            <button onClick={() => setActiveTab('cobros')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'cobros' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Cobros</button>
          )}
        </div>
      </div>

      {activeTab === 'invoices' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700"><p className="text-xs text-gray-500 dark:text-slate-400">Total Facturas</p><p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">{invoices.length}{loading && '...'}</p></div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700"><p className="text-xs text-gray-500 dark:text-slate-400">Pendientes</p><p className="text-2xl font-bold text-amber-600 mt-1">{invoices.filter(i => i.status === 'pendiente').length}</p></div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700"><p className="text-xs text-gray-500 dark:text-slate-400">Cobradas</p><p className="text-2xl font-bold text-green-600 mt-1">{invoices.filter(i => i.status === 'cobrado').length}</p></div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700"><p className="text-xs text-gray-500 dark:text-slate-400">Vencidas</p><p className="text-2xl font-bold text-red-600 mt-1">{invoices.filter(i => i.status === 'vencida').length}</p></div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isCliente && (
              <button onClick={openNewInvoice} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
                Nueva Factura
              </button>
            )}
            <div className="flex-1 min-w-[200px] relative">
              <div className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <i className="ri-search-line text-gray-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nº factura o cliente..."
                value={invoiceSearch}
                onChange={e => { setInvoiceSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              />
            </div>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300">
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="cobrado">Cobrado</option>
              <option value="vencida">Vencida</option>
            </select>
            {!isCliente && (
              <select value={filterClient} onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1); }} className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300">
                <option value="todos">Todos los clientes</option>
                {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-2">
              <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }} className="px-2 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
              <span className="text-xs text-gray-400">a</span>
              <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }} className="px-2 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
            </div>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="€ min" value={filterMinAmount} onChange={e => { setFilterMinAmount(e.target.value); setCurrentPage(1); }} className="w-[80px] px-2 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
              <span className="text-xs text-gray-400">-</span>
              <input type="number" placeholder="€ max" value={filterMaxAmount} onChange={e => { setFilterMaxAmount(e.target.value); setCurrentPage(1); }} className="w-[80px] px-2 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300" />
            </div>
            {(filterStatus !== 'todos' || filterClient !== 'todos' || filterDateFrom || filterDateTo || filterMinAmount || filterMaxAmount || invoiceSearch.trim()) && (
              <button
                onClick={() => { setFilterStatus('todos'); setFilterClient('todos'); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinAmount(''); setFilterMaxAmount(''); setInvoiceSearch(''); setCurrentPage(1); }}
                className="px-3 py-2 text-xs text-orange-600 hover:text-orange-700 whitespace-nowrap"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">N Factura</th>
                    {!isCliente && <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Cliente</th>}
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Vencimiento</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Importe</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-100">{invoice.invoice_number}</td>
                      {!isCliente && <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{invoice.client}</td>}
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{invoice.date}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{invoice.due_date}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-100">€{Number(invoice.amount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[invoice.status]?.color || 'bg-gray-50 text-gray-600'}`}>
                          {statusConfig[invoice.status]?.label || invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setSelectedInvoice(invoice); setShowInvoiceDetail(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" title="Ver detalle">
                            <i className="ri-eye-line text-gray-500 dark:text-slate-400" />
                          </button>
                          <button onClick={() => { setSelectedInvoice(invoice); setShowPdfModal(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" title="Descargar PDF">
                            <i className="ri-file-pdf-line text-gray-500 dark:text-slate-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Mostrando {paginatedInvoices.length} de {filteredInvoices.length} facturas
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all
                        ${page === currentPage
                          ? 'bg-orange-500 text-white'
                          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'cobros' && !isCliente && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-3"><div className="w-6 h-6 flex items-center justify-center"><i className="ri-time-line text-amber-600 text-lg" /></div></div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">€{totalPendiente.toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Pendientes de cobro</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3"><div className="w-6 h-6 flex items-center justify-center"><i className="ri-check-line text-green-600 text-lg" /></div></div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">€{totalCobrado.toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Total cobrado</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3"><div className="w-6 h-6 flex items-center justify-center"><i className="ri-alert-line text-red-600 text-lg" /></div></div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">€{totalVencido.toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Vencidas</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-3"><div className="w-6 h-6 flex items-center justify-center"><i className="ri-money-euro-circle-line text-orange-600 text-lg" /></div></div>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">€{totalDeuda.toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Deuda total</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-800 dark:text-slate-100">Pendientes</h3><span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">{invoices.filter(i => i.status === 'pendiente').length}</span></div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {invoices.filter(i => i.status === 'pendiente').map((inv) => (
                  <div key={inv.id} className="border border-gray-100 dark:border-slate-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => { setSelectedInvoice(inv); setShowInvoiceDetail(true); }}>
                    <div className="flex items-center justify-between"><span className="font-medium text-sm text-gray-800 dark:text-slate-100">{inv.client}</span><span className="text-sm font-semibold text-amber-600">€{Number(inv.amount).toFixed(2)}</span></div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{inv.invoice_number} . Vence: {inv.due_date}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-800 dark:text-slate-100">Cobradas</h3><span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">{invoices.filter(i => i.status === 'cobrado').length}</span></div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {invoices.filter(i => i.status === 'cobrado').map((inv) => (
                  <div key={inv.id} className="border border-gray-100 dark:border-slate-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => { setSelectedInvoice(inv); setShowInvoiceDetail(true); }}>
                    <div className="flex items-center justify-between"><span className="font-medium text-sm text-gray-800 dark:text-slate-100">{inv.client}</span><span className="text-sm font-semibold text-green-600">€{Number(inv.amount).toFixed(2)}</span></div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{inv.invoice_number} . {inv.date}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-800 dark:text-slate-100">Vencidas / Deudores</h3><span className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">{invoices.filter(i => i.status === 'vencida').length}</span></div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {invoices.filter(i => i.status === 'vencida').map((inv) => (
                  <div key={inv.id} className="border border-red-100 dark:border-red-900/30 rounded-lg p-3 bg-red-50/20 dark:bg-red-900/10 hover:bg-red-50/40 dark:hover:bg-red-900/20 cursor-pointer" onClick={() => { setSelectedInvoice(inv); setShowInvoiceDetail(true); }}>
                    <div className="flex items-center justify-between"><span className="font-medium text-sm text-gray-800 dark:text-slate-100">{inv.client}</span><span className="text-sm font-semibold text-red-600">€{Number(inv.amount).toFixed(2)}</span></div>
                    <p className="text-xs text-red-400 dark:text-red-400/70 mt-1">{inv.invoice_number} . Vencio: {inv.due_date}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sentReminders.has(inv.id)) return;
                        setSentReminders(prev => new Set(prev).add(inv.id));
                        addNotification('Recordatorio enviado', `Recordatorio de pago enviado para factura ${inv.invoice_number} (${inv.client} — €${Number(inv.amount).toFixed(2)})`, 'invoice');
                      }}
                      className={`mt-2 text-xs hover:underline ${sentReminders.has(inv.id) ? 'text-green-600 cursor-default' : 'text-orange-600'}`}
                    >
                      {sentReminders.has(inv.id) ? '✓ Recordatorio enviado' : 'Enviar recordatorio'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={() => setShowNewCobro(true)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap">
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
            Registrar Cobro
          </button>
        </>
      )}

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={showInvoiceDetail && !!selectedInvoice}
        onClose={() => { setShowInvoiceDetail(false); setSelectedInvoice(null); }}
        title={`Factura ${selectedInvoice?.invoice_number || ''}`}
        size="2xl"
      >
        {selectedInvoice && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {!isCliente && <div><p className="text-xs text-gray-400 dark:text-slate-500">Cliente</p><p className="text-sm font-medium text-gray-800 dark:text-slate-100">{selectedInvoice.client}</p></div>}
              <div><p className="text-xs text-gray-400 dark:text-slate-500">Fecha</p><p className="text-sm font-medium text-gray-800 dark:text-slate-100">{selectedInvoice.date}</p></div>
              <div><p className="text-xs text-gray-400 dark:text-slate-500">Vencimiento</p><p className="text-sm font-medium text-gray-800 dark:text-slate-100">{selectedInvoice.due_date}</p></div>
              <div><p className="text-xs text-gray-400 dark:text-slate-500">Estado</p><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedInvoice.status]?.color || 'bg-gray-50 text-gray-600'}`}>{statusConfig[selectedInvoice.status]?.label || selectedInvoice.status}</span></div>
            </div>

            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700"><th className="text-left py-2 text-gray-500 dark:text-slate-400 font-medium">Producto</th><th className="text-right py-2 text-gray-500 dark:text-slate-400 font-medium">Cant.</th><th className="text-right py-2 text-gray-500 dark:text-slate-400 font-medium">Precio</th><th className="text-right py-2 text-gray-500 dark:text-slate-400 font-medium">Total</th></tr>
              </thead>
              <tbody>
                {getItemsForInvoice(selectedInvoice.id).map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-50 dark:border-slate-800"><td className="py-2 text-gray-700 dark:text-slate-300">{item.product}</td><td className="py-2 text-right text-gray-700 dark:text-slate-300">{item.qty}</td><td className="py-2 text-right text-gray-700 dark:text-slate-300">€{Number(item.price).toFixed(2)}</td><td className="py-2 text-right font-medium text-gray-800 dark:text-slate-100">€{Number(item.total).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Subtotal</span><span className="font-medium text-gray-800 dark:text-slate-100">€{Number(selectedInvoice.subtotal).toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">IVA (21%)</span><span className="font-medium text-gray-800 dark:text-slate-100">€{Number(selectedInvoice.tax).toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold"><span className="text-gray-800 dark:text-slate-100">TOTAL</span><span className="text-orange-600">€{Number(selectedInvoice.amount).toFixed(2)}</span></div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => generateInvoicePDF(selectedInvoice, getItemsForInvoice(selectedInvoice.id))} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-pdf-line" /></div>
                Descargar PDF
              </button>
              {!isCliente && (
                <button onClick={() => { setEmailAddress(''); setEmailSent(false); setShowEmailModal(true); }} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-send-line" /></div>
                  Enviar por Email
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* PDF Download Modal */}
      <Modal
        isOpen={showPdfModal && !!selectedInvoice}
        onClose={() => setShowPdfModal(false)}
        title="Descargar Factura PDF"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
            <i className="ri-file-pdf-line text-orange-600 text-2xl" />
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">Se abrira una ventana con la factura formateada para imprimir o guardar como PDF.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowPdfModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={() => { generateInvoicePDF(selectedInvoice!, getItemsForInvoice(selectedInvoice!.id)); setShowPdfModal(false); }} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Descargar PDF</button>
          </div>
        </div>
      </Modal>

      {/* Email Modal */}
      <Modal
        isOpen={showEmailModal && !!selectedInvoice}
        onClose={() => setShowEmailModal(false)}
        title="Enviar por Email"
        size="sm"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            {emailSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-check-line text-green-600 text-2xl" />
                </div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-slate-100 mb-1">¡Email enviado!</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">La factura {selectedInvoice.invoice_number} fue enviada correctamente.</p>
                <button onClick={() => { setShowEmailModal(false); setEmailSent(false); }} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Cerrar</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-slate-400">El cliente recibirá un email con el resumen de la factura.</p>
                <div>
                  <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Email del destinatario</label>
                  <input
                    type="email"
                    value={emailAddress || clients.find(c => c.name === selectedInvoice.client)?.email || ''}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="cliente@empresa.com"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                {emailError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                    <i className="ri-error-warning-line text-red-500 text-sm flex-shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">{emailError}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setShowEmailModal(false); setEmailError(null); }} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
                  <button
                    onClick={() => {
                      const to = emailAddress || clients.find(c => c.name === selectedInvoice.client)?.email || '';
                      sendInvoiceEmail(selectedInvoice, getItemsForInvoice(selectedInvoice.id), to);
                    }}
                    disabled={emailSending || (!emailAddress && !clients.find(c => c.name === selectedInvoice.client)?.email)}
                    className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {emailSending ? (
                      <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
                    ) : (
                      <><i className="ri-send-plane-line" />Enviar Email</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* NEW INVOICE MODAL - hidden for cliente */}
      {!isCliente && (
        <Modal
          isOpen={showNewInvoice}
          onClose={() => setShowNewInvoice(false)}
          title="Nueva Factura"
          size="2xl"
          className="max-w-3xl"
        >
          <div className="space-y-6">
            {/* Client Data Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-user-line text-orange-400" /></div>
                <h3 className="text-sm font-semibold text-slate-200">Datos del cliente</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Cliente</label>
                  <select value={invoiceClient} onChange={(e) => { const val = e.target.value; setInvoiceClient(val); const c = clients.find(cl => cl.name === val); setInvoiceClientName(val); if (c) setInvoiceClientName(c.name); }} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none focus:border-orange-400 appearance-none">
                    <option value="">Seleccionar cliente</option>
                    {clients.map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Nombre del cliente *</label>
                  <input type="text" value={invoiceClientName} onChange={(e) => setInvoiceClientName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div><label className="text-xs text-slate-400 block mb-1.5">Direccion</label><input type="text" defaultValue={selectedClientData?.address || ''} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
                <div><label className="text-xs text-slate-400 block mb-1.5">Email</label><input type="email" defaultValue={selectedClientData?.email || ''} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
                <div><label className="text-xs text-slate-400 block mb-1.5">Telefono</label><input type="tel" defaultValue={selectedClientData?.phone || ''} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
              </div>
            </div>

            {/* Issuer Data Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-building-line text-orange-400" /></div>
                <h3 className="text-sm font-semibold text-slate-200">Datos del emisor</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1.5">Empresa</label><input type="text" placeholder="Tu empresa..." className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
                <div><label className="text-xs text-slate-400 block mb-1.5">NIF / CIF</label><input type="text" placeholder="B-12345678" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
                <div><label className="text-xs text-slate-400 block mb-1.5">Telefono empresa</label><input type="tel" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
              </div>
              <div className="mt-3"><label className="text-xs text-slate-400 block mb-1.5">Direccion empresa</label><input type="text" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
            </div>

            {/* Dates & Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Fecha emision *</label>
                <div className="relative">
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none pr-10" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none"><i className="ri-calendar-line text-slate-500 text-sm" /></div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Fecha vencimiento *</label>
                <div className="relative">
                  <input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none pr-10" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none"><i className="ri-calendar-line text-slate-500 text-sm" /></div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Metodo de pago</label>
                <select value={invoicePaymentMethod} onChange={(e) => setInvoicePaymentMethod(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none appearance-none">
                  <option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option><option>Domiciliado</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">IVA %</label>
                <select value={invoiceVatPercent} onChange={(e) => setInvoiceVatPercent(Number(e.target.value))} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none appearance-none">
                  <option value={21}>21% (general)</option><option value={10}>10% (reducido)</option><option value={4}>4% (superreducido)</option><option value={0}>0% (exento)</option>
                </select>
              </div>
            </div>

            {/* Invoice Lines */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-200">Lineas de factura</h3>
                <button onClick={addLine} className="px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"><div className="w-3 h-3 flex items-center justify-center"><i className="ri-add-line" /></div>Anadir linea</button>
              </div>
              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3"><input type="text" placeholder="Producto" value={line.product} onChange={(e) => updateLine(line.id, 'product', e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none placeholder-slate-500" /></div>
                    <div className="col-span-3"><input type="text" placeholder="Descripcion" value={line.description} onChange={(e) => updateLine(line.id, 'description', e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none placeholder-slate-500" /></div>
                    <div className="col-span-1"><input type="number" min={1} value={line.qty} onChange={(e) => updateLine(line.id, 'qty', Number(e.target.value))} className="w-full px-2 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none text-center" /></div>
                    <div className="col-span-1"><input type="number" placeholder="0" value={line.unitPrice} onChange={(e) => updateLine(line.id, 'unitPrice', Number(e.target.value))} className="w-full px-2 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
                    <div className="col-span-1"><input type="number" placeholder="0" value={line.discount} onChange={(e) => updateLine(line.id, 'discount', Number(e.target.value))} className="w-full px-2 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none" /></div>
                    <div className="col-span-2 text-right"><span className="text-sm text-slate-300 font-medium">€{((line.qty * line.unitPrice) * (1 - line.discount / 100)).toFixed(2)}</span></div>
                    <div className="col-span-1 flex justify-end"><button onClick={() => removeLine(line.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-500 hover:text-red-400"><i className="ri-delete-bin-line" /></button></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-slate-700">
                <span className="text-sm text-slate-400">Subtotal: <span className="text-slate-200 font-medium">€{subtotalAfterDiscount.toFixed(2)}</span></span>
                <span className="text-sm text-slate-400">IVA ({invoiceVatPercent}%): <span className="text-slate-200 font-medium">€{taxAmount.toFixed(2)}</span></span>
                <span className="text-base font-bold text-white">Total: €{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Notas</label>
              <textarea value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} placeholder="Notas adicionales..." rows={2} maxLength={500} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 outline-none resize-none" />
            </div>

            {invoiceFormError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-error-warning-line text-red-500 text-sm" />
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">{invoiceFormError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button onClick={() => { setShowNewInvoice(false); setInvoiceFormError(''); }} disabled={creatingInvoice} className="px-5 py-2.5 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">Cancelar</button>
              <button onClick={() => createInvoice(true)} disabled={creatingInvoice} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                {creatingInvoice ? (
                  <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
                ) : (
                  <><i className="ri-mail-send-line" />Crear y Enviar Email</>
                )}
              </button>
              <button onClick={() => createInvoice(false)} disabled={creatingInvoice} className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                {creatingInvoice ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Factura'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Cobro Modal - hidden for cliente */}
      {!isCliente && (
        <Modal
          isOpen={showNewCobro}
          onClose={() => setShowNewCobro(false)}
          title="Registrar Cobro"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Factura</label>
              <select value={cobroInvoiceId || ''} onChange={(e) => setCobroInvoiceId(Number(e.target.value) || null)} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
                <option value="">Seleccionar factura pendiente...</option>
                {invoices.filter(i => i.status === 'pendiente').map(inv => (<option key={inv.id} value={inv.id}>{inv.invoice_number} - {inv.client} (€{Number(inv.amount).toFixed(2)})</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Metodo de pago</label>
              <select value={cobroMethod} onChange={(e) => setCobroMethod(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
                <option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Domiciliado</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => setShowNewCobro(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
              <button onClick={registerCobro} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Registrar Cobro</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
