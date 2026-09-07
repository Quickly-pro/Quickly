import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useRole } from '@/hooks/useRole';
import { usePremium } from '@/hooks/usePremium';
import { useLanguage } from '@/context/LanguageContext';
import { PATH_TRANSLATION_KEY } from './Sidebar';

// 4 accesos directos fijos por rol, repartidos 2 a la izquierda y 2 a la
// derecha del botón central "+". El resto de secciones vive dentro de la
// rueda que abre ese botón.
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
  section?: string;
}

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [wheelOpen, setWheelOpen] = useState(false);
  const [centeredIdx, setCenteredIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rafRef = useRef<number | null>(null);
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
          section: sec.section,
          locked: isEmpresa && (item as any).premium && !isPremium,
        }))
      ),
    [sidebarSections, isEmpresa, isPremium]
  );

  const fixedPaths = FIXED_PATHS[role] || FIXED_PATHS.guest;
  const fixedItems = fixedPaths
    .map((p) => allItems.find((i) => i.path === p))
    .filter(Boolean) as NavItem[];
  const leftItems = fixedItems.slice(0, 2);
  const rightItems = fixedItems.slice(2, 4);

  // La rueda muestra el resto de secciones del rol, SIN repetir las que
  // ya tienen acceso directo en la barra inferior (Dashboard, Rutas,
  // Cuadrante, Albaranes, etc. según el rol).
  const wheelItems = useMemo(
    () => [
      ...allItems.filter((i) => !fixedPaths.includes(i.path)),
      { path: '/configuracion', label: 'Configuración', icon: 'ri-settings-3-line', section: 'AJUSTES' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems]
  );

  const label = useCallback(
    (item: { path: string; label: string }) => {
      const key = PATH_TRANSLATION_KEY[item.path];
      return key ? t(key) : item.label;
    },
    [t]
  );

  // Da a cada icono su posición en la "rueda": el que está en el centro
  // queda grande y de frente; los demás se van encogiendo, alejando y
  // girando en 3D hacia los lados, como si la rueda estuviera dando vuelta.
  const updateWheelVisual = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let bestDist = Infinity;
    itemRefs.current.forEach((el, idx) => {
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const diff = elCenter - center;
      const t = diff / 78;
      const dist = Math.min(Math.abs(t), 3);
      const scale = Math.max(0.55, 1 - dist * 0.22);
      const opacity = Math.max(0.3, 1 - dist * 0.32);
      const translateY = dist * 11;
      const translateZ = -dist * 30;
      const rotateY = Math.max(-58, Math.min(58, -t * 34));
      el.style.transform = `translateY(${translateY}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
      el.style.opacity = String(opacity);
      if (Math.abs(diff) < bestDist) {
        bestDist = Math.abs(diff);
        closest = idx;
      }
    });
    setCenteredIdx(closest);
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateWheelVisual);
  }, [updateWheelVisual]);

  // Al abrir la rueda, la centra en el item activo (o en el primero)
  useEffect(() => {
    if (!wheelOpen || !trackRef.current) return;
    const track = trackRef.current;
    const activeIdx = wheelItems.findIndex((i) => i.path === location.pathname);
    const startIdx = activeIdx >= 0 ? activeIdx : 0;
    requestAnimationFrame(() => {
      const el = itemRefs.current[startIdx];
      if (el) {
        track.scrollTo({ left: el.offsetLeft - track.clientWidth / 2 + el.clientWidth / 2, behavior: 'auto' });
      }
      updateWheelVisual();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelOpen]);

  const renderFixedItem = (item: NavItem) => {
    const active = location.pathname === item.path;
    const isNotif = item.path === '/notificaciones';
    return (
      <Link
        key={item.path}
        to={item.path}
        className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0"
      >
        <div
          className={`relative w-8 h-8 flex items-center justify-center rounded-full transition-all ${
            active ? 'text-white bottom-nav-item-active' : 'text-gray-400 dark:text-slate-500'
          }`}
        >
          <i className={`${item.icon} text-[17px]`} />
          {isNotif && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] bg-orange-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span
          className={`text-[9.5px] leading-none truncate max-w-full ${
            active ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-400 dark:text-slate-500'
          }`}
        >
          {label(item)}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Barra inferior con muesca central — visible solo en móvil / tablet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-[#0a0c1c]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="relative mx-auto w-full max-w-md">
          <svg
            className="bottom-nav-shape block w-full"
            viewBox="0 0 400 76"
            preserveAspectRatio="none"
            width="100%"
            height="76"
          >
            <path d="M0,22 Q0,0 22,0 L150,0 C170,0 162,32 200,32 C238,32 230,0 250,0 L378,0 Q400,0 400,22 L400,76 L0,76 Z" />
          </svg>

          <div className="absolute inset-0 flex items-stretch">
            <div className="flex flex-1 items-stretch justify-evenly pr-8">{leftItems.map(renderFixedItem)}</div>
            <div className="flex flex-1 items-stretch justify-evenly pl-8">{rightItems.map(renderFixedItem)}</div>
          </div>

          <button
            onClick={() => setWheelOpen((v) => !v)}
            aria-label={wheelOpen ? 'Cerrar más opciones' : 'Más opciones'}
            className={`bottom-nav-fab absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 active:scale-90 ${
              wheelOpen ? 'scale-110' : 'scale-100'
            }`}
          >
            <i className={`text-2xl text-white transition-transform duration-300 ${wheelOpen ? 'ri-close-line rotate-90' : 'ri-add-line'}`} />
          </button>
        </div>
      </div>

      {/* Rueda 3D — el resto de funciones, girando de lado a lado */}
      {wheelOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setWheelOpen(false)}>
          <div className="absolute inset-0 bg-black/55 wheel-backdrop-in" />
          <div className="absolute left-0 right-0 bottom-[100px] wheel-panel-in" onClick={(e) => e.stopPropagation()}>
            {wheelItems[centeredIdx] && (
              <div className="text-center mb-4 px-6">
                <p className="text-white font-semibold text-sm">{label(wheelItems[centeredIdx])}</p>
                {wheelItems[centeredIdx].section && (
                  <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    {wheelItems[centeredIdx].section}
                  </p>
                )}
              </div>
            )}
            <div
              ref={trackRef}
              onScroll={handleScroll}
              className="wheel-track flex items-center gap-4 overflow-x-auto"
              style={{
                paddingLeft: 'calc(50% - 28px)',
                paddingRight: 'calc(50% - 28px)',
                touchAction: 'pan-x',
                overscrollBehaviorX: 'contain',
                perspective: '700px',
              }}
            >
              {wheelItems.map((item, idx) => {
                const active = idx === centeredIdx;
                return (
                  <button
                    key={item.path}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    // Tocar cualquier icono navega directo (no hace falta centrarlo
                    // primero); girar la rueda con el dedo también los mueve y va
                    // agrandando el que queda de frente en el centro.
                    onClick={() => {
                      navigate(item.path);
                      setWheelOpen(false);
                    }}
                    className={`wheel-item flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-[background-color,color] duration-200 ${
                      active ? 'bottom-nav-item-active text-white' : 'bg-white/10 text-white/55'
                    }`}
                  >
                    <i className={`${(item as NavItem).locked ? 'ri-lock-line' : item.icon} ${active ? 'text-2xl' : 'text-lg'}`} />
                  </button>
                );
              })}
            </div>
            <p className="text-center text-white/35 text-[11px] mt-3">← gira la rueda para ver más →</p>
          </div>
        </div>
      )}
    </>
  );
}
