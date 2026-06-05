import { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useCompany } from '@/hooks/useCompany';
import { useRole } from '@/hooks/useRole';
import { usePremium } from '@/hooks/usePremium';
import { useLanguage } from '@/context/LanguageContext';


// Mapa de path → clave de traducción
const PATH_TRANSLATION_KEY: Record<string, string> = {
  '/': 'dashboard', '/clientes': 'clients', '/rutas': 'routes', '/productos': 'products',
  '/pedidos': 'orders', '/facturacion': 'invoicing', '/albaranes': 'deliverynotes',
  '/incidencias': 'incidents', '/vehiculos': 'vehicles', '/mapa-reparto': 'routes',
  '/hoja-ruta': 'routesheet', '/hoja-pedidos': 'ordersheet', '/cuadrante': 'schedule',
  '/empresa': 'company', '/empleados': 'employees', '/combustible': 'fuel',
  '/estadisticas': 'stats', '/calendario': 'calendar', '/control-horario': 'timecontrol',
  '/comunicacion': 'chat', '/email': 'email', '/notificaciones': 'notifications',
  '/documentos': 'documents', '/hoja-calculo': 'spreadsheet', '/asistente': 'assistant',
  '/sugerencias': 'suggestions', '/legales': 'legal',
  '/configuracion': 'settings', '/perfil': 'profile',
};

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useNotificationsContext();
  const { data: company } = useCompany();
  const { sidebarSections, isCliente, isEmpleado } = useRole();
  const { isPremium } = usePremium();
  const { t } = useLanguage();

  // Solo empresa ve bloqueos y badges PRO según su plan
  // Clientes y empleados no tienen items premium en su sidebar, así que locked siempre es false para ellos
  const isEmpresa = !isCliente && !isEmpleado;

  const enrichedSections = sidebarSections.map((sec) => ({
    ...sec,
    items: sec.items.map((item) => ({
      ...item,
      locked: isEmpresa && (item as any).premium && !isPremium,
    })),
  }));

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const renderItem = useCallback((item: { path: string; label: string; icon: string; premium?: boolean; locked?: boolean }) => {
    const isActive = location.pathname === item.path;
    const isNotif = item.path === '/notificaciones';
    const translationKey = PATH_TRANSLATION_KEY[item.path];
    const displayLabel = translationKey ? t(translationKey) : item.label;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200 whitespace-nowrap relative
          ${isActive
            ? 'bg-orange-50 dark:bg-transparent text-orange-600 dark:text-orange-400 font-medium sidebar-active-ping'
            : item.locked
              ? 'text-gray-300 dark:text-slate-600 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-400 dark:hover:text-slate-500'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-orange-300'
          }
          ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? displayLabel : undefined}
      >
        <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 relative ${item.locked ? 'opacity-30' : ''}`}>
          <i className={`${item.locked ? 'ri-lock-line' : item.icon} text-lg ${isActive ? 'dark:drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]' : ''}`} />
          {isNotif && unreadCount > 0 && !collapsed && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-orange-500 dark:shadow-[0_0_6px_rgba(249,115,22,0.8)] rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && <span className="text-sm">{displayLabel}</span>}
        {!collapsed && isEmpresa && item.premium && !isPremium && !item.locked && (
          <span className="ml-auto px-1.5 py-0.5 bg-amber-50 dark:bg-orange-500/10 text-amber-600 dark:text-orange-400 text-[10px] font-bold rounded-md border border-amber-200 dark:border-orange-500/30 flex-shrink-0 neon-pro-badge">PRO</span>
        )}
        {isActive && !collapsed && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 dark:bg-orange-400 flex-shrink-0 neon-dot dark:shadow-[0_0_8px_rgba(249,115,22,0.9)]" />
        )}
        {isNotif && unreadCount > 0 && collapsed && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500 dark:shadow-[0_0_6px_rgba(249,115,22,0.8)]" />
        )}
      </Link>
    );
  }, [location.pathname, collapsed, unreadCount, isPremium, isEmpresa, t]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 md:hidden w-11 h-11 flex items-center justify-center bg-white dark:bg-[#040816] rounded-xl shadow-lg border border-gray-100 dark:border-orange-500/20 dark:shadow-orange-500/10"
      >
        <i className={`${mobileOpen ? 'ri-close-line' : 'ri-menu-line'} text-xl text-gray-700 dark:text-orange-400`} />
      </button>

      <aside
        className={`fixed top-0 left-0 h-full bg-white dark:glass-sidebar z-40 transition-transform duration-300 flex flex-col
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo area */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-orange-500/10 min-h-[64px] ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-lg bg-orange-500/20 dark:bg-orange-500/10 blur-sm" />
            <img
              src={company.logo || '/logo.png'}
              alt={company.name}
              className="relative w-8 h-8 object-contain flex-shrink-0 rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
            />
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="font-bold text-lg whitespace-nowrap text-gray-800 dark:neon-gradient-text">{company.name.split(' ')[0]}</span>
          )}
        </div>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-[72px] w-6 h-6 bg-white dark:bg-[#040816] border border-gray-200 dark:border-orange-500/30 rounded-full items-center justify-center shadow-sm hover:border-orange-400 dark:hover:shadow-orange-500/20 dark:hover:shadow-md z-50 transition-all"
        >
          <i className={`${collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} text-xs text-gray-500 dark:text-orange-400`} />
        </button>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          {enrichedSections.map((sec) => (
            <div key={sec.section} className="mb-3">
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-orange-500/50">
                  {sec.section}
                </p>
              )}
              {collapsed && (
                <div className="px-3 mb-1 flex justify-center">
                  <div className="w-3 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
                </div>
              )}
              {sec.items.map(renderItem)}
            </div>
          ))}
        </nav>

        {/* Settings footer */}
        <div className="p-3 border-t border-gray-100 dark:border-orange-500/10">
          <Link to="/configuracion" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 dark:hover:text-orange-300 transition-all w-full
            ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <i className="ri-settings-3-line text-lg" />
            </div>
            {!collapsed && <span className="text-sm">Configuración</span>}
          </Link>
        </div>

        {/* Social icons footer */}
        <div className={`px-3 pb-3 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <a
            href="https://wa.me/34600000000"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="w-9 h-9 rounded-xl bg-green-500 dark:bg-green-500/20 dark:border dark:border-green-500/40 text-white flex items-center justify-center hover:bg-green-600 dark:hover:bg-green-500/30 transition-all flex-shrink-0 dark:text-green-400"
            title="WhatsApp"
          >
            <i className="ri-whatsapp-line text-lg" />
          </a>
          <a
            href="https://t.me/deliverpro_bot"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`w-9 h-9 rounded-xl bg-sky-400 dark:bg-cyan-500/20 dark:border dark:border-cyan-500/40 text-white flex items-center justify-center hover:bg-sky-500 dark:hover:bg-cyan-500/30 transition-all flex-shrink-0 dark:text-cyan-400 ${collapsed ? 'hidden' : ''}`}
            title="Telegram"
          >
            <i className="ri-telegram-line text-lg" />
          </a>
        </div>

        <div className="h-4 md:hidden" />
      </aside>
    </>
  );
}
