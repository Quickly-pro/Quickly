import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useNotificationsContext } from '@/context/NotificationsContext';
import Modal from '@/components/base/Modal';
import ImageWithFallback from '@/components/base/ImageWithFallback';

interface Category {
  id: number;
  name: string;
  sort_order: number;
}

interface Product {
  id: number;
  name: string;
  category_id: number | null;
  status: string;
  description: string | null;
  price: number;
  stock: number;
  min_stock: number;
  discount_enabled: boolean;
  discount_price: number | null;
  media: any[];
  created_at: string;
  product_categories?: Category | null;
}

interface CartItem {
  product_id: number;
  name: string;
  price: number;
  qty: number;
  image: string;
}

export default function Productos() {
  const { isCliente } = useRole();
  const navigate = useNavigate();
  const { addNotification } = useNotificationsContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time stock alert toasts
  const [stockAlertToasts, setStockAlertToasts] = useState<{ id: number; name: string; stock: number; min_stock: number }[]>([]);
  const prevProductsRef = useRef<Product[]>([]);

  // UI state
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [searchText, setSearchText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);

  // Admin state (hidden for cliente)
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', categoryId: '', price: '', stock: '', minStock: '', description: '', weight: '', dimensions: '',
  });
  const [newCategory, setNewCategory] = useState({ name: '', color: '#f97316' });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Edit state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', categoryId: '', price: '', stock: '', minStock: '', description: '', weight: '', dimensions: '',
  });
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editImageName, setEditImageName] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [
      { data: prodData },
      { data: catData },
    ] = await Promise.all([
      supabase.from('product_items').select('*, product_categories(id, name, sort_order)').order('id', { ascending: false }).limit(100),
      supabase.from('product_categories').select('*').order('sort_order'),
    ]);

    const mapped = (prodData || []).map((p: any) => ({
      ...p,
      media: p.media || [],
      product_categories: p.product_categories || null,
    }));
    setProducts(mapped);
    setCategories(catData || []);
    setLoading(false);
    prevProductsRef.current = mapped;
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Detect stock drops in real-time and push alerts
  useEffect(() => {
    if (products.length === 0 || prevProductsRef.current.length === 0) {
      prevProductsRef.current = products;
      return;
    }
    const prevMap = new Map(prevProductsRef.current.map(p => [p.id, p]));
    const newAlerts: { id: number; name: string; stock: number; min_stock: number }[] = [];

    products.forEach(p => {
      const prev = prevMap.get(p.id);
      const isLow = p.stock < p.min_stock;
      const wasNotLow = prev ? prev.stock >= prev.min_stock : true;
      if (isLow && wasNotLow) {
        newAlerts.push({ id: p.id, name: p.name, stock: p.stock, min_stock: p.min_stock });
        addNotification(
          'Stock bajo',
          `${p.name} tiene ${p.stock} unidades (mín. ${p.min_stock}).`,
          'stock'
        );
      }
    });

    if (newAlerts.length > 0) {
      setStockAlertToasts(prev => [...newAlerts, ...prev].slice(0, 5));
      newAlerts.forEach((a, i) => {
        setTimeout(() => {
          setStockAlertToasts(prev => prev.filter(t => t.id !== a.id));
        }, 6000 + i * 1000);
      });
    }

    prevProductsRef.current = products;
  }, [products, addNotification]);

  // Real-time subscription for instant product updates
  useEffect(() => {
    const channel = supabase
      .channel('product-stock-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_items' },
        () => {
          fetchAll();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const getCategoryName = (catId: number | null) => {
    if (!catId) return 'Sin categoría';
    const cat = categories.find(c => c.id === catId);
    return cat?.name || 'Sin categoría';
  };

  const productImage = (product: Product) => {
    if (product.media && product.media.length > 0 && product.media[0]?.url) {
      return product.media[0].url;
    }
    return 'https://readdy.ai/api/search-image?query=A%20simple%20flat%20illustration%20of%20a%20brown%20cardboard%20box%20on%20a%20clean%20cream%20background%2C%20minimal%20style%2C%20soft%20shadows%2C%20product%20placeholder%20icon%2C%20warm%20earth%20tones%2C%20no%20text&width=400&height=400&seq=prodph&orientation=squarish';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }
    setUploadedImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string || null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const clearImage = () => {
    setUploadedImage(null);
    setUploadedImageName('');
  };

  // Edit image handlers
  const processEditFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB');
      return;
    }
    setEditImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditImage(ev.target?.result as string || null);
    };
    reader.readAsDataURL(file);
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processEditFile(file);
  };

  const handleEditDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processEditFile(file);
  };

  const clearEditImage = () => {
    setEditImage(null);
    setEditImageName('');
  };

  const filteredProducts = useMemo(() => {
    let data = [...products];
    if (filterCategory !== 'todos') {
      const cat = categories.find(c => c.name === filterCategory);
      data = data.filter(p => p.category_id === (cat?.id ?? null));
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      data = data.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return data;
  }, [products, filterCategory, categories, searchText]);

  const lowStockProducts = useMemo(() => products.filter(p => p.stock < p.min_stock), [products]);
  const totalInventoryValue = useMemo(() => products.reduce((sum, p) => sum + p.stock * p.price, 0), [products]);

  const createProduct = async () => {
    if (!newProduct.name || !newProduct.price) return;
    setIsSaving(true);
    setSaveError(null);

    const media = uploadedImage ? [{ url: uploadedImage, type: 'image' }] : [];
    const { error } = await supabase.from('product_items').insert({
      name: newProduct.name.trim(),
      category_id: newProduct.categoryId ? Number(newProduct.categoryId) : null,
      price: Number(newProduct.price),
      stock: Number(newProduct.stock || 0),
      min_stock: Number(newProduct.minStock || 10),
      description: newProduct.description?.trim() || null,
      status: 'active',
      currency: 'EUR',
      pricing_mode: 0,
      media,
      weight: newProduct.weight ? Number(newProduct.weight) : null,
      dimensions: newProduct.dimensions?.trim() || null,
    });

    setIsSaving(false);

    if (error) {
      setSaveError(error.message || 'Error al guardar el producto. Inténtalo de nuevo.');
      return;
    }

    setNewProduct({ name: '', categoryId: '', price: '', stock: '', minStock: '', description: '', weight: '', dimensions: '' });
    setUploadedImage(null);
    setUploadedImageName('');
    setShowNewProduct(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    fetchAll();
  };

  const createCategory = async () => {
    if (!newCategory.name) return;
    const { error } = await supabase.from('product_categories').insert({ name: newCategory.name });
    if (!error) {
      setNewCategory({ name: '', color: '#f97316' });
      setShowNewCategory(false);
      fetchAll();
    }
  };

  // Export catalog to CSV
  const exportCSV = () => {
    const rows = filteredProducts.map(p => ({
      ID: p.id,
      Nombre: p.name,
      Categoria: getCategoryName(p.category_id),
      Precio: p.discount_enabled && p.discount_price ? p.discount_price : p.price,
      Stock: p.stock,
      'Stock Minimo': p.min_stock,
      Estado: p.status,
      Descripcion: p.description || '',
    }));
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => String((r as any)[h]).replace(/;/g, ',')).join(';')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo-productos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Edit helpers
  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      categoryId: product.category_id ? String(product.category_id) : '',
      price: String(product.price),
      stock: String(product.stock),
      minStock: String(product.min_stock),
      description: product.description || '',
      weight: String(product.weight ?? ''),
      dimensions: product.dimensions || '',
    });
    const existingUrl = product.media?.[0]?.url || null;
    setEditImage(existingUrl);
    setEditImageName(existingUrl ? 'Imagen actual' : '');
    setSaveError(null);
    setShowProductDetail(false);
  };

  const closeEdit = () => {
    setEditingProduct(null);
    setEditForm({
      name: '', categoryId: '', price: '', stock: '', minStock: '', description: '', weight: '', dimensions: '',
    });
    setEditImage(null);
    setEditImageName('');
    setSaveError(null);
  };

  const updateProduct = async () => {
    if (!editingProduct || !editForm.name || !editForm.price) return;
    setIsEditing(true);
    setSaveError(null);

    const media = editImage ? [{ url: editImage, type: 'image' }] : [];
    const { error } = await supabase.from('product_items').update({
      name: editForm.name.trim(),
      category_id: editForm.categoryId ? Number(editForm.categoryId) : null,
      price: Number(editForm.price),
      stock: Number(editForm.stock || 0),
      min_stock: Number(editForm.minStock || 10),
      description: editForm.description?.trim() || null,
      media,
      weight: editForm.weight ? Number(editForm.weight) : null,
      dimensions: editForm.dimensions?.trim() || null,
    }).eq('id', editingProduct.id);

    setIsEditing(false);

    if (error) {
      setSaveError(error.message || 'Error al actualizar el producto. Inténtalo de nuevo.');
      return;
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    closeEdit();
    fetchAll();
  };

  const deleteProduct = async (id: number) => {
    const { error } = await supabase.from('product_items').delete().eq('id', id);
    if (!error) {
      setShowProductDetail(false);
      setSelectedProduct(null);
      fetchAll();
    }
  };

  // Cliente: add to cart
  const addToCart = (product: Product) => {
    const price = product.discount_enabled && product.discount_price ? product.discount_price : product.price;
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product_id: product.id, name: product.name, price, qty: 1, image: productImage(product) }];
    });
    setCartSuccess(true);
    setTimeout(() => setCartSuccess(false), 1500);
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product_id !== productId) return i;
      const newQty = Math.max(1, i.qty + delta);
      return { ...i, qty: newQty };
    }));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Productos y Stock</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {isCliente ? 'Explora nuestro catálogo y elige los productos que deseas pedir' : 'Gestiona productos, stock y categorías'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isCliente && (
            <>
              <button
                onClick={exportCSV}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap"
                disabled={filteredProducts.length === 0}
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-download-line" /></div>
                Exportar CSV
              </button>
              <button
                onClick={() => setShowNewCategory(true)}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-folder-add-line" /></div>
                Nueva Categoría
              </button>
              <button
                onClick={() => { setShowNewProduct(true); clearImage(); setSaveError(null); }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line" /></div>
                Añadir Producto
              </button>
            </>
          )}
          {isCliente && cartCount > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-shopping-cart-2-line" /></div>
              Carrito ({cartCount})
            </button>
          )}
        </div>
      </div>

      {/* KPIs - solo empresa/empleado */}
      {!isCliente && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Total Productos</p>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{products.length}{loading && '...'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Categorías</p>
            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{categories.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Stock Bajo</p>
            <p className="text-xl font-bold text-red-600">{lowStockProducts.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">Valor Inventario</p>
            <p className="text-xl font-bold text-orange-600">€{totalInventoryValue.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Stock Alerts - solo empresa/empleado */}
      {!isCliente && lowStockProducts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-alert-line text-red-500 dark:text-red-400" />
            </div>
            <span className="font-semibold text-sm text-red-700 dark:text-red-400">Alertas de Stock Bajo</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {lowStockProducts.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedProduct(p); setShowProductDetail(true); }}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/40 rounded-full text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {p.name}: {p.stock} / {p.min_stock} mín.
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + Categories */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] relative">
          <div className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <i className="ri-search-line text-gray-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
              ${filterCategory === 'todos' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'}`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.name)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
                ${filterCategory === cat.name ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Cart success toast */}
      {cartSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-bounce">
          <i className="ri-check-line mr-1" /> Producto añadido al carrito
        </div>
      )}

      {/* Product saved success toast */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-bounce flex items-center gap-2">
          <i className="ri-checkbox-circle-line" />
          Producto guardado correctamente
        </div>
      )}

      {/* Stock alert toasts */}
      {stockAlertToasts.map((toast) => (
        <div
          key={toast.id}
          className="fixed top-4 right-4 z-50 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3 shadow-lg animate-[slideInRight_0.4s_ease-out]"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <i className="ri-error-warning-line text-red-500 text-sm" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Stock bajo</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                <strong>{toast.name}</strong> tiene <strong>{toast.stock}</strong> unidades (mín. {toast.min_stock})
              </p>
              <button
                onClick={() => { const p = products.find(x => x.id === toast.id); if (p) { setSelectedProduct(p); setShowProductDetail(true); } setStockAlertToasts(prev => prev.filter(t => t.id !== toast.id)); }}
                className="mt-2 text-xs font-medium text-red-700 dark:text-red-400 underline hover:no-underline"
              >
                Ver producto
              </button>
            </div>
            <button
              onClick={() => setStockAlertToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-600 flex-shrink-0"
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>
      ))}

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-product-shop>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200 dark:bg-slate-700" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
                <div className="flex justify-between pt-2">
                  <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-16" />
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-12" />
                </div>
              </div>
            </div>
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 dark:text-slate-500">
            No se encontraron productos con los filtros actuales.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isLowStock = product.stock < product.min_stock;
            const catName = getCategoryName(product.category_id);
            const finalPrice = product.discount_enabled && product.discount_price
              ? product.discount_price
              : product.price;
            const hasDiscount = product.discount_enabled && product.discount_price && product.discount_price < product.price;

            return (
              <div
                key={product.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md dark:hover:shadow-slate-800/50 transition-all"
              >
                <div className="relative aspect-square bg-gray-50 dark:bg-slate-800 overflow-hidden">
                  <ImageWithFallback
                    src={productImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    fallbackClassName="w-full h-full"
                  />
                  {!isCliente && isLowStock && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white rounded-md text-xs font-medium">
                      Stock bajo
                    </div>
                  )}
                  {hasDiscount && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white rounded-full text-xs font-medium">
                      -{Math.round((1 - (product.discount_price || 0) / product.price) * 100)}%
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 text-white rounded-full text-xs font-medium">
                    {catName}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-slate-200 line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">ID: {product.id}</p>

                  {/* Stock bar - solo empresa/empleado */}
                  {!isCliente && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`${isLowStock ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                          Stock: {product.stock} / mín {product.min_stock}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isLowStock ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, product.min_stock > 0 ? (product.stock / (product.min_stock * 3)) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold text-orange-600">
                      €{Number(finalPrice).toFixed(2)}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-gray-400 line-through">€{Number(product.price).toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-3">
                    {isCliente ? (
                      <>
                        <button
                          onClick={() => { setSelectedProduct(product); setShowProductDetail(true); }}
                          className="flex-1 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-md text-xs hover:bg-gray-100 dark:hover:bg-slate-700"
                        >
                          Ver detalle
                        </button>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.stock <= 0}
                          className="flex-1 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-md text-xs hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Elegir
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setSelectedProduct(product); setShowProductDetail(true); }}
                          className="flex-1 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-md text-xs hover:bg-gray-100 dark:hover:bg-slate-700"
                        >
                          Ver detalle
                        </button>
                        <button
                          onClick={() => startEdit(product)}
                          className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700"
                          title="Editar producto"
                        >
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-pencil-line text-xs" /></div>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Product Detail Modal - cliente read-only */}
      <Modal
        isOpen={showProductDetail && !!selectedProduct}
        onClose={() => { setShowProductDetail(false); setSelectedProduct(null); }}
        title={selectedProduct?.name || ''}
        size="lg"
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800">
              <ImageWithFallback
                src={productImage(selectedProduct)}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
                fallbackClassName="w-full h-full"
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-slate-400">ID</span>
                <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{selectedProduct.id}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-slate-400">Categoría</span>
                <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{getCategoryName(selectedProduct.category_id)}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-slate-400">Precio</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-orange-600">
                    €{selectedProduct.discount_enabled && selectedProduct.discount_price
                      ? selectedProduct.discount_price.toFixed(2)
                      : Number(selectedProduct.price).toFixed(2)}
                  </span>
                  {selectedProduct.discount_enabled && selectedProduct.discount_price && selectedProduct.discount_price < selectedProduct.price && (
                    <span className="text-xs text-gray-400 line-through ml-2">€{Number(selectedProduct.price).toFixed(2)}</span>
                  )}
                </div>
              </div>
              {!isCliente && (
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-slate-400">Stock</span>
                  <span className={`text-sm font-medium ${selectedProduct.stock < selectedProduct.min_stock ? 'text-red-600' : 'text-gray-800 dark:text-slate-200'}`}>
                    {selectedProduct.stock} / {selectedProduct.min_stock} mín.
                  </span>
                </div>
              )}
              {selectedProduct.description && (
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Descripción</span>
                  <p className="text-sm text-gray-800 dark:text-slate-200">{selectedProduct.description}</p>
                </div>
              )}
            </div>

            {/* Actions: cliente gets "Añadir al carrito", admin gets delete */}
            <div className="flex gap-2 pt-2">
              {isCliente ? (
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    setShowProductDetail(false);
                    setSelectedProduct(null);
                  }}
                  disabled={selectedProduct.stock <= 0}
                  className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="ri-shopping-cart-2-line" />
                  {selectedProduct.stock <= 0 ? 'Sin stock' : 'Añadir al carrito'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setShowProductDetail(false); }}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => deleteProduct(selectedProduct.id)}
                    className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center gap-2"
                  >
                    <i className="ri-delete-bin-line" />
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Cart Modal for Cliente */}
      <Modal
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        title="Tu selección"
        size="md"
      >
        <div className="space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500">
              <i className="ri-shopping-cart-2-line text-3xl mb-2 block" />
              <p className="text-sm">Tu carrito está vacío</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.product_id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <ImageWithFallback
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      fallbackClassName="w-12 h-12 rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{item.name}</p>
                      <p className="text-xs text-orange-600">€{item.price.toFixed(2)} / unid.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartQty(item.product_id, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600"
                      >
                        <i className="ri-subtract-line text-xs" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(item.product_id, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600"
                      >
                        <i className="ri-add-line text-xs" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="w-7 h-7 flex items-center justify-center text-red-500 hover:text-red-600"
                    >
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-600 dark:text-slate-400">Total ({cartCount} artículos)</span>
                  <span className="font-bold text-orange-600">€{cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => {
                    // In real app this would create an order and redirect
                    alert('Pedido enviado. Próximamente: integración con checkout de pedidos.');
                    setCart([]);
                    setShowCart(false);
                  }}
                  className="w-full py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center justify-center gap-2"
                >
                  <i className="ri-check-line" />
                  Confirmar pedido
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* New Product Modal - admin only */}
      {!isCliente && (
        <Modal
          isOpen={showNewProduct}
          onClose={() => { setShowNewProduct(false); clearImage(); }}
          title="Añadir Producto"
          size="lg"
        >
          <div className="space-y-4">
            {/* Image Upload */}
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Foto del producto</label>
              {uploadedImage ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                  <img src={uploadedImage} alt="Preview" className="w-full h-48 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{uploadedImageName}</span>
                    <button
                      onClick={clearImage}
                      className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80"
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById('product-image-input')?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                    ${isDragging ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500'}`}
                >
                  <div className="w-10 h-10 mx-auto flex items-center justify-center mb-2">
                    <i className="ri-upload-cloud-2-line text-gray-400 dark:text-slate-500 text-2xl" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra una imagen o haz clic para seleccionar</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">JPG, PNG, WebP hasta 5MB</p>
                  <input
                    id="product-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Nombre</label>
              <input
                type="text"
                placeholder="Nombre del producto..."
                value={newProduct.name}
                onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Categoría</label>
                <select
                  value={newProduct.categoryId}
                  onChange={e => setNewProduct(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Precio (€)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newProduct.price}
                  onChange={e => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Stock</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newProduct.stock}
                  onChange={e => setNewProduct(prev => ({ ...prev, stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Stock mínimo</label>
                <input
                  type="number"
                  placeholder="10"
                  value={newProduct.minStock}
                  onChange={e => setNewProduct(prev => ({ ...prev, minStock: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Peso (kg)</label>
                <input
                  type="number"
                  placeholder="Ej: 25"
                  value={newProduct.weight}
                  onChange={e => setNewProduct(prev => ({ ...prev, weight: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Dimensiones (cm)</label>
                <input
                  type="text"
                  placeholder="LxAxH"
                  value={newProduct.dimensions}
                  onChange={e => setNewProduct(prev => ({ ...prev, dimensions: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Descripción</label>
              <textarea
                value={newProduct.description}
                onChange={e => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300 resize-none"
                rows={2}
                maxLength={500}
                placeholder="Descripción del producto..."
              />
            </div>
            {/* Error feedback */}
            {saveError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-error-warning-line text-red-500 text-sm" />
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button
                onClick={() => { setShowNewProduct(false); clearImage(); setSaveError(null); }}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={createProduct}
                disabled={!newProduct.name || !newProduct.price || isSaving}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Producto'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Product Modal */}
      {editingProduct && !isCliente && (
        <Modal
          isOpen={!!editingProduct}
          onClose={closeEdit}
          title={`Editar: ${editingProduct.name}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Image Upload */}
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Foto del producto</label>
              {editImage ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                  <img src={editImage} alt="Preview" className="w-full h-48 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <span className="px-2 py-1 bg-black/60 text-white rounded-md text-xs">{editImageName}</span>
                    <button
                      onClick={clearEditImage}
                      className="w-7 h-7 flex items-center justify-center bg-black/60 text-white rounded-md hover:bg-black/80"
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById('edit-image-input')?.click()}
                  onDrop={handleEditDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500"
                >
                  <div className="w-10 h-10 mx-auto flex items-center justify-center mb-2">
                    <i className="ri-upload-cloud-2-line text-gray-400 dark:text-slate-500 text-2xl" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Arrastra una imagen o haz clic para seleccionar</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">JPG, PNG, WebP hasta 5MB</p>
                  <input
                    id="edit-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageSelect}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Nombre</label>
              <input
                type="text"
                placeholder="Nombre del producto..."
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Categoría</label>
                <select
                  value={editForm.categoryId}
                  onChange={e => setEditForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Precio (€)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={editForm.price}
                  onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Stock</label>
                <input
                  type="number"
                  placeholder="0"
                  value={editForm.stock}
                  onChange={e => setEditForm(prev => ({ ...prev, stock: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Stock mínimo</label>
                <input
                  type="number"
                  placeholder="10"
                  value={editForm.minStock}
                  onChange={e => setEditForm(prev => ({ ...prev, minStock: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Peso (kg)</label>
                <input
                  type="number"
                  placeholder="Ej: 25"
                  value={editForm.weight}
                  onChange={e => setEditForm(prev => ({ ...prev, weight: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Dimensiones (cm)</label>
                <input
                  type="text"
                  placeholder="LxAxH"
                  value={editForm.dimensions}
                  onChange={e => setEditForm(prev => ({ ...prev, dimensions: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Descripción</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300 resize-none"
                rows={2}
                maxLength={500}
                placeholder="Descripción del producto..."
              />
            </div>
            {/* Error feedback */}
            {saveError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-error-warning-line text-red-500 text-sm" />
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button
                onClick={closeEdit}
                disabled={isEditing}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={updateProduct}
                disabled={!editForm.name || !editForm.price || isEditing}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isEditing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line" />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Category Modal - admin only */}
      {!isCliente && (
        <Modal
          isOpen={showNewCategory}
          onClose={() => setShowNewCategory(false)}
          title="Nueva Categoría"
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 block mb-1">Nombre</label>
              <input
                type="text"
                placeholder="Ej: Conservas..."
                value={newCategory.name}
                onChange={e => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-300"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => setShowNewCategory(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                onClick={createCategory}
                disabled={!newCategory.name}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Crear Categoría
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
