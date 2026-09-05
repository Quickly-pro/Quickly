import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { canAccessRoute } from '@/lib/permissions';
import { AlertTriangle } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Rutas que deben poder abrirse SIN sesión iniciada (ej. la política de
// privacidad la tiene que poder leer Google Play / cualquier visitante,
// no solo usuarios ya logueados).
const PUBLIC_PATHS = ['/legales'];

export default function RoleGuard({ children, fallback }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const { role } = useRole();
  const location = useLocation();

  if (PUBLIC_PATHS.includes(location.pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Sin sesión = redirigir a login obligatorio
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Cuenta autenticada pero sin perfil real en la base de datos (el trigger
  // handle_new_user no llegó a crearlo, o falló). No se le da acceso de
  // ningún tipo por defecto — se muestra un aviso en vez de redirigir en
  // bucle a "/" (que también le estaría vedado) o de tratarla como admin.
  if (role === 'guest') {
    return (
      <div className="min-h-[300px] flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3 max-w-sm">
          <AlertTriangle className="w-8 h-8 text-orange-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Tu cuenta todavía no tiene un perfil configurado
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Cierra sesión y vuelve a registrarte, o contacta con soporte si el problema continúa.
          </p>
        </div>
      </div>
    );
  }

  // Si el rol no tiene acceso a esta ruta
  if (!canAccessRoute(role, location.pathname)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Redirigir al dashboard o página principal según el rol
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}