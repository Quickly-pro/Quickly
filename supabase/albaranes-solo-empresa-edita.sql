-- ============================================================================
-- RepartoPro — Albaranes: solo la empresa edita/publica, empleados solo ven
-- ============================================================================

ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS delivery_notes text;

DROP POLICY IF EXISTS "albaranes_insert" ON public.albaranes;
CREATE POLICY "albaranes_insert" ON public.albaranes FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_effective_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) IN ('empresa', 'administrador', 'admin', 'dirección'))
  );

DROP POLICY IF EXISTS "albaranes_update" ON public.albaranes;
CREATE POLICY "albaranes_update" ON public.albaranes FOR UPDATE TO authenticated
  USING (company_id = public.get_effective_company_id())
  WITH CHECK (
    company_id = public.get_effective_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) IN ('empresa', 'administrador', 'admin', 'dirección'))
  );

DROP POLICY IF EXISTS "albaranes_delete" ON public.albaranes;
CREATE POLICY "albaranes_delete" ON public.albaranes FOR DELETE TO authenticated
  USING (
    company_id = public.get_effective_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) IN ('empresa', 'administrador', 'admin', 'dirección'))
  );

-- La lectura (albaranes_select) se queda igual — empresa Y empleado ven todos
-- los albaranes de su empresa, para que el empleado pueda revisarlos.

-- ✅ FIN
