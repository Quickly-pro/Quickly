-- ============================================================
-- FIX RLS para la tabla producto_elementos
-- Pega esto en Supabase → SQL Editor → Run
-- ============================================================

-- 1. Activar RLS y abrir acceso total a producto_elementos
ALTER TABLE public.producto_elementos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON public.producto_elementos;
DROP POLICY IF EXISTS "auth read"  ON public.producto_elementos;
DROP POLICY IF EXISTS "anon read"  ON public.producto_elementos;

CREATE POLICY "allow all" ON public.producto_elementos
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 2. Igual para product_categories
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON public.product_categories;

CREATE POLICY "allow all" ON public.product_categories
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 3. Verificar que se pueden leer los datos
SELECT * FROM public.producto_elementos LIMIT 3;
