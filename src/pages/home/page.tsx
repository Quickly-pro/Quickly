import { useRole } from '@/hooks/useRole';
import EmpresaDashboard from './components/EmpresaDashboard';
import EmpleadoDashboard from './components/EmpleadoDashboard';
import ClienteDashboard from './components/ClienteDashboard';
import GuestDashboard from './components/GuestDashboard';

export default function Home() {
  const { isEmpresa, isEmpleado, isCliente, isGuest, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (isEmpresa) return <EmpresaDashboard />;
  if (isEmpleado) return <EmpleadoDashboard />;
  if (isCliente) return <ClienteDashboard />;
  return <GuestDashboard />;
}
