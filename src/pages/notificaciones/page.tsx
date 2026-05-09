import { Link } from 'react-router-dom';
import { useNotificationsContext } from '@/context/NotificationsContext';

export default function Notificaciones() {
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotificationsContext();

  const getIconForType = (type: string) => {
    switch (type) {
      case 'stock': return 'ri-box-3-line text-red-500';
      case 'route': return 'ri-truck-line text-blue-500';
      case 'invoice': return 'ri-bill-line text-amber-500';
      case 'order': return 'ri-shopping-cart-2-line text-green-500';
      default: return 'ri-notification-3-line text-gray-500';
    }
  };

  const getBgForType = (type: string) => {
    switch (type) {
      case 'stock': return 'bg-red-50';
      case 'route': return 'bg-blue-50';
      case 'invoice': return 'bg-amber-50';
      case 'order': return 'bg-green-50';
      default: return 'bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'stock': return 'Stock';
      case 'route': return 'Ruta';
      case 'invoice': return 'Factura';
      case 'order': return 'Pedido';
      default: return 'Sistema';
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notificaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount} sin leer · {notifications.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-all whitespace-nowrap"
            >
              Marcar todas leídas
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-all whitespace-nowrap"
            >
              Limpiar todo
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-notification-off-line text-gray-400 text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay notificaciones</h3>
            <p className="text-sm text-gray-400">Las notificaciones aparecerán automáticamente cuando haya cambios en facturas, rutas o stock.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-all cursor-pointer flex items-start gap-4
                ${n.read ? 'border-gray-100' : 'border-orange-200 bg-orange-50/10'}`}
            >
              <div className={`w-10 h-10 rounded-xl ${getBgForType(n.type)} flex items-center justify-center flex-shrink-0`}>
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className={getIconForType(n.type)} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{getTypeLabel(n.type)}</span>
                  {!n.read && (
                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-semibold">Nuevo</span>
                  )}
                </div>
                <p className="font-semibold text-sm text-gray-800">{n.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{n.text}</p>
                <p className="text-xs text-gray-400 mt-2">{n.time}</p>
              </div>
              {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-2" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}