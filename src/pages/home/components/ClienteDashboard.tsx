import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import SubscriptionBanner from '@/components/feature/SubscriptionBanner';

interface Product {
  id: number;
  name: string;
  price: number;
  discount_enabled: boolean;
  discount_price: number | null;
  media: any[];
  product_categories?: { name: string } | null;
}

export default function ClienteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [myInvoices, setMyInvoices] = useState<any[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);

    // Fetch featured products
    const { data: products } = await supabase
      .from('product_items')
      .select('id, name, price, discount_enabled, discount_price, media, product_categories(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(4);

    // Find client name for invoices
    const { data: clientData } = await supabase
      .from('clients')
      .select('name')
      .eq('email', user?.email)
      .maybeSingle();

    const clientName = clientData?.name;

    const { data: invoices } = clientName
      ? await supabase
          .from('invoices')
          .select('id, amount, status, invoice_number, created_at')
          .eq('client', clientName)
          .order('created_at', { ascending: false })
          .limit(3)
      : { data: [] };

    // Unread notifications
    const { count } = await supabase
      .from('notifications')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', user?.id)
      .eq('read', false);

    setFeaturedProducts(products || []);
    setMyInvoices(invoices || []);
    setUnreadNotifs(count || 0);
    setLoading(false);
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (user?.email) fetchDashboard();
  }, [fetchDashboard, user?.email]);

  const productImage = (product: Product) => {
    if (product.media && product.media.length > 0 && product.media[0]?.url) {
      return product.media[0].url;
    }
    return 'https://readdy.ai/api/search-image?query=A%20simple%20flat%20illustration%20of%20a%20brown%20cardboard%20box%20on%20a%20clean%20cream%20background%2C%20minimal%20style%2C%20soft%20shadows%2C%20product%20placeholder%20icon%2C%20warm%20earth%20tones%2C%20no%20text&width=400&height=400&seq=prodph&orientation=squarish';
  };

  const finalPrice = (p: Product) => {
    if (p.discount_enabled && p.discount_price != null) return p.discount_price;
    return p.price;
  };

  const hasDiscount = (p: Product) => p.discount_enabled && p.discount_price != null && p.discount_price < p.price;

  return (
    <div className="space-y-6">
      <SubscriptionBanner />

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hola, {user?.email?.split('@')[0] || 'Cliente'}</h1>
            <p className="text-orange-100 text-sm mt-1">Bienvenido a tu panel personal. Explora productos, consulta tus facturas y mantente en contacto.</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <i className="ri-user-smile-line text-2xl" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Link to="/productos" className="px-4 py-2 bg-white text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50 transition-all whitespace-nowrap">
            <i className="ri-shopping-bag-line mr-1" /> Ver productos
          </Link>
          <Link to="/comunicacion" className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30 transition-all whitespace-nowrap">
            <i className="ri-chat-3-line mr-1" /> Chat
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/productos" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
            <i className="ri-shopping-bag-line" />
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-slate-100">Productos</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Ver catálogo</p>
        </Link>
        <Link to="/facturacion" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
            <i className="ri-bill-line" />
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-slate-100">Facturas</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Mis facturas</p>
        </Link>
        <Link to="/notificaciones" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all relative">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <i className="ri-notification-3-line" />
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-slate-100">Notificaciones</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Mantente al día</p>
          {unreadNotifs > 0 && (
            <span className="absolute top-3 right-3 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadNotifs}
            </span>
          )}
        </Link>
        <Link to="/comunicacion" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
            <i className="ri-chat-3-line" />
          </div>
          <p className="text-xl font-bold text-gray-800 dark:text-slate-100">Chat</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Habla con nosotros</p>
        </Link>
      </div>

      {/* Featured Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">Productos destacados</h2>
          <Link to="/productos" className="text-sm text-orange-600 hover:underline">Ver todos</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200 dark:bg-slate-700" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700">
            <i className="ri-shopping-bag-line text-3xl mb-2 block" />
            <p className="text-sm">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-product-shop>
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all"
              >
                <div className="relative aspect-square bg-gray-50 dark:bg-slate-800 overflow-hidden">
                  <img
                    src={productImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  {hasDiscount(product) && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white rounded-full text-xs font-medium">
                      -{Math.round((1 - (product.discount_price || 0) / product.price) * 100)}%
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-slate-200 line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{product.product_categories?.name || 'General'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-orange-600">€{finalPrice(product).toFixed(2)}</span>
                    {hasDiscount(product) && (
                      <span className="text-xs text-gray-400 line-through">€{product.price.toFixed(2)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/productos')}
                    className="w-full mt-2 py-1.5 bg-orange-500 text-white rounded-md text-xs font-medium hover:bg-orange-600 transition-all"
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Recent Invoices */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">Mis Facturas Recientes</h3>
          <Link to="/facturacion" className="text-xs text-orange-600 hover:underline">Ver todas</Link>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-lg" />)}
          </div>
        ) : myInvoices.length === 0 ? (
          <div className="text-center py-6 text-gray-400 dark:text-slate-500 text-sm">
            <i className="ri-bill-line text-2xl mb-2 block" />
            Sin facturas todavía
          </div>
        ) : (
          <div className="space-y-2">
            {myInvoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
                  <i className="ri-bill-line text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{inv.invoice_number}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(inv.created_at).toLocaleDateString('es-ES')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">€{Number(inv.amount || 0).toLocaleString()}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${inv.status === 'cobrado' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {inv.status === 'cobrado' ? 'Pagada' : 'Pendiente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/email" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <i className="ri-mail-line" />
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-slate-100">Correo</span>
        </Link>
        <Link to="/sugerencias" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400">
            <i className="ri-lightbulb-line" />
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-slate-100">Sugerencias</span>
        </Link>
        <Link to="/legales" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
            <i className="ri-shield-check-line" />
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-slate-100">Privacidad</span>
        </Link>
        <Link to="/configuracion" className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-orange-300 transition-all">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
            <i className="ri-settings-3-line" />
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-slate-100">Configuración</span>
        </Link>
      </div>
    </div>
  );
}