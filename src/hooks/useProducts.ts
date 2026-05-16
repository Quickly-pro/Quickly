import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ProductCategory {
  id: number;
  name: string;
  sort_order: number;
  color?: string;
}

export interface Product {
  id: string;             // UUID
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

function mapRow(p: any): Product {
  return {
    id:               String(p.id ?? ''),
    name:             String(p.name ?? ''),
    category_id:      p.category_id != null ? Number(p.category_id) : null,
    status:           String(p.status ?? 'active'),
    description:      p.description ?? null,
    price:            Number(p.price ?? p.precio_unidad ?? 0),
    stock:            Number(p.stock ?? p.stock_actual ?? 0),
    min_stock:        Number(p.min_stock ?? 10),
    discount_enabled: Boolean(p.discount_enabled ?? false),
    discount_price:   p.discount_price != null ? Number(p.discount_price) : null,
    media:            Array.isArray(p.media) ? p.media : [],
    weight:           p.weight != null ? Number(p.weight) : null,
    dimensions:       p.dimensions ?? null,
    created_at:       p.created_at ?? '',
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
      supabase.from('product_items').select('*').limit(200),
      supabase.from('product_categories').select('*').order('sort_order').order('id'),
    ]);

    if (prodResult.error) {
      console.error('[useProducts] Error cargando productos:', prodResult.error);
      setError(prodResult.error.message);
    } else {
      const rows = prodResult.data || [];
      console.log(`[useProducts] Filas recibidas: ${rows.length}`, rows[0] ?? '(vacío)');
      setProducts(rows.map(mapRow));
    }

    const cats: ProductCategory[] = (catResult.data || []).map((c: any) => ({
      id:         Number(c.id),
      name:       String(c.name ?? ''),
      sort_order: Number(c.sort_order ?? 0),
      color:      c.color ?? '#f97316',
    }));
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_items' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return { products, categories, loading, error, refetch: fetchAll };
}
