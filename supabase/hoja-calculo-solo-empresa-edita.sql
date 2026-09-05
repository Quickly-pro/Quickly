-- ============================================================================
-- RepartoPro — Hoja de Cálculo: refuerzo de seguridad a nivel de base de datos
-- ----------------------------------------------------------------------------
-- La pantalla ya impedía editar a los empleados, pero esto lo refuerza donde
-- de verdad importa: aunque alguien intente forzar una escritura sin pasar
-- por la app, la base de datos la rechaza si no es la propia empresa.
-- Además, garantiza que el empleado SÍ pueda leer la hoja compartida.
-- ============================================================================

-- ── spreadsheet_cells ──────────────────────────────────────────────
DROP POLICY IF EXISTS "spreadsheet_cells_select" ON public.spreadsheet_cells;
DROP POLICY IF EXISTS "spreadsheet_cells_insert" ON public.spreadsheet_cells;
DROP POLICY IF EXISTS "spreadsheet_cells_update" ON public.spreadsheet_cells;
DROP POLICY IF EXISTS "spreadsheet_cells_delete" ON public.spreadsheet_cells;
DROP POLICY IF EXISTS "spreadsheet_cells_all" ON public.spreadsheet_cells;

-- Lectura: la empresa y todos sus empleados ven la misma hoja
CREATE POLICY "spreadsheet_cells_select" ON public.spreadsheet_cells FOR SELECT TO authenticated
  USING (user_id = public.get_effective_company_id());

-- Escritura: SOLO la propia empresa (nunca un empleado, aunque su
-- company_id coincida con el dueño)
CREATE POLICY "spreadsheet_cells_insert" ON public.spreadsheet_cells FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "spreadsheet_cells_update" ON public.spreadsheet_cells FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "spreadsheet_cells_delete" ON public.spreadsheet_cells FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── spreadsheet_palettes ───────────────────────────────────────────
DROP POLICY IF EXISTS "spreadsheet_palettes_select" ON public.spreadsheet_palettes;
DROP POLICY IF EXISTS "spreadsheet_palettes_insert" ON public.spreadsheet_palettes;
DROP POLICY IF EXISTS "spreadsheet_palettes_update" ON public.spreadsheet_palettes;
DROP POLICY IF EXISTS "spreadsheet_palettes_delete" ON public.spreadsheet_palettes;
DROP POLICY IF EXISTS "spreadsheet_palettes_all" ON public.spreadsheet_palettes;

CREATE POLICY "spreadsheet_palettes_select" ON public.spreadsheet_palettes FOR SELECT TO authenticated
  USING (user_id = public.get_effective_company_id());
CREATE POLICY "spreadsheet_palettes_insert" ON public.spreadsheet_palettes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "spreadsheet_palettes_update" ON public.spreadsheet_palettes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "spreadsheet_palettes_delete" ON public.spreadsheet_palettes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── spreadsheet_charts ─────────────────────────────────────────────
DROP POLICY IF EXISTS "spreadsheet_charts_all" ON public.spreadsheet_charts;
DROP POLICY IF EXISTS "spreadsheet_charts_select" ON public.spreadsheet_charts;
DROP POLICY IF EXISTS "spreadsheet_charts_insert" ON public.spreadsheet_charts;
DROP POLICY IF EXISTS "spreadsheet_charts_update" ON public.spreadsheet_charts;
DROP POLICY IF EXISTS "spreadsheet_charts_delete" ON public.spreadsheet_charts;

CREATE POLICY "spreadsheet_charts_select" ON public.spreadsheet_charts FOR SELECT TO authenticated
  USING (user_id = public.get_effective_company_id());
CREATE POLICY "spreadsheet_charts_insert" ON public.spreadsheet_charts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "spreadsheet_charts_update" ON public.spreadsheet_charts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "spreadsheet_charts_delete" ON public.spreadsheet_charts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ✅ FIN
