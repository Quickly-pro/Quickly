-- ============================================================================
-- RepartoPro — Empleados heredan Premium, pero NO pueden editar la empresa
-- ----------------------------------------------------------------------------
-- Contexto: el script anterior (empresa-multi-usuario.sql) permitía que
-- CUALQUIER miembro de la empresa (dueño o no) leyera Y editara
-- company_settings. Ahora que los empleados también pueden unirse con el
-- código para heredar Premium, hay que asegurarse de que solo el dueño
-- (rol Empresa) pueda editar los datos legales/de contacto de la empresa.
-- Los empleados solo pueden LEER esos datos.
--
-- Cómo usarlo: pega esto en Supabase → SQL Editor → Run.
-- Es idempotente, puedes ejecutarlo varias veces sin problema.
-- ============================================================================

DROP POLICY IF EXISTS "company_settings_owner_or_member" ON public.company_settings;

-- Lectura: el dueño, o cualquier miembro (empresa o empleado) vinculado
CREATE POLICY "company_settings_select_owner_or_member"
  ON public.company_settings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = company_settings.user_id
    )
  );

-- Escritura (insert/update/delete): el dueño, o un miembro cuyo rol NO sea Empleado
CREATE POLICY "company_settings_write_owner_or_admin_member"
  ON public.company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = company_settings.user_id AND p.role <> 'Empleado'
    )
  );

CREATE POLICY "company_settings_update_owner_or_admin_member"
  ON public.company_settings
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = company_settings.user_id AND p.role <> 'Empleado'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = company_settings.user_id AND p.role <> 'Empleado'
    )
  );

CREATE POLICY "company_settings_delete_owner_only"
  ON public.company_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- ✅ FIN
-- ============================================================================
