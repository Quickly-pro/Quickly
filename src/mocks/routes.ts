export const routes = [
  {
    id: 1,
    name: 'Ruta Centro',
    driver: 'Carlos Martínez',
    vehicle: 'Furgoneta F-01',
    date: '2026-04-30',
    stops: [
      { id: 1, client: 'Restaurante El Pino', address: 'Calle Mayor 45, Madrid', lat: 40.4168, lng: -3.7038, status: 'completed', time: '08:30' },
      { id: 2, client: 'Bar La Plaza', address: 'Plaza España 12, Madrid', lat: 40.4230, lng: -3.7120, status: 'completed', time: '09:00' },
      { id: 3, client: 'Cafetería Central', address: 'Gran Vía 100, Madrid', lat: 40.4200, lng: -3.7050, status: 'in_progress', time: '09:30' },
      { id: 4, client: 'Tapería Moderna', address: 'Calle Nueva 55, Madrid', lat: 40.4180, lng: -3.7100, status: 'pending', time: '10:00' },
    ],
    status: 'active',
    startTime: '08:00',
    estimatedEnd: '12:00',
  },
  {
    id: 2,
    name: 'Ruta Norte',
    driver: 'Ana López',
    vehicle: 'Furgoneta F-02',
    date: '2026-04-30',
    stops: [
      { id: 1, client: 'Supermercado MercaMax', address: 'Avenida Industria 88, Madrid', lat: 40.4500, lng: -3.6800, status: 'completed', time: '08:15' },
      { id: 2, client: 'Pizzería Napoli', address: 'Calle Italia 23, Madrid', lat: 40.4450, lng: -3.6750, status: 'in_progress', time: '09:00' },
      { id: 3, client: 'Bar El Rincón', address: 'Calle Pequeña 3, Madrid', lat: 40.4480, lng: -3.6780, status: 'pending', time: '09:45' },
    ],
    status: 'active',
    startTime: '08:00',
    estimatedEnd: '11:30',
  },
  {
    id: 3,
    name: 'Ruta Sur',
    driver: 'Miguel García',
    vehicle: 'Furgoneta F-03',
    date: '2026-04-30',
    stops: [
      { id: 1, client: 'Restaurante La Cueva', address: 'Calle Cueva 8, Madrid', lat: 40.3800, lng: -3.7200, status: 'pending', time: '14:00' },
    ],
    status: 'planned',
    startTime: '14:00',
    estimatedEnd: '15:30',
  },
];

export const vehicles = [
  { id: 'F-01', model: 'Mercedes Sprinter', year: 2023, mileage: 45230, lastService: '2026-03-15', nextService: '2026-06-15', fuelType: 'Diésel' },
  { id: 'F-02', model: 'Ford Transit', year: 2022, mileage: 67890, lastService: '2026-02-20', nextService: '2026-05-20', fuelType: 'Diésel' },
  { id: 'F-03', model: 'Volkswagen Crafter', year: 2024, mileage: 12340, lastService: '2026-04-01', nextService: '2026-07-01', fuelType: 'Diésel' },
];