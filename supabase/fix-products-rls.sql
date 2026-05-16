-- ============================================================
-- FIX: RLS de productos + columna sort_order
-- Pega esto en Supabase → SQL Editor y ejecuta
-- ============================================================

-- 1. Añadir sort_order a product_categories si no existe
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS color text DEFAULT '#f97316';

-- 2. Añadir min_stock a product_items si no existe
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 10;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR';
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS pricing_mode integer DEFAULT 0;

-- 3. RLS product_items — cualquier usuario autenticado o anónimo puede leer/escribir
ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read"   ON public.product_items;
DROP POLICY IF EXISTS "auth insert" ON public.product_items;
DROP POLICY IF EXISTS "auth update" ON public.product_items;
DROP POLICY IF EXISTS "auth delete" ON public.product_items;
DROP POLICY IF EXISTS "anon read"   ON public.product_items;
DROP POLICY IF EXISTS "allow all"   ON public.product_items;

CREATE POLICY "allow all" ON public.product_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 4. RLS product_categories — igual
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read"   ON public.product_categories;
DROP POLICY IF EXISTS "auth insert" ON public.product_categories;
DROP POLICY IF EXISTS "auth update" ON public.product_categories;
DROP POLICY IF EXISTS "auth delete" ON public.product_categories;
DROP POLICY IF EXISTS "anon read"   ON public.product_categories;
DROP POLICY IF EXISTS "allow all"   ON public.product_categories;

CREATE POLICY "allow all" ON public.product_categories
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 5. Verificar cuántos productos hay
SELECT COUNT(*) AS total_productos FROM public.product_items;
SELECT COUNT(*) AS total_categorias FROM public.product_categories;
