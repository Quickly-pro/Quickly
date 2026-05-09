import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole, type UserRole, canAccessRoute, getSidebarSections } from '@/lib/permissions';

export function useRole() {
  const { user, loading } = useAuth();

  const role: UserRole = useMemo(() => {
    if (!user) return 'guest';
    return user.role;
  }, [user]);

  const isEmpresa = role === 'empresa';
  const isEmpleado = role === 'empleado';
  const isCliente = role === 'cliente';
  const isGuest = role === 'guest';

  const sidebarSections = useMemo(() => {
    return getSidebarSections(role);
  }, [role]) as {
    section: string;
    items: { path: string; label: string; icon: string; premium?: boolean }[];
  }[];

  const checkAccess = useMemo(() => {
    return (path: string) => canAccessRoute(role, path);
  }, [role]);

  return {
    role,
    isEmpresa,
    isEmpleado,
    isCliente,
    isGuest,
    loading,
    sidebarSections,
    canAccess: checkAccess,
  };
}