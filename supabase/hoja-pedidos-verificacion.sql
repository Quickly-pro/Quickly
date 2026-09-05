-- ============================================================================
-- RepartoPro — Verificación de pedidos en Hoja de Pedidos (check/X por fila)
-- ============================================================================

ALTER TABLE public.order_sheet_rows ADD COLUMN IF NOT EXISTS verification text; -- 'complete' | 'missing' | null

-- El empleado puede actualizar la verificación (además de lo que ya podía la empresa)
DROP POLICY IF EXISTS "order_sheet_rows_update" ON public.order_sheet_rows;
CREATE POLICY "order_sheet_rows_update" ON public.order_sheet_rows FOR UPDATE TO authenticated
  USING (company_id = public.get_effective_company_id() AND NOT public.is_cliente_role())
  WITH CHECK (company_id = public.get_effective_company_id() AND NOT public.is_cliente_role());

-- ✅ FIN
