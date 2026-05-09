import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
        <div className="w-10 h-10 flex items-center justify-center">
          <i className="ri-error-warning-line text-3xl text-orange-500" />
        </div>
      </div>
      <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
      <p className="text-lg text-gray-500 mb-6">Página no encontrada</p>
      <Link
        to="/"
        className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-all flex items-center gap-2"
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-arrow-left-line" />
        </div>
        Volver al inicio
      </Link>
    </div>
  );
}
