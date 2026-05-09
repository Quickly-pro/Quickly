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
    '/perfil',
    '/configuracion',
  ],
  empleado: [
    '/',
    '/rutas',
    '/mapa-reparto',
    '/hoja-ruta',
    '/hoja-pedidos',
    '/cuadrante',
    '/albaranes',
    '/incidencias',
    '/incid-vehiculo',
    '/vehiculos',
    '/comunicacion',
    '/email',
    '/notificaciones',
    '/documentos',
    '/sugerencias',
    '/legales',
    '/calendario',
    '/control-horario',
    '/perfil',
    '/configuracion',
  ],
  cliente: [
    '/',
    '/productos',
    '/facturacion',
    '/comunicacion',
    '/email',
    '/notificaciones',
    '/sugerencias',
    '/legales',
    '/perfil',
    '/configuracion',
  ],
  guest: [],
};

// Verifica si una ruta está permitida para un rol
export function canAccessRoute(role: UserRole, path: string): boolean {
  if (role === 'empresa') return true;
  const allowed = ROUTE_PERMISSIONS[role] || [];
  // Coincidencia exacta o ruta padre
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
  // GESTIÓN EMPRESARIAL - solo empresa
  { path: '/', label: 'Dashboard', icon: 'ri-dashboard-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/clientes', label: 'Gestión de Clientes', icon: 'ri-team-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/rutas', label: 'Rutas y Localización', icon: 'ri-map-2-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/productos', label: 'Productos y Stock', icon: 'ri-box-3-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa', 'cliente'] },
  { path: '/pedidos', label: 'Gestión de Pedidos', icon: 'ri-shopping-cart-2-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'] },
  { path: '/facturacion', label: 'Facturación y Cobros', icon: 'ri-bill-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa', 'cliente'] },
  { path: '/albaranes', label: 'Albaranes', icon: 'ri-file-paper-2-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa', 'empleado'] },
  { path: '/incidencias', label: 'Incidencias y Tickets', icon: 'ri-error-warning-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa', 'empleado'] },
  { path: '/incid-vehiculo', label: 'Incid. Vehículo', icon: 'ri-car-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'], premium: true },
  { path: '/vehiculos', label: 'Vehículos', icon: 'ri-truck-line', section: 'GESTIÓN EMPRESARIAL', roles: ['empresa'], premium: true },

  // OPERACIONES - empresa + empleado
  { path: '/mapa-reparto', label: 'Mapa de Reparto', icon: 'ri-map-pin-line', section: 'OPERACIONES', roles: ['empresa', 'empleado'] },
  { path: '/hoja-ruta', label: 'Hoja de Ruta', icon: 'ri-route-line', section: 'OPERACIONES', roles: ['empresa', 'empleado'] },
  { path: '/hoja-pedidos', label: 'Hoja de Pedidos', icon: 'ri-file-list-3-line', section: 'OPERACIONES', roles: ['empresa', 'empleado'] },
  { path: '/cuadrante', label: 'Cuadrante', icon: 'ri-calendar-check-line', section: 'OPERACIONES', roles: ['empresa', 'empleado'] },

  // EMPRESA - solo empresa
  { path: '/empresa', label: 'Perfil Empresa', icon: 'ri-building-2-line', section: 'EMPRESA', roles: ['empresa'] },
  { path: '/empleados', label: 'Empleados', icon: 'ri-user-settings-line', section: 'EMPRESA', roles: ['empresa'] },
  { path: '/combustible', label: 'Combustible', icon: 'ri-gas-station-line', section: 'EMPRESA', roles: ['empresa'], premium: true },
  { path: '/estadisticas', label: 'Estadísticas', icon: 'ri-bar-chart-box-line', section: 'EMPRESA', roles: ['empresa'], premium: true },
  { path: '/calendario', label: 'Calendario', icon: 'ri-calendar-line', section: 'EMPRESA', roles: ['empresa', 'empleado'] },
  { path: '/control-horario', label: 'Control Horario', icon: 'ri-time-line', section: 'EMPRESA', roles: ['empresa', 'empleado'] },

  // COMUNICACIÓN - todos (incluido cliente)
  { path: '/comunicacion', label: 'Chat General', icon: 'ri-chat-3-line', section: 'COMUNICACIÓN', roles: ['empresa', 'empleado', 'cliente'] },
  { path: '/email', label: 'Correo', icon: 'ri-mail-line', section: 'COMUNICACIÓN', roles: ['empresa', 'empleado', 'cliente'], premium: true },
  { path: '/notificaciones', label: 'Notificaciones', icon: 'ri-notification-3-line', section: 'COMUNICACIÓN', roles: ['empresa', 'empleado', 'cliente'] },

  // DOCUMENTOS - empresa + empleado
  { path: '/documentos', label: 'Documentos', icon: 'ri-folder-3-line', section: 'DOCUMENTOS', roles: ['empresa', 'empleado'] },
  { path: '/hoja-calculo', label: 'Hoja de Cálculo', icon: 'ri-table-line', section: 'DOCUMENTOS', roles: ['empresa'], premium: true },

  // ASISTENTE IA - premium
  { path: '/asistente', label: 'Asistente IA', icon: 'ri-sparkling-line', section: 'ASISTENTE', roles: ['empresa'], premium: true },

  // APP - todos (incluido cliente)
  { path: '/sugerencias', label: 'Sugerencias', icon: 'ri-lightbulb-line', section: 'APP', roles: ['empresa', 'empleado', 'cliente'] },
  { path: '/legales', label: 'Privacidad y Términos', icon: 'ri-shield-check-line', section: 'APP', roles: ['empresa', 'empleado', 'cliente'] },
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
