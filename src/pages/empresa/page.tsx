import { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useCompany } from '@/hooks/useCompany';
import Modal from '@/components/base/Modal';
import ImageWithFallback from '@/components/base/ImageWithFallback';

const colorOptions = [
  '#f97316', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6',
  '#f59e0b', '#ec4899', '#06b6d4', '#6366f1', '#84cc16',
];

const PRESET_LOGOS = [
  {
    name: 'Mundopan',
    url: 'https://pbs.twimg.com/profile_images/884756751817531392/JXXv9eVo_400x400.jpg',
    bg: '#f5f0cc',
  },
  {
    name: 'KFC',
    url: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/KFC_logo.svg/200px-KFC_logo.svg.png',
    bg: '#c8102e',
  },
  {
    name: 'Coca-Cola',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coca-Cola_logo.svg/400px-Coca-Cola_logo.svg.png',
    bg: '#f40009',
  },
  {
    name: 'Burger King',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Burger_King_logo_%281999%29.svg/200px-Burger_King_logo_%281999%29.svg.png',
    bg: '#ffffff',
  },
  {
    name: "McDonald's",
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/McDonald%27s_logo.svg/200px-McDonald%27s_logo.svg.png',
    bg: '#DA291C',
  },
];

export default function Empresa() {
  const { data: company, update } = useCompany();
  const [showEdit, setShowEdit] = useState(false);
  const editModalRef = useRef<HTMLDivElement>(null);
  useClickOutside(editModalRef, () => setShowEdit(false), showEdit);
  const [editForm, setEditForm] = useState({ ...company });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName] = useState('');
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = () => {
    setEditForm({ ...company });
    setLogoPreview(null);
    setLogoName('');
    setShowEdit(true);
  };

  const processLogo = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processLogo(file);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processLogo(file);
  };

  const clearLogo = () => {
    setLogoPreview(null);
    setLogoName('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const saveChanges = () => {
    setIsSaving(true);
    update({
      name: editForm.name,
      legalName: editForm.legalName,
      cif: editForm.cif,
      address: editForm.address,
      city: editForm.city,
      postalCode: editForm.postalCode,
      phone: editForm.phone,
      email: editForm.email,
      website: editForm.website,
      brandColor: editForm.brandColor,
      logo: logoPreview || company.logo,
    });
    setTimeout(() => {
      setIsSaving(false);
      setShowEdit(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Información de la Empresa</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Datos y configuración de la empresa</p>
        </div>
        <button
          onClick={openEdit}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-pencil-line" />
          </div>
          Editar
        </button>
      </div>

      {/* Company Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="h-32" style={{ backgroundColor: company.brandColor }} />
        <div className="px-6 pb-6">
          <div className="flex items-end -mt-12 mb-4">
            <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-900 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
              <ImageWithFallback src={company.logo} alt={company.name} className="w-full h-full object-contain" fallbackClassName="w-full h-full" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">{company.name}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">{company.legalName}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg flex-shrink-0">
                  <i className="ri-building-line text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">CIF</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{company.cif}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg flex-shrink-0">
                  <i className="ri-map-pin-line text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Dirección</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{company.address}</p>
                  <p className="text-sm text-gray-600 dark:text-slate-300">{company.postalCode} {company.city}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg flex-shrink-0">
                  <i className="ri-phone-line text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Teléfono</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{company.phone}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg flex-shrink-0">
                  <i className="ri-mail-line text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Email</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{company.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg flex-shrink-0">
                  <i className="ri-global-line text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Web</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{company.website}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg flex-shrink-0">
                  <i className="ri-calendar-line text-gray-500 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Fundada</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{company.founded}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-3">
            <i className="ri-team-line text-orange-600 text-lg" />
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{company.employees}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Empleados</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
            <i className="ri-user-star-line text-blue-600 text-lg" />
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{company.clients}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Clientes</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3">
            <i className="ri-money-euro-circle-line text-green-600 text-lg" />
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">€{company.monthlyRevenue.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Ingresos mensuales</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-100 dark:border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-3">
            <i className="ri-palette-line text-purple-600 text-lg" />
          </div>
          <div className="w-6 h-6 rounded-full mb-1" style={{ backgroundColor: company.brandColor }} />
          <p className="text-sm text-gray-500 dark:text-slate-400">Color de marca</p>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar Empresa"
        size="lg"
      >
        <div className="space-y-4">
          {/* Logo section */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block mb-2">
              Logo de la empresa
            </label>

            {/* ── Preset logos ── */}
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Logos predefinidos — haz clic para seleccionar</p>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {PRESET_LOGOS.map((preset) => {
                const activeUrl = logoPreview || editForm.logo;
                const isSelected = activeUrl === preset.url;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => { setLogoPreview(preset.url); setLogoName(preset.name); }}
                    title={preset.name}
                    className={`relative rounded-xl border-2 p-2 flex flex-col items-center gap-1.5 transition-all
                      ${isSelected
                        ? 'border-orange-400 ring-2 ring-orange-200 dark:ring-orange-900/40 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-500 bg-white dark:bg-slate-800'
                      }`}
                  >
                    <div
                      className="w-full h-10 rounded-lg overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: preset.bg }}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 text-center leading-tight font-medium truncate w-full">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow-sm">
                        <i className="ri-check-line text-white text-[10px]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Divider ── */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">o sube tu propio logo</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            </div>

            {/* ── Preview / Upload ── */}
            {logoPreview || editForm.logo ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                <img
                  src={logoPreview || editForm.logo}
                  alt="Logo preview"
                  className="w-full h-28 object-contain bg-gray-50 dark:bg-slate-800 p-2"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  {logoName && (
                    <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{logoName}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => { clearLogo(); setEditForm(f => ({ ...f, logo: '' })); }}
                    className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80"
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => logoInputRef.current?.click()}
                onDrop={handleLogoDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDraggingLogo(false); }}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors
                  ${isDraggingLogo ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-500'}`}
              >
                <i className="ri-image-add-line text-gray-400 dark:text-slate-500 text-2xl mb-1" />
                <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra o haz clic para subir logo</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">JPG, PNG hasta 5MB</p>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Nombre</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Dirección</label>
            <input
              type="text"
              value={editForm.address}
              onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Teléfono</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">CIF</label>
              <input
                type="text"
                value={editForm.cif}
                onChange={(e) => setEditForm(f => ({ ...f, cif: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Web</label>
              <input
                type="text"
                value={editForm.website}
                onChange={(e) => setEditForm(f => ({ ...f, website: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Color de marca</label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map(c => (
                <button
                  key={c}
                  onClick={() => setEditForm(f => ({ ...f, brandColor: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all
                    ${editForm.brandColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={() => setShowEdit(false)}
              className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              onClick={saveChanges}
              disabled={isSaving}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
