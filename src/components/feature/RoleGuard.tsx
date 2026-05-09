import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { canAccessRoute } from '@/lib/permissions';

interface RoleGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RoleGuard({ children, fallback }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const { role } = useRole();
  const location = useLocation();

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