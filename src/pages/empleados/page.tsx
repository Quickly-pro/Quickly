import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import ChatModal from './components/ChatModal';
import VideoCallModal from './components/VideoCallModal';
import Modal from '@/components/base/Modal';
import ImageWithFallback from '@/components/base/ImageWithFallback';

interface TimeEntry {
  id: number;
  employee: string;
  date: string;
  check_in: string;
  check_out: string | null;
  total_hours: number | null;
  created_at: string;
}

interface Employee {
  id: number;
  name: string;
  role: string;
  department?: string;
  phone: string;
  email: string;
  photo: string;
  joined: string;
  hours_this_month: number;
  routes_completed: number;
  supervisor_id?: number | null;
}

export default function Empleados() {
  const [activeTab, setActiveTab] = useState<'list' | 'time' | 'org'>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [showNewCheckIn, setShowNewCheckIn] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showChatFor, setShowChatFor] = useState<string | null>(null);
  const [showVideoFor, setShowVideoFor] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeRecords, setTimeRecords] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '', role: 'Repartidor', phone: '', email: '', supervisor_id: null as number | null
  });
  const [editPhotoFor, setEditPhotoFor] = useState<Employee | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'routes' | 'hours'>('name');

  const roles = useMemo(() => [...new Set(employees.map(e => e.role))].sort(), [employees]);
  const departments = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean as any))].sort(), [employees]);

  const filteredSortedEmployees = useMemo(() => {
    let list = employees.filter(emp => {
      const q = filterSearch.toLowerCase();
      const matchesSearch = !q || emp.name.toLowerCase().includes(q) || emp.email.toLowerCase().includes(q) || emp.phone.includes(q) || emp.role.toLowerCase().includes(q);
      const matchesRole = !filterRole || emp.role === filterRole;
      const matchesDept = !filterDepartment || emp.department === filterDepartment;
      return matchesSearch && matchesRole && matchesDept;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'role') return a.role.localeCompare(b.role);
      if (sortBy === 'routes') return b.routes_completed - a.routes_completed;
      if (sortBy === 'hours') return b.hours_this_month - a.hours_this_month;
      return 0;
    });
    return list;
  }, [employees, filterSearch, filterRole, filterDepartment, sortBy]);

  const [checkInForm, setCheckInForm] = useState({
    employee: '',
    employeeInput: '',
    date: '',
    check_in: '',
    check_out: ''
  });
  const [useDropdown, setUseDropdown] = useState(true);
  const [pdfFilterEmployee, setPdfFilterEmployee] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: empData }, { data: timeData }] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('time_tracking').select('*').order('date', { ascending: false }),
    ]);
    if (empData) setEmployees(empData as Employee[]);
    if (timeData) setTimeRecords(timeData as TimeEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addEmployee = async () => {
    if (!newEmployee.name) return;
    const { error } = await supabase.from('employees').insert([{
      ...newEmployee,
      photo: 'https://readdy.ai/api/search-image?query=professional%20corporate%20employee%20headshot%20portrait%20neutral%20background%20warm%20lighting&width=200&height=200&seq=98&orientation=squarish',
      joined: today,
      hours_this_month: 0,
      routes_completed: 0,
    }]);
    if (!error) {
      setShowNewEmployee(false);
      setNewEmployee({ name: '', role: 'Repartidor', phone: '', email: '', supervisor_id: null });
      fetchData();
    }
  };

  const handleCreateCheckIn = async () => {
    const empName = useDropdown ? checkInForm.employee : checkInForm.employeeInput;
    if (!empName || !checkInForm.date || !checkInForm.check_in) return;
    setSubmitting(true);
    const checkInDate = new Date(`${checkInForm.date}T${checkInForm.check_in}`);
    const total = checkInForm.check_out
      ? (new Date(`${checkInForm.date}T${checkInForm.check_out}`).getTime() - checkInDate.getTime()) / 3600000
      : null;

    await supabase.from('time_tracking').insert({
      employee: empName,
      date: checkInForm.date,
      check_in: checkInForm.check_in,
      check_out: checkInForm.check_out || null,
      total_hours: total,
    });
    setSubmitting(false);
    setShowNewCheckIn(false);
    setCheckInForm({ employee: '', employeeInput: '', date: '', check_in: '', check_out: '' });
    fetchData();
  };

  const handleCheckOutNow = async (employeeName: string) => {
    const record = timeRecords.find(
      r => r.employee === employeeName && r.date === today && r.check_in && !r.check_out
    );
    if (!record) return;
    const checkInDate = new Date(`${record.date}T${record.check_in}`);
    const checkOutDate = new Date();
    const total = (checkOutDate.getTime() - checkInDate.getTime()) / 3600000;
    await supabase
      .from('time_tracking')
      .update({ check_out: nowTime, total_hours: total })
      .eq('id', record.id);
    fetchData();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) setPhotoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const updateEmployeePhoto = async () => {
    if (!editPhotoFor || !photoPreview) return;
    setUploadingPhoto(true);
    await supabase.from('employees').update({ photo: photoPreview }).eq('id', editPhotoFor.id);
    setUploadingPhoto(false);
    setEditPhotoFor(null);
    setPhotoPreview('');
    setPhotoFile(null);
    fetchData();
  };

  const todayRecords = timeRecords.filter(r => r.date === today);
  const activeNow = employees.filter(emp => {
    return todayRecords.some(r => r.employee === emp.name && r.check_in && !r.check_out);
  });

  const pdfRecords = useMemo(() => {
    if (!pdfFilterEmployee) return timeRecords;
    return timeRecords.filter(r => r.employee.toLowerCase().includes(pdfFilterEmployee.toLowerCase()));
  }, [pdfFilterEmployee, timeRecords]);

  const handlePrintPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html><head><title>Historial Fichajes</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#333}h2{text-align:center;margin-bottom:4px}p.date{text-align:center;color:#666;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:left}th{color:#666;font-weight:600}.green{color:#059669}.red{color:#dc2626}.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px}.badge-green{background:#dcfce7;color:#166534}.badge-gray{background:#f3f4f6;color:#4b5563}</style>
      </head><body>
      <h2>Historial de Fichajes${pdfFilterEmployee ? ` - ${pdfFilterEmployee}` : ''}</h2>
      <p class="date">${today}</p>
      <table><thead><tr><th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Estado</th></tr></thead><tbody>
      ${pdfRecords.map(r => `
        <tr>
          <td>${r.employee}</td>
          <td>${r.date}</td>
          <td class="green">${r.check_in}</td>
          <td class="red">${r.check_out || '-'}</td>
          <td>${r.total_hours !== null ? r.total_hours.toFixed(1) + 'h' : '-'}</td>
          <td>${!r.check_out ? '<span class="badge badge-green">Trabajando</span>' : '<span class="badge badge-gray">Completado</span>'}</td>
        </tr>
      `).join('')}
      </tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // --- ORGANIGRAMA LOGIC ---
  const orgByRole = useMemo(() => {
    const byRole: Record<string, Employee[]> = {};
    filteredSortedEmployees.forEach(emp => {
      if (!byRole[emp.role]) byRole[emp.role] = [];
      byRole[emp.role].push(emp);
    });
    return byRole;
  }, [filteredSortedEmployees]);

  const roleOrder = ['Administracion', 'Comercial', 'Almacen', 'Repartidor'];
  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    Administracion: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    Comercial: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    Almacen: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Repartidor: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  };

  const renderOrgNode = (emp: Employee) => {
    const supervisor = employees.find(e => e.id === emp.supervisor_id);
    return (
      <div
        key={emp.id}
        className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3 hover:shadow-md transition-all cursor-pointer min-w-[180px]"
        onClick={() => { setSelectedEmployee(emp); setShowEmployeeDetail(true); }}
      >
        <div className="flex items-center gap-2 mb-2">
          <ImageWithFallback
            src={emp.photo}
            alt={emp.name}
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
            fallbackClassName="w-9 h-9 rounded-lg flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-100 truncate">{emp.name}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">{emp.role}</p>
          </div>
        </div>
        {supervisor && (
          <div className="flex items-center gap-1 mt-1 pt-1.5 border-t border-gray-50 dark:border-slate-800">
            <i className="ri-arrow-up-line text-[10px] text-gray-400" />
            <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
              Reporta a: {supervisor.name}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 dark:text-slate-500">
          <span><i className="ri-route-line mr-0.5" />{emp.routes_completed}</span>
          <span><i className="ri-time-line mr-0.5" />{emp.hours_this_month}h</span>
        </div>
      </div>
    );
  };

  // --- COMMON TABS ---
  const TabBar = () => (
    <div className="flex gap-2 flex-wrap">
      <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'list' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>Empleados</button>
      <button onClick={() => setActiveTab('org')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'org' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>Organigrama</button>
      <button onClick={() => setActiveTab('time')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'time' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>Control Horario</button>
    </div>
  );

  // ==========================
  // LIST TAB
  // ==========================
  if (activeTab === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Empleados</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gestion de empleados</p>
          </div>
          <TabBar />
        </div>

        <div className="flex items-center justify-between">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Total Empleados</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{employees.length}{loading && '...'}</p>
          </div>
          <button onClick={() => setShowNewEmployee(true)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap">
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
            Anadir Empleado
          </button>
        </div>

        {/* Filters bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="w-4 h-4 flex items-center justify-center text-gray-400"><i className="ri-search-line" /></div>
              <input
                type="text"
                placeholder="Buscar por nombre, email, telefono..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="flex-1 text-sm text-gray-700 dark:text-slate-200 outline-none bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-300 outline-none"
              >
                <option value="">Todos los roles</option>
                {roles.map(r => (<option key={r} value={r}>{r}</option>))}
              </select>
              <select
                value={filterDepartment}
                onChange={e => setFilterDepartment(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-300 outline-none"
              >
                <option value="">Todos los departamentos</option>
                {departments.map(d => (<option key={d} value={d}>{d}</option>))}
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-300 outline-none"
              >
                <option value="name">Ordenar: Nombre</option>
                <option value="role">Ordenar: Rol</option>
                <option value="routes">Ordenar: Rutas</option>
                <option value="hours">Ordenar: Horas</option>
              </select>
              {(filterSearch || filterRole || filterDepartment) && (
                <button
                  onClick={() => { setFilterSearch(''); setFilterRole(''); setFilterDepartment(''); }}
                  className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400 hover:text-orange-500 flex items-center gap-1"
                >
                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-close-line" /></div>
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Mostrando {filteredSortedEmployees.length} de {employees.length} empleados
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSortedEmployees.map((emp) => (
            <div key={emp.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-all cursor-pointer" onClick={() => { setSelectedEmployee(emp); setShowEmployeeDetail(true); }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <ImageWithFallback
                    src={emp.photo}
                    alt={emp.name}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    fallbackClassName="w-14 h-14 rounded-xl flex-shrink-0"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditPhotoFor(emp); setPhotoPreview(emp.photo); }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center hover:bg-orange-600 shadow-sm"
                    title="Cambiar foto"
                  >
                    <i className="ri-pencil-fill text-white text-[10px]" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-slate-100 truncate">{emp.name}</h3>
                  <p className="text-xs text-gray-400">{emp.role}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-phone-line" /></div>
                  {emp.phone}
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-line" /></div>
                  <span className="truncate">{emp.email}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-50 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-gray-400 dark:text-slate-500">Horas mes</p><p className="font-medium text-gray-700 dark:text-slate-300">{emp.hours_this_month}h</p></div>
                <div><p className="text-gray-400 dark:text-slate-500">Rutas</p><p className="font-medium text-gray-700 dark:text-slate-300">{emp.routes_completed}</p></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setShowVideoFor(emp.name); }} className="flex-1 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5">
                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-video-line" /></div>
                  Video
                </button>
                <button onClick={(e) => { e.stopPropagation(); setShowChatFor(emp.name); }} className="flex-1 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 flex items-center justify-center gap-1.5">
                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-chat-1-line" /></div>
                  Chat
                </button>
              </div>
            </div>
          ))}
          {filteredSortedEmployees.length === 0 && !loading && (
            <div className="col-span-full text-center py-12">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 rounded-full bg-gray-100 dark:bg-slate-800">
                <i className="ri-user-search-line text-xl text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">No se encontraron empleados con esos filtros</p>
            </div>
          )}
        </div>

        <EmployeeDetailModal />
        <NewEmployeeModal />
        <EditPhotoModal />
        {showChatFor && <ChatModal employeeName={showChatFor} onClose={() => setShowChatFor(null)} />}
        {showVideoFor && <VideoCallModal employeeName={showVideoFor} onClose={() => setShowVideoFor(null)} />}
      </div>
    );
  }

  // ==========================
  // ORGANIGRAMA TAB
  // ==========================
  if (activeTab === 'org') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Organigrama</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Estructura del equipo y jerarquia</p>
          </div>
          <TabBar />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {roleOrder.map(role => {
            const count = orgByRole[role]?.length || 0;
            const color = roleColors[role] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
            return (
              <div key={role} className={`${color.bg} dark:bg-slate-800 rounded-xl border ${color.border} dark:border-slate-700 p-4`}>
                <p className="text-xs text-gray-500 dark:text-slate-400">{role}</p>
                <p className={`text-xl font-bold ${color.text} dark:text-slate-100 mt-1`}>{count}</p>
              </div>
            );
          })}
        </div>

        {/* Org chart layout */}
        <div className="space-y-8">
          {roleOrder.map(role => {
            const emps = orgByRole[role];
            if (!emps || emps.length === 0) return null;
            const color = roleColors[role] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${color.bg.replace('bg-', 'bg-')} ${color.border.replace('border-', 'border-2 border-')}`} style={{ backgroundColor: color.text.includes('orange') ? '#f97316' : color.text.includes('blue') ? '#3b82f6' : color.text.includes('emerald') ? '#10b981' : '#f59e0b' }} />
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 text-sm">{role} ({emps.length})</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {emps.map(renderOrgNode)}
                </div>
              </div>
            );
          })}
          {Object.keys(orgByRole).filter(r => !roleOrder.includes(r)).map(role => {
            const emps = orgByRole[role];
            if (!emps || emps.length === 0) return null;
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 text-sm">{role} ({emps.length})</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {emps.map(renderOrgNode)}
                </div>
              </div>
            );
          })}
          {filteredSortedEmployees.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 rounded-full bg-gray-100 dark:bg-slate-800">
                <i className="ri-team-line text-xl text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">No hay empleados para mostrar en el organigrama</p>
            </div>
          )}
        </div>

        <EmployeeDetailModal />
        <EditPhotoModal />
      </div>
    );
  }

  // ==========================
  // TIME TAB
  // ==========================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Fichaje de Empleados</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Registro de fichajes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'list' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>Empleados</button>
          <button onClick={() => setActiveTab('time')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'time' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>Control Horario</button>
        </div>
      </div>

      {/* Top row: check-in card + working now cards */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Registrar Fichaje card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5 w-full lg:w-[340px] flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-time-line text-gray-500 dark:text-slate-400 text-lg" /></div>
            <span className="font-medium text-sm text-gray-800 dark:text-slate-100">Registrar Fichaje</span>
          </div>

          <div className="flex items-center gap-2 mb-3 text-xs">
            <button onClick={() => setUseDropdown(true)} className={`px-3 py-1 rounded-full transition-all ${useDropdown ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>Seleccionar</button>
            <button onClick={() => setUseDropdown(false)} className={`px-3 py-1 rounded-full transition-all ${!useDropdown ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>Escribir nombre</button>
          </div>

          {useDropdown ? (
            <select
              value={checkInForm.employee}
              onChange={e => setCheckInForm(prev => ({ ...prev, employee: e.target.value, date: today, check_in: nowTime }))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none mb-3"
            >
              <option value="">Nombre del empleado...</option>
              {employees.map(emp => (<option key={emp.id} value={emp.name}>{emp.name}</option>))}
            </select>
          ) : (
            <input
              type="text"
              value={checkInForm.employeeInput}
              onChange={e => setCheckInForm(prev => ({ ...prev, employeeInput: e.target.value, date: today, check_in: nowTime }))}
              placeholder="Escribe el nombre del empleado..."
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none mb-3"
            />
          )}

          <button
            onClick={async () => {
              const empName = useDropdown ? checkInForm.employee : checkInForm.employeeInput;
              if (!empName) return;
              await supabase.from('time_tracking').insert({ employee: empName, date: today, check_in: nowTime, check_out: null, total_hours: null });
              setCheckInForm({ employee: '', employeeInput: '', date: '', check_in: '', check_out: '' });
              fetchData();
            }}
            disabled={useDropdown ? !checkInForm.employee : !checkInForm.employeeInput}
            className="w-full py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-play-line" /></div>
            Entrada
          </button>
        </div>

        {/* Working Now section */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-gray-800 dark:text-slate-100">Trabajando Ahora ({activeNow.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeNow.map((emp) => {
              const record = timeRecords.find(r => r.employee === emp.name && r.date === today && r.check_in && !r.check_out);
              return (
                <div key={emp.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{emp.name}</span>
                    <span className="text-xs text-green-500">Desde {record?.check_in?.slice(0, 5) || '--:--'}</span>
                  </div>
                  <button onClick={() => handleCheckOutNow(emp.name)} className="w-full py-2 bg-orange-500/90 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-all flex items-center justify-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-checkbox-blank-line" /></div>
                    Salida
                  </button>
                </div>
              );
            })}
            {activeNow.length === 0 && (
              <div className="col-span-full bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-gray-400 dark:text-slate-500">No hay empleados fichados actualmente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial de Fichajes */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-calendar-line text-gray-500 dark:text-slate-400 text-lg" /></div>
            <span className="font-medium text-sm text-gray-800 dark:text-slate-100">Historial de Fichajes</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pdfFilterEmployee}
              onChange={e => setPdfFilterEmployee(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-600 dark:text-slate-300 outline-none"
            >
              <option value="">Todos los empleados</option>
              {employees.map(emp => (<option key={emp.id} value={emp.name}>{emp.name}</option>))}
            </select>
            <button onClick={() => setShowPdfPreview(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-download-line" /></div>
              PDF
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-printer-line" /></div>
              Imprimir
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-gray-400 dark:text-slate-500 font-medium text-xs uppercase">Empleado</th>
                <th className="text-left px-4 py-3 text-gray-400 dark:text-slate-500 font-medium text-xs uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-gray-400 dark:text-slate-500 font-medium text-xs uppercase">Entrada</th>
                <th className="text-left px-4 py-3 text-gray-400 dark:text-slate-500 font-medium text-xs uppercase">Salida</th>
                <th className="text-left px-4 py-3 text-gray-400 dark:text-slate-500 font-medium text-xs uppercase">Horas</th>
                <th className="text-left px-4 py-3 text-gray-400 dark:text-slate-500 font-medium text-xs uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {timeRecords.map((record) => (
                <tr key={record.id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-100 text-xs">{record.employee}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{record.date}</td>
                  <td className="px-4 py-3 text-emerald-500 text-xs font-medium">{record.check_in}</td>
                  <td className="px-4 py-3 text-red-500 text-xs font-medium">{record.check_out || '-'}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-slate-100 text-xs font-medium">{record.total_hours !== null ? `${record.total_hours.toFixed(1)}h` : '-'}</td>
                  <td className="px-4 py-3">
                    {!record.check_out ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-medium">Trabajando</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-[11px] font-medium">Completado</span>
                    )}
                  </td>
                </tr>
              ))}
              {timeRecords.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500 text-sm">No hay fichajes registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual check-in modal */}
      <Modal
        isOpen={showNewCheckIn}
        onClose={() => setShowNewCheckIn(false)}
        title="Nuevo Fichaje Manual"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Empleado</label>
            <select value={checkInForm.employee} onChange={e => setCheckInForm(prev => ({ ...prev, employee: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100">
              <option value="">Seleccionar...</option>
              {employees.map(emp => (<option key={emp.id} value={emp.name}>{emp.name}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Fecha</label><input type="date" value={checkInForm.date} onChange={e => setCheckInForm(prev => ({ ...prev, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100" /></div>
            <div><label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Entrada</label><input type="time" value={checkInForm.check_in} onChange={e => setCheckInForm(prev => ({ ...prev, check_in: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100" /></div>
          </div>
          <div><label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Salida (opcional)</label><input type="time" value={checkInForm.check_out} onChange={e => setCheckInForm(prev => ({ ...prev, check_out: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowNewCheckIn(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={handleCreateCheckIn} disabled={!checkInForm.employee || !checkInForm.date || !checkInForm.check_in || submitting} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">{submitting ? 'Guardando...' : 'Guardar Fichaje'}</button>
          </div>
        </div>
      </Modal>

      {/* PDF preview modal */}
      <Modal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        title="Vista previa PDF"
        size="2xl"
      >
        <div className="mb-4">
          <label className="text-xs text-gray-500 block mb-1">Filtrar por empleado</label>
          <select value={pdfFilterEmployee} onChange={e => setPdfFilterEmployee(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none">
            <option value="">Todos los empleados</option>
            {employees.map(emp => (<option key={emp.id} value={emp.name}>{emp.name}</option>))}
          </select>
        </div>
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h3 className="text-center font-bold text-gray-800 mb-1">Historial de Fichajes{pdfFilterEmployee ? ` - ${pdfFilterEmployee}` : ''}</h3>
          <p className="text-center text-xs text-gray-500 mb-4">{today}</p>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-300"><th className="text-left py-1">Empleado</th><th className="text-left py-1">Fecha</th><th className="text-left py-1">Entrada</th><th className="text-left py-1">Salida</th><th className="text-left py-1">Horas</th></tr></thead>
            <tbody>
              {pdfRecords.slice(0, 15).map((r) => (
                <tr key={r.id} className="border-b border-gray-200">
                  <td className="py-1">{r.employee}</td><td className="py-1">{r.date}</td><td className="py-1">{r.check_in}</td><td className="py-1">{r.check_out || '-'}</td><td className="py-1">{r.total_hours !== null ? `${r.total_hours.toFixed(1)}h` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setShowPdfPreview(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cerrar</button>
          <button onClick={handlePrintPdf} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Descargar PDF</button>
        </div>
      </Modal>
    </div>
  );

  // ==========================
  // SUB-COMPONENTS
  // ==========================
  function EmployeeDetailModal() {
    return (
      <Modal
        isOpen={showEmployeeDetail && !!selectedEmployee}
        onClose={() => { setShowEmployeeDetail(false); setSelectedEmployee(null); }}
        title={selectedEmployee?.name || ''}
        size="md"
      >
        {selectedEmployee && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <ImageWithFallback
                src={selectedEmployee.photo}
                alt={selectedEmployee.name}
                className="w-20 h-20 rounded-xl object-cover"
                fallbackClassName="w-20 h-20 rounded-xl"
              />
              <div>
                <p className="text-sm font-medium text-orange-600">{selectedEmployee.role}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{selectedEmployee.phone}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">{selectedEmployee.email}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"><span className="text-sm text-gray-600 dark:text-slate-300">Fecha de ingreso</span><span className="text-sm text-gray-800 dark:text-slate-100">{selectedEmployee.joined}</span></div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"><span className="text-sm text-gray-600 dark:text-slate-300">Horas este mes</span><span className="text-sm font-medium text-gray-800 dark:text-slate-100">{selectedEmployee.hours_this_month}h</span></div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"><span className="text-sm text-gray-600 dark:text-slate-300">Rutas completadas</span><span className="text-sm font-medium text-gray-800 dark:text-slate-100">{selectedEmployee.routes_completed}</span></div>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${selectedEmployee.phone}`} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-phone-line" /></div>Llamar
              </a>
              <button onClick={() => { setShowEmployeeDetail(false); setShowChatFor(selectedEmployee.name); }} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-chat-1-line" /></div>Chat
              </button>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  function NewEmployeeModal() {
    return (
      <Modal
        isOpen={showNewEmployee}
        onClose={() => setShowNewEmployee(false)}
        title="Anadir Empleado"
        size="lg"
      >
        <div className="space-y-4">
          <div><label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Nombre completo</label><input type="text" placeholder="Nombre y apellidos..." value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Rol</label><select value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100"><option>Repartidor</option><option>Comercial</option><option>Almacen</option><option>Administracion</option></select></div>
            <div><label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Telefono</label><input type="tel" placeholder="+34..." value={newEmployee.phone} onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100" /></div>
          </div>
          <div><label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Email</label><input type="email" placeholder="email@quickly.es" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100" /></div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Supervisor (opcional)</label>
            <select value={newEmployee.supervisor_id ?? ''} onChange={e => setNewEmployee({...newEmployee, supervisor_id: e.target.value ? Number(e.target.value) : null})} className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-orange-300 dark:bg-slate-800 dark:text-slate-100">
              <option value="">Sin supervisor</option>
              {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowNewEmployee(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={addEmployee} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Guardar Empleado</button>
          </div>
        </div>
      </Modal>
    );
  }

  function EditPhotoModal() {
    return (
      <Modal
        isOpen={!!editPhotoFor}
        onClose={() => { setEditPhotoFor(null); setPhotoPreview(''); setPhotoFile(null); }}
        title={editPhotoFor ? `Cambiar foto de ${editPhotoFor.name}` : ''}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-28 h-28 rounded-xl object-cover" />
                <button
                  onClick={() => { setPhotoPreview(''); setPhotoFile(null); }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white flex items-center justify-center hover:bg-red-600 shadow-sm"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <div className="w-28 h-28 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                {editPhotoFor && (
                  <ImageWithFallback
                    src={editPhotoFor.photo}
                    alt={editPhotoFor.name}
                    className="w-28 h-28 rounded-xl object-cover opacity-40"
                    fallbackClassName="w-28 h-28 rounded-xl opacity-40"
                  />
                )}
              </div>
            )}
          </div>

          <label className="flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-800/50 cursor-pointer hover:border-orange-400 dark:hover:border-orange-400 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="w-10 h-10 flex items-center justify-center mb-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <i className="ri-upload-cloud-2-line text-xl text-orange-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">Arrastra tu imagen aqui</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">o haz clic para explorar</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">JPG, PNG, WEBP - max 5MB</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
          </label>

          {photoFile && (
            <p className="text-xs text-green-600 text-center">
              <i className="ri-check-line mr-1" /> Archivo seleccionado: {photoFile.name}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditPhotoFor(null); setPhotoPreview(''); setPhotoFile(null); }} className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={updateEmployeePhoto} disabled={!photoPreview || uploadingPhoto} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
              {uploadingPhoto ? 'Subiendo...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
}