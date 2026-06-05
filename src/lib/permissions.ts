// Sistema de permisos por rol
export type UserRole = 'empresa' | 'empleado' | 'cliente' | 'guest';

// Normaliza cualquier string de rol a uno conocido
export function normalizeRole(raw: string | null | undefined): UserRole {
  if (!raw) return 'guest';
  const lower = raw.toLowerCase().trim();
  if (lower === 'empresa' || lower === 'administrador' || lower === 'admin' || lower === 'dirección') {
    return 'empresa';
  }
  if (lower === 'empleado' || lower === 'repartidor' || lower === 'operario' || lower === 'conductor') {
    return 'empleado';
  }
  if (lower === 'cliente' || lower === 'customer') {
    return 'cliente';
  }
  return 'guest';
}

// Rutas permitidas por cada rol
export const ROUTE_PERMISSIONS: Record<UserRole, string[]> = {
  empresa: [
    '/',
    '/clientes',
    '/rutas',
    '/productos',
    '/pedidos',
    '/facturacion',
    '/albaranes',
    '/incidencias',
    '/incid-vehiculo',
    '/vehiculos',
    '/mapa-reparto',
    '/hoja-ruta',
    '/hoja-pedidos',
    '/cuadrante',
    '/empresa',
    '/empleados',
    '/combustible',
    '/comunicacion',
    '/email',
    '/notificaciones',
    '/documentos',
    '/hoja-calculo',
    '/sugerencias',
    '/legales',
    '/estadisticas',
    '/calendario',
    '/control-horario',
    '/asistente',
    '/perfil',
    '/configuracion',
  ],
  empleado: [
    '/',
    '/mapa-reparto',
    '/hoja-ruta',
    '/hoja-pedidos',
    '/cuadrante',
    '/albaranes',
    '/incidencias',
    '/incid-vehiculo',
    '/vehiculos',
    '/calendario',
    '/control-horario',
    '/comunicacion',
    '/notificaciones',
    '/documentos',
    '/perfil',
    '/configuracion',
  ],
  cliente: [
    '/',
    '/productos',
    '/pedidos',
    '/facturacion',
    '/empresa',
    '/mapa-reparto',
    '/incidencias',
    '/comunicacion',
    '/email',
    '/notificaciones',
    '/perfil',
    '/configuracion',
  ],
  guest: [],
};

// Verifica si una ruta está permitida para un rol
export function canAccessRoute(role: UserRole, path: string): boolean {
  if (role === 'empresa') return true;
  const allowed = ROUTE_PERMISSIONS[role] || [];
  return allowed.some(allowedPath =>
    path === allowedPath ||
    (allowedPath !== '/' && path.startsWith(allowedPath + '/'))
  );
}

// Sidebar items filtrados por rol
interface SidebarItem {
  path: string;
  label: string;
  icon: string;
  section: string;
  roles: UserRole[];
  premium?: boolean;
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  // ── EMPRESA: acceso total ─────────────────────────────────────────
  { path: '/',               label: 'Dashboard',           icon: 'ri-dashboard-line',        section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/clientes',       label: 'Gestión de Clientes', icon: 'ri-team-line',              section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/rutas',          label: 'Rutas y Localización', icon: 'ri-map-2-line',            section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/productos',      label: 'Productos y Stock',   icon: 'ri-box-3-line',             section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/pedidos',        label: 'Gestión de Pedidos',  icon: 'ri-shopping-cart-2-line',   section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/facturacion',    label: 'Facturas',             icon: 'ri-bill-line',             section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/albaranes',      label: 'Albaranes',           icon: 'ri-file-paper-2-line',      section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/incidencias',    label: 'Incidencias y Tickets', icon: 'ri-error-warning-line',   section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/incid-vehiculo', label: 'Incid. Vehículo',     icon: 'ri-car-line',               section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'], premium: true },
  { path: '/vehiculos',      label: 'Vehículos',           icon: 'ri-truck-line',             section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'], premium: true },

  { path: '/mapa-reparto',   label: 'Rutas y Localización', icon: 'ri-route-line',             section: 'OPERACIONES',         roles: ['empresa'] },
  { path: '/hoja-ruta',      label: 'Hoja de Ruta',        icon: 'ri-route-line',             section: 'OPERACIONES',         roles: ['empresa'] },
  { path: '/hoja-pedidos',   label: 'Hoja de Pedidos',     icon: 'ri-file-list-3-line',       section: 'OPERACIONES',         roles: ['empresa'] },
  { path: '/cuadrante',      label: 'Cuadrante',           icon: 'ri-calendar-check-line',    section: 'OPERACIONES',         roles: ['empresa'] },

  { path: '/empresa',        label: 'Perfil Empresa',      icon: 'ri-building-2-line',        section: 'EMPRESA',             roles: ['empresa'] },
  { path: '/empleados',      label: 'Empleados',           icon: 'ri-user-settings-line',     section: 'EMPRESA',             roles: ['empresa'] },
  { path: '/combustible',    label: 'Combustible',         icon: 'ri-gas-station-line',       section: 'EMPRESA',             roles: ['empresa'], premium: true },
  { path: '/estadisticas',   label: 'Estadísticas',        icon: 'ri-bar-chart-box-line',     section: 'EMPRESA',             roles: ['empresa'], premium: true },
  { path: '/calendario',     label: 'Calendario',          icon: 'ri-calendar-line',          section: 'EMPRESA',             roles: ['empresa'] },
  { path: '/control-horario', label: 'Control Horario',    icon: 'ri-time-line',              section: 'EMPRESA',             roles: ['empresa'] },

  { path: '/comunicacion',   label: 'Chat General',        icon: 'ri-chat-3-line',            section: 'COMUNICACIÓN',        roles: ['empresa'] },
  { path: '/email',          label: 'Correo',              icon: 'ri-mail-line',              section: 'COMUNICACIÓN',        roles: ['empresa'] },
  { path: '/notificaciones', label: 'Notificaciones',      icon: 'ri-notification-3-line',    section: 'COMUNICACIÓN',        roles: ['empresa'] },

  { path: '/documentos',     label: 'Documentos',          icon: 'ri-folder-3-line',          section: 'DOCUMENTOS',          roles: ['empresa'] },
  { path: '/hoja-calculo',   label: 'Hoja de Cálculo',     icon: 'ri-table-line',             section: 'DOCUMENTOS',          roles: ['empresa'], premium: true },

  { path: '/asistente',      label: 'Asistente IA',        icon: 'ri-sparkling-line',         section: 'ASISTENTE',           roles: ['empresa'], premium: true },

  { path: '/sugerencias',    label: 'Sugerencias',         icon: 'ri-lightbulb-line',         section: 'APP',                 roles: ['empresa'] },
  { path: '/legales',        label: 'Privacidad y Términos', icon: 'ri-shield-check-line',    section: 'APP',                 roles: ['empresa'] },

  // ── EMPLEADO: herramientas operativas ────────────────────────────
  { path: '/',               label: 'Inicio',              icon: 'ri-home-5-line',            section: 'INICIO',              roles: ['empleado'] },

  { path: '/mapa-reparto',   label: 'Rutas y Localización', icon: 'ri-route-line',             section: 'OPERACIONES',         roles: ['empleado'] },
  { path: '/hoja-ruta',      label: 'Hoja de Ruta',        icon: 'ri-route-line',             section: 'OPERACIONES',         roles: ['empleado'] },
  { path: '/hoja-pedidos',   label: 'Hoja de Pedidos',     icon: 'ri-file-list-3-line',       section: 'OPERACIONES',         roles: ['empleado'] },
  { path: '/cuadrante',      label: 'Cuadrante',           icon: 'ri-calendar-check-line',    section: 'OPERACIONES',         roles: ['empleado'] },

  { path: '/albaranes',      label: 'Albaranes',           icon: 'ri-file-paper-2-line',      section: 'GESTIÓN',             roles: ['empleado'] },
  { path: '/incidencias',    label: 'Incidencias',         icon: 'ri-error-warning-line',     section: 'GESTIÓN',             roles: ['empleado'] },
  { path: '/incid-vehiculo', label: 'Incid. Vehículo',     icon: 'ri-car-line',               section: 'GESTIÓN',             roles: ['empleado'] },
  { path: '/vehiculos',      label: 'Vehículos',           icon: 'ri-truck-line',             section: 'GESTIÓN',             roles: ['empleado'] },

  { path: '/calendario',     label: 'Calendario',          icon: 'ri-calendar-line',          section: 'PERSONAL',            roles: ['empleado'] },
  { path: '/control-horario', label: 'Control Horario',    icon: 'ri-time-line',              section: 'PERSONAL',            roles: ['empleado'] },
  { path: '/documentos',     label: 'Documentos',          icon: 'ri-folder-3-line',          section: 'PERSONAL',            roles: ['empleado'] },

  { path: '/comunicacion',   label: 'Chat',                icon: 'ri-chat-3-line',            section: 'COMUNICACIÓN',        roles: ['empleado'] },
  { path: '/notificaciones', label: 'Notificaciones',      icon: 'ri-notification-3-line',    section: 'COMUNICACIÓN',        roles: ['empleado'] },

  // ── CLIENTE: vista del cliente ───────────────────────────────────
  { path: '/',               label: 'Inicio',              icon: 'ri-home-5-line',            section: 'INICIO',              roles: ['cliente'] },

  { path: '/productos',      label: 'Productos',           icon: 'ri-box-3-line',             section: 'MIS PEDIDOS',         roles: ['cliente'] },
  { path: '/pedidos',        label: 'Mis Pedidos',         icon: 'ri-shopping-cart-2-line',   section: 'MIS PEDIDOS',         roles: ['cliente'] },
  { path: '/facturacion',    label: 'Facturas',             icon: 'ri-bill-line',              section: 'MIS PEDIDOS',         roles: ['cliente'] },

  { path: '/empresa',        label: 'Mi Proveedor',        icon: 'ri-building-2-line',        section: 'EMPRESA',             roles: ['cliente'] },
  { path: '/mapa-reparto',   label: 'Rutas y Localización', icon: 'ri-route-line',             section: 'EMPRESA',             roles: ['cliente'] },

  { path: '/incidencias',    label: 'Mis Incidencias',     icon: 'ri-error-warning-line',     section: 'SOPORTE',             roles: ['cliente'] },

  { path: '/comunicacion',   label: 'Chat',                icon: 'ri-chat-3-line',            section: 'COMUNICACIÓN',        roles: ['cliente'] },
  { path: '/email',          label: 'Correo',              icon: 'ri-mail-line',              section: 'COMUNICACIÓN',        roles: ['cliente'] },
  { path: '/notificaciones', label: 'Notificaciones',      icon: 'ri-notification-3-line',    section: 'COMUNICACIÓN',        roles: ['cliente'] },
];

// Agrupa los items del sidebar por sección, filtrando por rol
export function getSidebarSections(role: UserRole) {
  const filtered = SIDEBAR_ITEMS.filter(item => item.roles.includes(role));
  const sectionsMap = new Map<string, typeof filtered>();
  filtered.forEach(item => {
    const existing = sectionsMap.get(item.section) || [];
    existing.push(item);
    sectionsMap.set(item.section, existing);
  });
  return Array.from(sectionsMap.entries()).map(([section, items]) => ({
    section,
    items: items.map(i => ({
      path: i.path,
      label: i.label,
      icon: i.icon,
      premium: i.premium,
    })),
  }));
}
