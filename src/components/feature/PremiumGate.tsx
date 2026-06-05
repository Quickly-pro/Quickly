import { useNavigate } from 'react-router-dom';
import { usePremium } from '@/hooks/usePremium';
import { useRole } from '@/hooks/useRole';

interface PremiumGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PremiumGate({ children, fallback }: PremiumGateProps) {
  const { isPremium, loading, isTrial, trialDaysLeft } = usePremium();
  const { isCliente, isEmpleado } = useRole();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Empleados y clientes: sin acceso a funciones premium
  if (isCliente || isEmpleado) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-lock-line text-gray-400 dark:text-slate-500 text-2xl" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-slate-200 mb-2">Acceso restringido</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Esta sección sólo está disponible para cuentas de empresa.
          </p>
        </div>
      </div>
    );
  }

  // Empresa con premium activo: acceso total
  if (isPremium) {
    return <>{children}</>;
  }

  // Empresa sin premium: pantalla de upgrade
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <div className="w-10 h-10 flex items-center justify-center">
            <i className="ri-vip-crown-line text-amber-500 text-3xl" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Función Premium</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
          Este apartado está disponible exclusivamente para usuarios con plan Premium.
          {isTrial && trialDaysLeft > 0 && (
            <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
              Tu prueba gratuita finaliza en {trialDaysLeft} días.
            </span>
          )}
        </p>

        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-5 mb-6 text-left space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 text-center mb-3">Incluye:</p>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <i className="ri-check-line text-green-500 text-sm" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Asistente IA inteligente</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Consulta datos, rutas y facturas por voz</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <i className="ri-check-line text-green-500 text-sm" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Estadísticas avanzadas</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Gráficos detallados de ventas, combustible y horas</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <i className="ri-check-line text-green-500 text-sm" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Gestión de flota completa</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Camiones, trailers, furgonetas y motos — incidencias y combustible</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <i className="ri-check-line text-green-500 text-sm" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Hoja de cálculo integrada</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Exporta datos con colores diferenciados</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <i className="ri-check-line text-green-500 text-sm" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Correo electrónico</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Bandeja integrada para clientes y proveedores</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/upgrade-premium')}
          className="w-full px-6 py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-vip-crown-fill" />
          </div>
          Ver planes Premium
        </button>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
          Sin compromiso. Cancela cuando quieras.
        </p>
      </div>
    </div>
  );
}
