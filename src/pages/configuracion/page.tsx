import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClickOutside } from '@/hooks/useClickOutside';
import Modal from '@/components/base/Modal';
import { useTheme } from '@/hooks/useTheme';

export default function Configuracion() {
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsAlerts: false,
    weeklyReport: true,
    autoAssignRoutes: false,
    darkModeDefault: false,
    language: 'es',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
    pushNotifications: true,
    soundAlerts: true,
  });
  const [saved, setSaved] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const logoutRef = useRef<HTMLDivElement>(null);
  useClickOutside(logoutRef, () => setShowLogoutConfirm(false), showLogoutConfirm);

  const toggle = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/');
    window.location.reload();
  };

  const handleExport = async (type: string) => {
    setExporting(type);
    setTimeout(() => {
      setExporting(null);
      setShowExportModal(false);
    }, 1500);
  };

  const handlePasswordChange = () => {
    setPasswordError('');
    setPasswordSuccess(false);
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      setPasswordError('Todos los campos son obligatorios');
      return;
    }
    if (passwordForm.new.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    setPasswordSuccess(true);
    setPasswordForm({ current: '', new: '', confirm: '' });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordSuccess(false);
    }, 2000);
  };

  const SectionTitle = ({ title, desc }: { title: string; desc: string }) => (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{desc}</p>
    </div>
  );

  const Toggle = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700 dark:text-slate-200">{label}</span>
      <button onClick={onClick} className={`w-11 h-6 rounded-full transition-all relative ${active ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-700'}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${active ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Configuracion</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Personaliza tu experiencia en Quickly</p>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <SectionTitle title="Notificaciones" desc="Elige que alertas quieres recibir" />
        <Toggle label="Notificaciones por email" active={settings.emailNotifications} onClick={() => toggle('emailNotifications')} />
        <Toggle label="Alertas SMS" active={settings.smsAlerts} onClick={() => toggle('smsAlerts')} />
        <Toggle label="Notificaciones push en navegador" active={settings.pushNotifications} onClick={() => toggle('pushNotifications')} />
        <Toggle label="Sonidos de alerta" active={settings.soundAlerts} onClick={() => toggle('soundAlerts')} />
        <Toggle label="Resumen semanal" active={settings.weeklyReport} onClick={() => toggle('weeklyReport')} />
      </div>

      {/* Automation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <SectionTitle title="Automatizacion" desc="Configura procesos automaticos" />
        <Toggle label="Asignacion automatica de rutas" active={settings.autoAssignRoutes} onClick={() => toggle('autoAssignRoutes')} />
      </div>

      {/* Regional */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-4">
        <SectionTitle title="Region y Preferencias" desc="Ajusta idioma, moneda y zona horaria" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Idioma</label>
            <select value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
              <option value="es">Espanol</option>
              <option value="en">English</option>
              <option value="ca">Catala</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Moneda</label>
            <select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
              <option value="EUR">EUR (e)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (L)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5 block">Zona horaria</label>
            <select value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none">
              <option value="Europe/Madrid">Madrid (CET)</option>
              <option value="Europe/London">Londres (GMT)</option>
              <option value="America/New_York">Nueva York (EST)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
        <SectionTitle title="Apariencia" desc="Personaliza el aspecto visual de la app" />
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <div className="w-5 h-5 flex items-center justify-center">
                {isDark ? (
                  <i className="ri-sun-line text-amber-500" />
                ) : (
                  <i className="ri-moon-line text-slate-600 dark:text-slate-300" />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                {isDark ? 'Modo oscuro activo' : 'Modo claro activo'}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {isDark ? 'Haz clic para volver al modo claro' : 'Haz clic para activar el modo oscuro'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-7 rounded-full transition-all relative ${isDark ? 'bg-orange-500' : 'bg-gray-200 dark:bg-slate-700'}`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${isDark ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-3">
        <SectionTitle title="Datos y Exportacion" desc="Exporta tus datos o solicita una copia de seguridad" />
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <i className="ri-file-download-line text-blue-600 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Exportar datos</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Descarga tus clientes, pedidos, facturas y rutas</p>
            </div>
          </div>
          <button onClick={() => setShowExportModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all whitespace-nowrap">
            Exportar
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-3">
        <SectionTitle title="Seguridad" desc="Gestion de contrasena y acceso" />
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <i className="ri-shield-keyhole-line text-slate-600 dark:text-slate-300 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Cambiar contrasena</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Actualiza tu clave de acceso</p>
            </div>
          </div>
          <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-all whitespace-nowrap">
            Cambiar
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <i className="ri-smartphone-line text-emerald-600 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Autenticacion en dos pasos</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Protege tu cuenta con 2FA</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded text-xs font-medium">Proximamente</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <i className="ri-history-line text-amber-600 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Historial de sesiones</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Dispositivos con acceso activo</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded text-xs font-medium">Proximamente</span>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-3">
        <SectionTitle title="Cuenta" desc="Gestion de acceso a tu cuenta" />
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <i className="ri-login-circle-line text-orange-600 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Iniciar sesion</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Accede con tu cuenta existente</p>
            </div>
          </div>
          <button onClick={() => navigate('/perfil')} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all whitespace-nowrap">
            Ir a Login
          </button>
        </div>
        <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <i className="ri-logout-box-r-line text-red-500 text-lg" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Cerrar sesion</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Salir de tu cuenta y limpiar datos</p>
              </div>
            </div>
            <button onClick={() => setShowLogoutConfirm(true)} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all whitespace-nowrap">
              Cerrar sesion
            </button>
          </div>
        </div>
      </div>

      {/* Danger */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-100 dark:border-red-900/30 p-6">
        <h3 className="text-sm font-semibold text-red-600 mb-1">Zona de peligro</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Acciones irreversibles para tu cuenta</p>
        <button className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
          Cerrar mi cuenta
        </button>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2">
          {saved ? <i className="ri-check-line" /> : <i className="ri-save-line" />}
          {saved ? 'Guardado' : 'Guardar configuracion'}
        </button>
        {saved && <span className="text-sm text-green-600">Configuracion guardada!</span>}
      </div>

      {/* Export Data Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Exportar datos"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-slate-400">Selecciona los datos que quieres descargar:</p>
          {[
            { key: 'clients', label: 'Clientes', icon: 'ri-user-3-line' },
            { key: 'orders', label: 'Pedidos', icon: 'ri-shopping-cart-2-line' },
            { key: 'invoices', label: 'Facturas', icon: 'ri-bill-line' },
            { key: 'routes', label: 'Rutas', icon: 'ri-map-2-line' },
            { key: 'employees', label: 'Empleados', icon: 'ri-team-line' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => handleExport(item.key)}
              disabled={exporting !== null}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <i className={`${item.icon} text-orange-600 dark:text-orange-400`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">{item.label}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Descargar como CSV</p>
              </div>
              {exporting === item.key ? (
                <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              ) : (
                <i className="ri-download-line text-gray-400 dark:text-slate-500" />
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(false); setPasswordForm({ current: '', new: '', confirm: '' }); }}
        title="Cambiar contrasena"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Contrasena actual</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Nueva contrasena</label>
            <input
              type="password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              placeholder="Minimo 8 caracteres"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-slate-300 block mb-1">Confirmar nueva contrasena</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-slate-100 outline-none"
              placeholder="Repite la nueva contrasena"
            />
          </div>
          {passwordError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-lg text-sm text-red-600 dark:text-red-400">
              <i className="ri-error-warning-line mr-1" />
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-lg text-sm text-green-600 dark:text-green-400">
              <i className="ri-check-line mr-1" />
              Contrasena actualizada correctamente
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordSuccess(false); setPasswordForm({ current: '', new: '', confirm: '' }); }}
              className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={handlePasswordChange}
              disabled={passwordSuccess}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
            >
              Guardar contrasena
            </button>
          </div>
        </div>
      </Modal>

      {/* Logout Confirm Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        size="sm"
        hideCloseButton
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-3">
            <i className="ri-logout-box-r-line text-red-500 text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-center text-gray-800 dark:text-slate-100 mb-2">Cerrar sesion</h3>
          <p className="text-sm text-center text-gray-500 dark:text-slate-400 mb-6">Se limpiaran todos los datos locales y volveras al inicio. Estas seguro?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</button>
            <button onClick={handleLogout} className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">Si, cerrar sesion</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
