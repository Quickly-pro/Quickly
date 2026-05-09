import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useNotificationsContext } from '@/context/NotificationsContext';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useClickOutside } from '@/hooks/useClickOutside';

export default function Navbar() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { isDark, toggle } = useTheme();
  const { notifications, unreadCount, markAllRead, markRead } = useNotificationsContext();
  const { data: company } = useCompany();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useClickOutside(notifRef, () => setNotificationsOpen(false), notificationsOpen);
  useClickOutside(profileRef, () => setProfileOpen(false), profileOpen);

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

  const displayName = user?.full_name || 'Invitado';
  const avatarUrl = user?.avatar_url;
  const hasAvatar = !!avatarUrl;
  const isOnline = true; // simplificado

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    window.location.reload();
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-30">
      {/* Breadcrumb / Title with company logo */}
      <div className="ml-10 md:ml-0 flex items-center gap-2 md:gap-2.5 min-w-0">
        <img
          src={company.logo}
          alt={company.name}
          className="w-7 h-7 md:w-8 md:h-8 object-contain rounded flex-shrink-0"
        />
        <div className="min-w-0">
          <h2 className="text-sm md:text-base font-semibold text-gray-800 dark:text-slate-100 truncate">{company.name.split(' ')[0]}</h2>
          <p className="text-[10px] md:text-xs text-gray-400 dark:text-slate-500 hidden sm:block">Panel de Gestión</p>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 md:gap-4 flex-shrink-0">
        {/* Search */}
        <div className="hidden md:flex items-center bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-1.5">
          <div className="w-4 h-4 flex items-center justify-center mr-2">
            <i className="ri-search-line text-gray-400 dark:text-slate-400 text-sm" />
          </div>
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent text-sm text-gray-700 dark:text-slate-200 outline-none w-48"
          />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? (
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-sun-line text-lg text-amber-500" />
            </div>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-moon-line text-lg text-slate-600" />
            </div>
          )}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <i className="ri-notification-3-line text-lg text-gray-600 dark:text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-orange-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="fixed inset-x-2 top-16 sm:absolute sm:right-0 sm:top-12 sm:inset-x-auto sm:w-80 md:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden max-h-[80vh] sm:max-h-[480px] flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
                <span className="font-semibold text-sm text-gray-800 dark:text-slate-100">Notificaciones</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-orange-600 hover:underline">Marcar todas leídas</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="ri-notification-off-line text-gray-400 dark:text-slate-400 text-xl" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400">No hay notificaciones</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`px-4 py-3 border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer flex items-start gap-3 transition-colors
                        ${n.read ? '' : 'bg-orange-50/20 dark:bg-orange-900/10'}`}
                    >
                      <div className={`w-9 h-9 rounded-lg ${getBgForType(n.type)} flex items-center justify-center flex-shrink-0`}>
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className={getIconForType(n.type)} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{n.title}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">{n.text}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{n.time}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />}
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 text-center flex-shrink-0">
                <Link to="/notificaciones" onClick={() => setNotificationsOpen(false)} className="text-sm text-orange-600 hover:underline">Ver todas las notificaciones</Link>
              </div>
            </div>
          )}
        </div>

        {/* Chat */}
        <Link to="/comunicacion" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 relative">
          <i className="ri-chat-1-line text-lg text-gray-600 dark:text-slate-300" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
        </Link>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg px-2 py-1"
          >
            <div className="relative w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden">
              {hasAvatar ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <i className="ri-user-line text-orange-600" />
              )}
              {/* Online / Offline dot */}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                }`}
                title={isOnline ? 'En línea' : 'Sin conexión'}
              />
            </div>
            <span className="hidden md:block text-sm text-gray-700 dark:text-slate-200 font-medium">{displayName}</span>
            <div className="hidden md:flex w-4 h-4 items-center justify-center">
              <i className="ri-arrow-down-s-line text-gray-400 text-xs" />
            </div>
          </button>

          {profileOpen && (
            <div className="fixed inset-x-2 top-16 sm:absolute sm:right-0 sm:top-12 sm:inset-x-auto sm:w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {hasAvatar ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <i className="ri-user-line text-orange-600 text-sm" />
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${
                      isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{displayName}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user?.email || 'Sin sesión'}</p>
                </div>
              </div>
              <div className="py-1">
                <Link to="/perfil" onClick={() => setProfileOpen(false)} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-user-line text-gray-400 dark:text-slate-400" />
                  </div>
                  Perfil
                </Link>
                <Link to="/configuracion" onClick={() => setProfileOpen(false)} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-settings-3-line text-gray-400 dark:text-slate-400" />
                  </div>
                  Configuración
                </Link>
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-logout-box-r-line" />
                    </div>
                    Cerrar sesión
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setProfileOpen(false)}
                    className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-login-box-line" />
                    </div>
                    Iniciar sesión
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}