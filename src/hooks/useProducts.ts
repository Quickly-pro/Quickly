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

function mapRow(p: any): Product {
  return {
    id:               Number(p['identificación'] ?? p.id ?? 0),
    name:             String(p.nombre ?? ''),
    category_id:      p['categoría_id'] != null ? Number(p['categoría_id']) : null,
    status:           String(p.estado ?? 'active'),
    description:      p['descripción'] ?? null,
    price:            Number(p.precio ?? 0),
    stock:            Number(p.stock ?? 0),
    min_stock:        Number(p.min_stock ?? 10),
    discount_enabled: Boolean(p.descuento_habilitado ?? false),
    discount_price:   p.precio_descuento != null ? Number(p.precio_descuento) : null,
    media:            Array.isArray(p.medios) ? p.medios : [],
    weight:           null,
    dimensions:       null,
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
      supabase.from('producto_elementos').select('*').limit(200),
      supabase.from('product_categories').select('*').order('sort_order').order('id'),
    ]);

    if (prodResult.error) {
      console.error('[useProducts] Error:', prodResult.error);
      setError(prodResult.error.message);
    } else {
      setProducts((prodResult.data || []).map(mapRow));
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
