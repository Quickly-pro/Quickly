import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ProductCategory {
  id: number;
  name: string;
  sort_order: number;
  color?: string;
}

export interface Product {
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
  media: { url: string; type: string }[];
  weight?: number | null;
  dimensions?: string | null;
  created_at: string;
}

// Mapea una fila de Supabase (columnas en español) al interface Product
function mapRow(p: any): Product {
  return {
    id:               Number(p['identificación'] ?? p.identificacion ?? p.id ?? 0),
    name:             String(p.nombre ?? p.name ?? ''),
    category_id:      p.categoria_id != null ? Number(p.categoria_id) : p.category_id != null ? Number(p.category_id) : null,
    status:           String(p.estado ?? p.status ?? 'active'),
    description:      p.descripcion ?? p.descripción ?? p.description ?? null,
    price:            Number(p.precio ?? p.price ?? 0),
    stock:            Number(p.stock_actual ?? p.stock ?? 0),
    min_stock:        Number(p.stock_minimo ?? p.min_stock ?? 10),
    discount_enabled: Boolean(p.descuento_activo ?? p.discount_enabled ?? false),
    discount_price:   p.precio_descuento != null ? Number(p.precio_descuento) : p.discount_price != null ? Number(p.discount_price) : null,
    media:            Array.isArray(p.media) ? p.media : [],
    weight:           p.peso != null ? Number(p.peso) : p.weight != null ? Number(p.weight) : null,
    dimensions:       p.dimensiones ?? p.dimensions ?? null,
    created_at:       p.creado_en ?? p.created_at ?? '',
  };
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [prodResult, catResult] = await Promise.all([
      supabase
        .from('producto_elementos')
        .select('*')
        .order('identificación', { ascending: false })
        .limit(200),
      supabase
        .from('product_categories')
        .select('*')
        .order('sort_order')
        .order('id'),
    ]);

    if (prodResult.error) {
      console.error('[useProducts] Error productos:', prodResult.error);
      // Si falla con identificación, intentar sin order
      const retry = await supabase.from('producto_elementos').select('*').limit(200);
      if (retry.error) {
        console.error('[useProducts] Retry también falló:', retry.error);
        setError(retry.error.message);
        setLoading(false);
        return;
      }
      const mapped = (retry.data || []).map(mapRow);
      setProducts(mapped);
    } else {
      setProducts((prodResult.data || []).map(mapRow));
    }

    if (catResult.error) {
      console.error('[useProducts] Error categorías:', catResult.error);
    }

    const cats: ProductCategory[] = (catResult.data || []).map((c: any) => ({
      id:         Number(c.id),
      name:       String(c.name ?? c.nombre ?? ''),
      sort_order: Number(c.sort_order ?? 0),
      color:      c.color ?? '#f97316',
    }));

    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Suscripción en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producto_elementos' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { products, categories, loading, error, refetch: fetchAll };
}
