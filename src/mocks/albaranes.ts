// Datos mock para Albaranes (delivery notes)
// Estados: pendiente | en-reparto | entregado | rechazado | facturado

export type AlbaranStatus = 'pendiente' | 'en-reparto' | 'entregado' | 'rechazado' | 'facturado';

export interface AlbaranItem {
  product: string;
  qty: number;
  unit?: string;
  price?: number;
  total?: number;
  notes?: string;
}

export interface Albaran {
  id: string;
  client: string;
  clientAddress: string;
  clientPhone?: string;
  clientEmail?: string;
  date: string;            // fecha emisión
  deliveryDate?: string;   // fecha entrega prevista
  deliveredAt?: string;    // timestamp entrega real
  deliveredBy?: string;    // empleado que entregó
  driver?: string;         // repartidor asignado
  vehicle?: string;        // vehículo asignado
  status: AlbaranStatus;
  items: AlbaranItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  signature?: string;      // base64 o nombre/firma
  invoiceId?: string;      // si se ha facturado
  rejectReason?: string;
  routeId?: string;        // ruta asociada
  orderId?: string;        // pedido asociado
}

export const albaranes: Albaran[] = [
  {
    id: 'A-2026-0078',
    client: 'Restaurante El Pino',
    clientAddress: 'C/ Mayor 12, Madrid',
    clientPhone: '+34 91 555 12 34',
    clientEmail: 'pedidos@elpino.es',
    date: '2026-05-05',
    deliveryDate: '2026-05-06',
    driver: 'Juan García',
    vehicle: 'Furgoneta 01 (1234-ABC)',
    status: 'en-reparto',
    items: [
      { product: 'Aceite Oliva Virgen Extra 5L', qty: 10, unit: 'caja', price: 35, total: 350 },
      { product: 'Harina de Trigo 10kg', qty: 20, unit: 'saco', price: 15, total: 300 },
      { product: 'Leche Entera Brick 1L (pack 6)', qty: 50, unit: 'pack', price: 7.5, total: 375 },
    ],
    subtotal: 1025,
    tax: 215.25,
    total: 1240.25,
    routeId: 'R-001',
    orderId: 'P-2026-1042',
  },
  {
    id: 'A-2026-0077',
    client: 'Bar La Plaza',
    clientAddress: 'Plaza España 4, Madrid',
    clientPhone: '+34 91 555 99 88',
    date: '2026-05-04',
    deliveryDate: '2026-05-05',
    deliveredAt: '2026-05-05T11:42:00',
    deliveredBy: 'María López',
    driver: 'María López',
    vehicle: 'Furgoneta 02 (5678-DEF)',
    status: 'entregado',
    items: [
      { product: 'Cerveza Rubia Pack 24', qty: 25, unit: 'pack', price: 15, total: 375 },
      { product: 'Refrescos Surtidos (pack 12)', qty: 30, unit: 'pack', price: 10.5, total: 315 },
      { product: 'Agua Mineral 1.5L (pack 6)', qty: 40, unit: 'pack', price: 4.5, total: 180 },
    ],
    subtotal: 870,
    tax: 182.7,
    total: 1052.7,
    signature: 'Antonio Pérez (firma digital)',
    invoiceId: 'F-2026-0041',
    routeId: 'R-002',
    orderId: 'P-2026-1041',
  },
  {
    id: 'A-2026-0076',
    client: 'Supermercado MercaMax',
    clientAddress: 'Av. Industria 88, Alcobendas',
    clientPhone: '+34 91 555 77 66',
    date: '2026-05-03',
    deliveryDate: '2026-05-04',
    deliveredAt: '2026-05-04T09:15:00',
    deliveredBy: 'Carlos Ruiz',
    driver: 'Carlos Ruiz',
    vehicle: 'Furgoneta 03 (9012-GHI)',
    status: 'entregado',
    items: [
      { product: 'Aceite Oliva Virgen Extra 5L', qty: 50, unit: 'caja', price: 35, total: 1750 },
      { product: 'Leche Entera Brick 1L (pack 6)', qty: 100, unit: 'pack', price: 7.5, total: 750 },
      { product: 'Harina de Trigo 10kg', qty: 60, unit: 'saco', price: 15, total: 900 },
    ],
    subtotal: 3400,
    tax: 714,
    total: 4114,
    signature: 'Lucía Fernández - Jefa de almacén',
    routeId: 'R-001',
    orderId: 'P-2026-1040',
  },
  {
    id: 'A-2026-0075',
    client: 'Cafetería Central',
    clientAddress: 'C/ del Sol 23, Madrid',
    clientPhone: '+34 91 555 33 22',
    date: '2026-05-02',
    deliveryDate: '2026-05-03',
    status: 'pendiente',
    items: [
      { product: 'Café Molido 1kg', qty: 5, unit: 'bolsa', price: 12, total: 60 },
      { product: 'Leche Entera Brick 1L (pack 6)', qty: 30, unit: 'pack', price: 7.5, total: 225 },
      { product: 'Azúcar Blanco 1kg (pack 10)', qty: 10, unit: 'pack', price: 15, total: 150 },
    ],
    subtotal: 435,
    tax: 91.35,
    total: 526.35,
    notes: 'Entregar antes de las 11:00. Llamar al portero.',
  },
  {
    id: 'A-2026-0074',
    client: 'Panadería La Espiga',
    clientAddress: 'C/ Hornos 5, Madrid',
    date: '2026-05-01',
    deliveryDate: '2026-05-02',
    deliveredAt: '2026-05-02T07:30:00',
    deliveredBy: 'Pedro Sánchez',
    status: 'rechazado',
    items: [
      { product: 'Harina de Trigo 10kg', qty: 30, unit: 'saco', price: 15, total: 450 },
    ],
    subtotal: 450,
    tax: 94.5,
    total: 544.5,
    rejectReason: 'Cliente alega humedad en sacos. Devolución completa.',
  },
  {
    id: 'A-2026-0073',
    client: 'Hotel Las Brisas',
    clientAddress: 'Paseo Marítimo 78, Madrid',
    date: '2026-04-29',
    deliveryDate: '2026-04-30',
    deliveredAt: '2026-04-30T10:00:00',
    deliveredBy: 'Ana Martínez',
    status: 'facturado',
    items: [
      { product: 'Vino Tinto Reserva', qty: 40, unit: 'botella', price: 18, total: 720 },
      { product: 'Cerveza Rubia Pack 24', qty: 20, unit: 'pack', price: 15, total: 300 },
      { product: 'Agua Mineral 1.5L (pack 6)', qty: 60, unit: 'pack', price: 4.5, total: 270 },
    ],
    subtotal: 1290,
    tax: 270.9,
    total: 1560.9,
    signature: 'Recep. Hotel - Marina Soto',
    invoiceId: 'F-2026-0040',
  },
];

export const STATUS_LABEL: Record<AlbaranStatus, string> = {
  pendiente: 'Pendiente',
  'en-reparto': 'En reparto',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
  facturado: 'Facturado',
};

export const STATUS_COLOR: Record<AlbaranStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  'en-reparto': 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
  entregado: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800/40',
  rechazado: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/40',
  facturado: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
};

export const STATUS_ICON: Record<AlbaranStatus, string> = {
  pendiente: 'ri-time-line',
  'en-reparto': 'ri-truck-line',
  entregado: 'ri-check-double-line',
  rechazado: 'ri-close-circle-line',
  facturado: 'ri-bill-line',
};
