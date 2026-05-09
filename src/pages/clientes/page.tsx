import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useChatMessages } from '@/hooks/useChatMessages';
import Modal from '@/components/base/Modal';

const clientStatuses = [
  { value: 'activo', label: 'Activo', color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'ausente', label: 'Ausente', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  { value: 'vacaciones', label: 'Vacaciones', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  { value: 'paro_temporal', label: 'Paro Temporal', color: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
  { value: 'no_servicio', label: 'No Servicio', color: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
];

const timeFilters = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '6m', value: '6m' },
  { label: '1a', value: '1a' },
];

export default function Clientes() {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [showClientDetail, setShowClientDetail] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [activeTab, setActiveTab] = useState<'estadisticas' | 'rendimiento'>('estadisticas');
  const [timeFilter, setTimeFilter] = useState('1a');
  const [newClient, setNewClient] = useState({
    name: '', contact: '', phone: '', email: '', address: '', status: 'activo', notes: ''
  });

  // Photo upload state for new client
  const [clientPhoto, setClientPhoto] = useState<string | null>(null);
  const [clientPhotoName, setClientPhotoName] = useState('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (!error && data) setClients(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPhoto(file);
  };

  const processPhoto = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }
    setClientPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setClientPhoto(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processPhoto(file);
  };

  const clearPhoto = () => {
    setClientPhoto(null);
    setClientPhotoName('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const addClient = async () => {
    if (!newClient.name) return;
    const avatarUrl = clientPhoto || 'https://readdy.ai/api/search-image?query=modern%20business%20storefront%20professional%20signage%20clean%20urban%20background%20minimalist&width=200&height=200&seq=99&orientation=squarish';
    const { error } = await supabase.from('clients').insert([{
      ...newClient,
      avatar: avatarUrl,
      total_spent: 0,
    }]);
    if (!error) {
      setShowNewClient(false);
      setNewClient({ name: '', contact: '', phone: '', email: '', address: '', status: 'activo', notes: '' });
      clearPhoto();
      fetchClients();
    }
  };

  const deleteClient = async (id: number) => {
    await supabase.from('clients').delete().eq('id', id);
    fetchClients();
    setShowClientDetail(false);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const filteredClients = clients.filter((c) => {
    const matchesStatus = filterStatus === 'todos' ? true : c.status === filterStatus;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      c.name?.toLowerCase().includes(query) ||
      c.contact?.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.address?.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats for top bar
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'activo').length;
  const totalRevenue = clients.reduce((s, c) => s + Number(c.total_spent || 0), 0);

  // Download CSV template
  const downloadTemplate = () => {
    const headers = ['name', 'contact', 'phone', 'email', 'address', 'status', 'notes'];
    const example = ['Restaurante La Plaza', 'Juan Pérez', '+34600112233', 'juan@ejemplo.com', 'Calle Mayor 10, Madrid', 'activo', 'Cliente habitual'];
    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_clientes.csv';
    link.click();
  };

  // Import CSV
  const importInputRef = useRef<HTMLInputElement>(null);
  const handleImportCSV = () => importInputRef.current?.click();

  const processCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = values[i]?.trim() || ''; });
        return obj;
      }).filter(r => r.name);

      if (rows.length > 0) {
        const data = rows.map(r => ({
          name: r.name,
          contact: r.contact || '',
          phone: r.phone || '',
          email: r.email || '',
          address: r.address || '',
          status: r.status || 'activo',
          notes: r.notes || '',
          avatar: 'https://readdy.ai/api/search-image?query=modern%20business%20storefront%20professional%20signage%20clean%20urban%20background%20minimalist&width=200&height=200&seq=99&orientation=squarish',
          total_spent: 0,
        }));
        await supabase.from('clients').insert(data);
        fetchClients();
      }
    };
    reader.readAsText(file);
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCSV(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  // Chat with selected client
  const chatTargetId = selectedClient ? `client_${selectedClient.id}` : null;
  const { messages: chatMessages, sendMessage: sendClientMessage } = useChatMessages('client', chatTargetId);
  const [chatInput, setChatInput] = useState('');

  const sendClientChat = () => {
    if (!chatInput.trim() || !chatTargetId) return;
    sendClientMessage(chatInput.trim(), user?.full_name || 'Tú');
    setChatInput('');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Top stats bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Gestión de Clientes</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{filteredClients.length} clientes registrados{loading && ' (cargando...)'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowNewClient(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-add-line" />
            </div>
            Añadir Cliente
          </button>
          <button
            onClick={downloadTemplate}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-download-line" />
            </div>
            Plantilla CSV
          </button>
          <button
            onClick={handleImportCSV}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-upload-line" />
            </div>
            Importar CSV
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Tab bar + time filters + PDF */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-2">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('estadisticas')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap
              ${activeTab === 'estadisticas'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-bar-chart-box-line" />
            </div>
            Estadísticas
          </button>
          <button
            onClick={() => setActiveTab('rendimiento')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap
              ${activeTab === 'rendimiento'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-dashboard-line" />
            </div>
            Rendimiento
          </button>
        </div>

        <div className="flex items-center gap-2">
          {timeFilters.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeFilter(tf.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
                ${timeFilter === tf.value
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
            >
              {tf.label}
            </button>
          ))}
          <button
            onClick={handleExportPDF}
            className="ml-1 px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-file-pdf-line" />
            </div>
            PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {activeTab === 'estadisticas' ? (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">{totalClients}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Activos</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{activeClients}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Inactivos</p>
              <p className="text-2xl font-bold text-gray-500 dark:text-slate-400 mt-1">{totalClients - activeClients}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Facturación Total</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">€{totalRevenue.toLocaleString()}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Ticket Medio</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 mt-1">€{(totalClients > 0 ? totalRevenue / totalClients : 0).toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Retención</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{(totalClients > 0 ? (activeClients / totalClients) * 100 : 0).toFixed(0)}%</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Nuevos {timeFilter}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{Math.max(1, Math.floor(totalClients * 0.15))}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">Pedidos / Cliente</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{(totalClients > 0 ? (totalClients * 2.3 / totalClients).toFixed(1) : '0.0')}</p>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
            <i className="ri-search-line text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, contacto, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
              ${filterStatus === 'todos' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'}`}
          >
            Todos
          </button>
          {clientStatuses.map((status) => (
            <button
              key={status.value}
              onClick={() => setFilterStatus(status.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
                ${filterStatus === status.value ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'}`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginatedClients.map((client) => {
          const statusConfig = clientStatuses.find(s => s.value === client.status) || clientStatuses[0];
          return (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 hover:shadow-md transition-all cursor-pointer"
              onClick={() => { setSelectedClient(client); setShowClientDetail(true); }}
            >
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {client.avatar ? (
                    <img
                      src={client.avatar}
                      alt={client.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">
                      {client.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-slate-100 truncate">{client.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{client.contact}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400 dark:text-slate-500">Último pedido</p>
                  <p className="text-gray-700 dark:text-slate-300 font-medium">{client.last_order || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-slate-500">Total gastado</p>
                  <p className="text-orange-600 dark:text-orange-400 font-medium">€{(client.total_spent ?? 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-800 flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setShowChat(true); }}
                  className="flex-1 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-md text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 flex items-center justify-center gap-1"
                >
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-chat-1-line" />
                  </div>
                  Chat
                </button>
                <a
                  href={`tel:${client.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-md text-xs font-medium hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1"
                >
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-phone-line" />
                  </div>
                  Llamar
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Mostrando <span className="font-medium text-gray-700 dark:text-slate-200">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredClients.length)}</span> – <span className="font-medium text-gray-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredClients.length)}</span> de <span className="font-medium text-gray-700 dark:text-slate-200">{filteredClients.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-arrow-left-s-line" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all
                  ${currentPage === page ? 'bg-orange-500 text-white' : 'border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      <Modal
        isOpen={showClientDetail && !!selectedClient}
        onClose={() => { setShowClientDetail(false); setSelectedClient(null); }}
        title={selectedClient?.name || ''}
        size="lg"
      >
        {selectedClient && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-20 h-20 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {selectedClient.avatar ? (
                  <img src={selectedClient.avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="text-orange-600 dark:text-orange-400 font-bold text-2xl">
                    {selectedClient.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Contacto: {selectedClient.contact}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{selectedClient.phone}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">{selectedClient.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"><span className="text-sm text-gray-600 dark:text-slate-400">Dirección</span><span className="text-sm text-gray-800 dark:text-slate-200">{selectedClient.address}</span></div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"><span className="text-sm text-gray-600 dark:text-slate-400">Estado</span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${clientStatuses.find(s => s.value === selectedClient.status)?.color}`}>{clientStatuses.find(s => s.value === selectedClient.status)?.label}</span></div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"><span className="text-sm text-gray-600 dark:text-slate-400">Total gastado</span><span className="text-sm font-bold text-orange-600 dark:text-orange-400">€{(selectedClient.total_spent ?? 0).toLocaleString()}</span></div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"><span className="text-sm text-gray-600 dark:text-slate-400">Último pedido</span><span className="text-sm text-gray-800 dark:text-slate-200">{selectedClient.last_order || '-'}</span></div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Notas</p>
              <p className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 rounded-lg p-3">{selectedClient.notes || 'Sin notas'}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setShowClientDetail(false); setShowChat(true); }}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-chat-1-line" />
                </div>
                Abrir Chat
              </button>
              <a href={`tel:${selectedClient.phone}`} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2 whitespace-nowrap">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-phone-line" />
                </div>
                Llamar
              </a>
              <button
                onClick={() => { if (selectedClient) deleteClient(selectedClient.id); }}
                className="px-3 py-2.5 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-delete-bin-line" />
                </div>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Chat Modal with Supabase real-time */}
      <Modal
        isOpen={showChat && !!selectedClient}
        onClose={() => { setShowChat(false); setSelectedClient(null); }}
        title={selectedClient?.name || ''}
        size="md"
        className="h-[80vh]"
      >
        {selectedClient && (
          <div className="flex flex-col h-[calc(80vh-100px)]">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-700 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {selectedClient.avatar ? (
                  <img src={selectedClient.avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="text-orange-600 dark:text-orange-400 font-bold text-base">
                    {selectedClient.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-800 dark:text-slate-100">{selectedClient.name}</h3>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" /> En línea
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                  <i className="ri-chat-1-line text-3xl mb-2" />
                  <p className="text-sm">Sin mensajes. ¡Empieza la conversación!</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_name === (user?.full_name || 'Tú') ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm
                    ${msg.sender_name === (user?.full_name || 'Tú')
                      ? 'bg-orange-500 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-md'
                    }`}>
                    <p className="text-[10px] opacity-80 mb-0.5">{msg.sender_name}</p>
                    <p>{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender_name === (user?.full_name || 'Tú') ? 'text-orange-100' : 'text-gray-400 dark:text-slate-500'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendClientChat()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-full text-sm outline-none focus:bg-gray-100 dark:focus:bg-slate-700 text-gray-800 dark:text-slate-200"
                />
                <button onClick={sendClientChat} className="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-full hover:bg-orange-600">
                  <i className="ri-send-plane-fill" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* New Client Modal with photo upload */}
      <Modal
        isOpen={showNewClient}
        onClose={() => setShowNewClient(false)}
        title="Añadir Cliente"
        size="lg"
      >
        <div className="space-y-4">
          {/* Photo Upload */}
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Foto del negocio</label>
            {clientPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                <img src={clientPhoto} alt="Preview" className="w-full h-40 object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{clientPhotoName}</span>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80"
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => photoInputRef.current?.click()}
                onDrop={handlePhotoDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingPhoto(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingPhoto(false); }}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                  ${isDraggingPhoto ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500'}`}
              >
                <div className="w-10 h-10 mx-auto flex items-center justify-center mb-2">
                  <i className="ri-camera-line text-gray-400 dark:text-slate-500 text-2xl" />
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra una foto o haz clic para seleccionar</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">JPG, PNG hasta 5MB</p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Nombre del negocio</label>
            <input type="text" placeholder="Ej: Restaurante..." value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Contacto</label>
            <input type="text" placeholder="Nombre del contacto..." value={newClient.contact} onChange={e => setNewClient({...newClient, contact: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Teléfono</label>
              <input type="tel" placeholder="+34..." value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Email</label>
              <input type="email" placeholder="email@..." value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Dirección</label>
            <input type="text" placeholder="Calle, número, ciudad..." value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Estado</label>
            <select value={newClient.status} onChange={e => setNewClient({...newClient, status: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300">
              {clientStatuses.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Notas</label>
            <textarea placeholder="Notas adicionales..." value={newClient.notes} onChange={e => setNewClient({...newClient, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-sm outline-none focus:border-orange-300 resize-none" rows={2} maxLength={500} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowNewClient(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button onClick={addClient} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              Guardar Cliente
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}