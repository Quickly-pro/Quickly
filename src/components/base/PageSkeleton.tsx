export default function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Cabecera de página */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-gray-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-4 w-28 bg-gray-100 dark:bg-slate-800 rounded" />
        </div>
        <div className="h-9 w-28 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Fila de tarjetas de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl"
          />
        ))}
      </div>

      {/* Bloque de contenido principal */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
        {/* Barra de herramientas */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex gap-3">
          <div className="h-8 w-36 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 w-24 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </div>
        {/* Filas de lista */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="px-4 py-3 border-b border-gray-50 dark:border-slate-800 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-100 dark:bg-slate-800 rounded w-3/5" />
              <div className="h-3 bg-gray-50 dark:bg-slate-700 rounded w-2/5" />
            </div>
            <div className="h-6 w-16 bg-gray-100 dark:bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
