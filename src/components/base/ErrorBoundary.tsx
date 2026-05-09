import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Atrapa errores en cualquier página hija para que el sidebar y la app
 * no se queden en blanco si una vista crashea. Muestra los detalles para
 * que sea fácil debuggear.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Page crashed:', error, errorInfo);
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;

    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <i className="ri-error-warning-line text-xl text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">
                Esta vista ha fallado
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
                Algo se ha roto al renderizar este apartado. El resto de la app sigue funcionando.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800/40 rounded-lg p-3 mb-3">
            <p className="text-xs font-mono font-bold text-red-700 dark:text-red-300 mb-1">
              {error?.name || 'Error'}
            </p>
            <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
              {error?.message || 'Error desconocido'}
            </p>
          </div>

          {error?.stack && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                Ver stack trace
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-lg overflow-auto text-[10px] text-gray-600 dark:text-slate-400 max-h-64">
                {error.stack}
              </pre>
            </details>
          )}

          {errorInfo?.componentStack && (
            <details className="text-xs mt-2">
              <summary className="cursor-pointer text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                Ver componente que falló
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-lg overflow-auto text-[10px] text-gray-600 dark:text-slate-400 max-h-64">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
            >
              <i className="ri-refresh-line" /> Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
