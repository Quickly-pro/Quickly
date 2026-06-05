export const dashboardStats = {
  totalInvoices: 128,
  pendingInvoices: 34,
  totalRevenue: 45280.5,
  activeClients: 156,
  lowStockProducts: 12,
  activeRoutes: 8,
  todayDeliveries: 45,
  fuelToday: 124.5,
};

export const recentActivities = [
  { id: 1, type: 'invoice', description: 'Factura #F-2026-0042 generada - Cliente: Distribuciones García', time: 'Hace 5 min', icon: 'ri-bill-line' },
  { id: 2, type: 'delivery', description: 'Entrega completada - Ruta 3, Parada 7', time: 'Hace 12 min', icon: 'ri-truck-line' },
  { id: 3, type: 'stock', description: 'Alerta stock bajo - Producto: Palet estándar 120x80', time: 'Hace 25 min', icon: 'ri-alert-line' },
  { id: 4, type: 'fuel', description: 'Repostaje registrado - Camión TIR-03, 180L', time: 'Hace 42 min', icon: 'ri-gas-station-line' },
  { id: 5, type: 'client', description: 'Nuevo cliente registrado - Logística Norte S.L.', time: 'Hace 1 hora', icon: 'ri-user-add-line' },
  { id: 6, type: 'incident', description: 'Incidencia resuelta - Trailer TR-01, pinchazo', time: 'Hace 2 horas', icon: 'ri-check-double-line' },
];

export const monthlyRevenue = [
  { month: 'Ene', amount: 32500 },
  { month: 'Feb', amount: 38100 },
  { month: 'Mar', amount: 29400 },
  { month: 'Abr', amount: 45280 },
  { month: 'May', amount: 41200 },
  { month: 'Jun', amount: 38900 },
];

export const topProducts = [
  { id: 1, name: 'Aceite Oliva Virgen Extra 5L', sales: 245, revenue: 8575 },
  { id: 2, name: 'Leche Entera Brick 1L (pack 6)', sales: 189, revenue: 5670 },
  { id: 3, name: 'Harina de Trigo 10kg', sales: 156, revenue: 2340 },
  { id: 4, name: 'Cerveza Rubia Pack 24', sales: 134, revenue: 4020 },
  { id: 5, name: 'Agua Mineral 1.5L (pack 6)', sales: 112, revenue: 1120 },
];

export const routeStatus = [
  { id: 1, name: 'Ruta Centro', driver: 'Carlos Martínez', progress: 85, stops: 12, completed: 10, status: 'active' },
  { id: 2, name: 'Ruta Norte', driver: 'Ana López', progress: 60, stops: 8, completed: 5, status: 'active' },
  { id: 3, name: 'Ruta Este', driver: 'Miguel García', progress: 30, stops: 10, completed: 3, status: 'active' },
  { id: 4, name: 'Ruta Sur', driver: 'Laura Fernández', progress: 0, stops: 9, completed: 0, status: 'planned' },
];