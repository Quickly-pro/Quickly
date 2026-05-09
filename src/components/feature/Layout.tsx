import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import PageTransition from './PageTransition';
import RoleGuard from './RoleGuard';
import ErrorBoundary from '@/components/base/ErrorBoundary';
import { useAuth } from '@/context/AuthContext';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();

  // Si está cargando auth, mostrar spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario y no está en login, mostrar layout sin sidebar
  // (las rutas protegidas redirigirán a login si es necesario)
  return (
    <div className="min-h-screen bg-gray-50/50 flex dark:bg-slate-950">
      {user && <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />}
      <div className={`flex-1 flex flex-col min-w-0 dark:bg-slate-950 transition-all duration-300
        ${user ? (collapsed ? 'md:ml-16' : 'md:ml-64') : ''}`}>
        <Navbar />
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 dark:bg-slate-950 min-w-0">
          <PageTransition>
            <RoleGuard>
              <ErrorBoundary key={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </RoleGuard>
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
