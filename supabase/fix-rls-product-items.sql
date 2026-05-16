-- ============================================================
-- FIX RLS para product_items y product_categories
-- Pega en Supabase → SQL Editor → Run
-- ============================================================

ALTER TABLE public.product_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON public.product_items;
DROP POLICY IF EXISTS "auth read"  ON public.product_items;
DROP POLICY IF EXISTS "anon read"  ON public.product_items;

CREATE POLICY "allow all" ON public.product_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON public.product_categories;

CREATE POLICY "allow all" ON public.product_categories
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Verificar datos
SELECT id, name, price, stock, category_id FROM public.product_items LIMIT 5;
