import { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useCompany } from '@/hooks/useCompany';
import { useRole } from '@/hooks/useRole';
import { usePremium } from '@/hooks/usePremium';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCounter, setNavCounter] = useState(0);
  const { unreadCount } = useNotificationsContext();
  const { data: company } = useCompany();
  const { sidebarSections, isEmpresa } = useRole();
  const { isPremium } = usePremium();

  // sidebar items that are premium and not accessible should be dimmed
  const enrichedSections = sidebarSections.map((sec) => ({
    ...sec,
    items: sec.items.map((item) => ({
      ...item,
      locked: (item as any).premium && !isPremium,
    })),
  }));

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setNavCounter(c => c + 1);
  }, [location.pathname]);

  const renderItem = useCallback((item: { path: string; label: string; icon: string; premium?: boolean; locked?: boolean }) => {
    const isActive = location.pathname === item.path;
    const isNotif = item.path === '/notificaciones';
    return (
      <Link
        key={isActive ? `${item.path}-${navCounter}` : item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all whitespace-nowrap relative
          ${isActive
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-medium sidebar-active-ping'
            : item.locked
              ? 'text-gray-300 dark:text-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-400 dark:hover:text-slate-500'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200'
          }
          ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? item.label : undefined}
      >
        <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 relative ${item.locked ? 'opacity-40' : ''}`}>
          <i className={`${item.locked ? 'ri-lock-line' : item.icon} text-lg`} />
          {isNotif && unreadCount > 0 && !collapsed && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-orange-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && <span className="text-sm">{item.label}</span>}
        {!collapsed && item.premium && !isPremium && !item.locked && (
          <span className="ml-auto px-1 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded border border-amber-200 flex-shrink-0">PRO</span>
        )}
        {isActive && !collapsed && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
        )}
        {isNotif && unreadCount > 0 && collapsed && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500" />
        )}
      </Link>
    );
  }, [location.pathname, navCounter, collapsed, unreadCount]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 md:hidden w-11 h-11 flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700"
      >
        <i className={`${mobileOpen ? 'ri-close-line' : 'ri-menu-line'} text-xl text-gray-700 dark:text-slate-300`} />
      </button>

      <aside
        className={`fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 z-40 transition-transform duration-300 flex flex-col
          ${collapsed ? 'w-16' : 'w-64'} 
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo area - dynamic */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-slate-800 min-h-[64px]">
          <img
            src={company.logo}
            alt={company.name}
            className="w-8 h-8 object-contain flex-shrink-0 rounded"
          />
          {(!collapsed || mobileOpen) && (
            <span className="font-bold text-lg text-gray-800 dark:text-slate-100 whitespace-nowrap">{company.name.split(' ')[0]}</span>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-[72px] w-6 h-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-full items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 z-50"
        >
          <i className={`${collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} text-xs text-gray-500 dark:text-slate-400`} />
        </button>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          {sidebarSections.map((sec) => (
            <div key={sec.section} className="mb-3">
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {sec.section}
                </p>
              )}
              {collapsed && (
                <div className="px-3 mb-1 flex justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600" />
                </div>
              )}
              {sec.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-slate-800">
          <Link to="/configuracion" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 w-full
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
            className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-all flex-shrink-0"
            title="WhatsApp"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-whatsapp-line text-xl" />
            </div>
          </a>
          <a
            href="https://t.me/deliverpro_bot"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`w-10 h-10 rounded-full bg-sky-400 text-white flex items-center justify-center hover:bg-sky-500 transition-all flex-shrink-0 ${collapsed ? 'hidden' : ''}`}
            title="Telegram"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-telegram-line text-xl" />
            </div>
          </a>
        </div>

        {/* Mobile safe area padding */}
        <div className="h-4 md:hidden" />
      </aside>
    </>
  );
}
