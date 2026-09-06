import { useState, useMemo, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useRole } from '@/hooks/useRole';
import { usePremium } from '@/hooks/usePremium';
import { useLanguage } from '@/context/LanguageContext';
import { PATH_TRANSLATION_KEY } from './Sidebar';

// 4-5 accesos directos fijos por rol. El resto de secciones queda
// disponible detrás del botón "Más" para no perder ningún acceso.
const FIXED_PATHS: Record<string, string[]> = {
  empresa: ['/', '/pedidos', '/clientes', '/mapa-reparto'],
  empleado: ['/', '/mapa-reparto', '/cuadrante', '/albaranes'],
  cliente: ['/', '/pedidos', '/facturacion', '/comunicacion'],
  guest: ['/'],
};

interface NavItem {
  path: string;
  label: string;
  icon: string;
  premium?: boolean;
  locked?: boolean;
}

export default function BottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { unreadCount } = useNotificationsContext();
  const { sidebarSections, role, isCliente, isEmpleado } = useRole();
  const { isPremium } = usePremium();
  const { t } = useLanguage();

  const isEmpresa = !isCliente && !isEmpleado;

  const allItems = useMemo<NavItem[]>(
    () =>
      sidebarSections.flatMap((sec) =>
        sec.items.map((item) => ({
          ...item,
          locked: isEmpresa && (item as any).premium && !isPremium,
        }))
      ),
    [sidebarSections, isEmpresa, isPremium]
  );

  const fixedPaths = FIXED_PATHS[role] || FIXED_PATHS.guest;
  const fixedItems = fixedPaths
    .map((p) => allItems.find((i) => i.path === p))
    .filter(Boolean) as NavItem[];

  const overflowSections = useMemo(
    () =>
      sidebarSections
        .map((sec) => ({
          section: sec.section,
          items: sec.items
            .filter((item) => !fixedPaths.includes(item.path))
            .map((item) => ({
              ...item,
              locked: isEmpresa && (item as any).premium && !isPremium,
            })),
        }))
        .filter((sec) => sec.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sidebarSections, isEmpresa, isPremium]
  );

  const label = useCallback(
    (item: { path: string; label: string }) => {
      const key = PATH_TRANSLATION_KEY[item.path];
      return key ? t(key) : item.label;
    },
    [t]
  );

  const isMoreActive = moreOpen || (!fixedPaths.includes(location.pathname) && location.pathname !== '/configuracion');

  return (
    <>
      {/* Barra inferior — visible solo en móvil / tablet */}
      <nav
        className="bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch justify-around px-1"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {fixedItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isNotif = item.path === '/notificaciones';
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-w-0"
            >
              <div
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                  isActive ? 'bottom-nav-item-active text-white' : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                <i className={`${item.icon} text-lg`} />
                {isNotif && unreadCount > 0 && (
                  <span className="absolute -top-0.5 right-2.5 min-w-[14px] h-[14px] bg-orange-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] leading-none truncate max-w-full ${
                  isActive ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                {label(item)}
              </span>
            </Link>
          );
        })}

        <button
          onClick={() => setMoreOpen(true)}
          className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-w-0"
        >
          <div
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
              isMoreActive ? 'bottom-nav-item-active text-white' : 'text-gray-500 dark:text-slate-400'
            }`}
          >
            <i className="ri-grid-line text-lg" />
          </div>
          <span
            className={`text-[10px] leading-none ${
              isMoreActive ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-500 dark:text-slate-400'
            }`}
          >
            Más
          </span>
        </button>
      </nav>

      {/* Panel "Más" — todas las demás secciones, en lista, sin menú lateral */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-white dark:bg-[#070c1c] rounded-t-3xl max-h-[80vh] flex flex-col animate-[slideIn_0.25s_ease-out]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
              <span className="font-bold text-base text-gray-800 dark:text-white">Más opciones</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-300"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="overflow-y-auto px-3 py-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
              {overflowSections.map((sec) => (
                <div key={sec.section} className="mb-3">
                  <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-purple-300/50">
                    {sec.section}
                  </p>
                  {sec.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-slate-300 active:bg-gray-50 dark:active:bg-white/5"
                    >
                      <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${item.locked ? 'opacity-30' : ''}`}>
                        <i className={`${item.locked ? 'ri-lock-line' : item.icon} text-lg`} />
                      </div>
                      <span className="text-sm flex-1">{label(item)}</span>
                      {isEmpresa && item.premium && !isPremium && !item.locked && (
                        <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-purple-500/10 text-amber-600 dark:text-purple-300 text-[10px] font-bold rounded-md border border-amber-200 dark:border-purple-500/30 flex-shrink-0">
                          PRO
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ))}
              <Link
                to="/configuracion"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-slate-300 active:bg-gray-50 dark:active:bg-white/5 mt-1 border-t border-gray-100 dark:border-white/5 pt-4"
              >
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <i className="ri-settings-3-line text-lg" />
                </div>
                <span className="text-sm flex-1">Configuración</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
