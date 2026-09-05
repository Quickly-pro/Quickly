-- ============================================================================
-- RepartoPro — Premium compartido por empresa (multi-usuario)
-- ----------------------------------------------------------------------------
-- Qué hace:
--   1. Permite que varias cuentas "empresa" compartan UNA misma empresa
--      (mismo company_settings, misma suscripción Premium) mediante un
--      código de invitación.
--   2. No borra ni rompe nada existente. Es idempotente: puedes ejecutarlo
--      varias veces sin problema.
--
-- Cómo usarlo:
--   - Pega este archivo entero en Supabase → SQL Editor → Run.
-- ============================================================================

-- =========================================================
-- 1. profiles: quién es el "propietario" de la empresa de cada usuario
--    company_id = NULL          -> el usuario ES el propietario (su propia empresa)
--    company_id = <otro user>   -> el usuario pertenece a la empresa de otro
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- =========================================================
-- 2. company_settings: código de invitación único por empresa
-- =========================================================
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS invite_code text;

-- Rellenar código para filas existentes que no lo tengan
UPDATE public.company_settings
SET invite_code = substr(md5(random()::text || clock_timestamp()::text), 1, 8)
WHERE invite_code IS NULL;

-- A partir de ahora, cualquier fila nueva recibe código automáticamente
ALTER TABLE public.company_settings
  ALTER COLUMN invite_code SET DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8);

-- Único, para poder buscar por código de forma fiable
CREATE UNIQUE INDEX IF NOT EXISTS company_settings_invite_code_key
  ON public.company_settings (invite_code);

-- =========================================================
-- 3. RLS: permitir que los MIEMBROS de una empresa (no solo el
--    propietario) puedan leer y editar su company_settings compartida.
-- =========================================================
DROP POLICY IF EXISTS "company_settings_own" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_owner_or_member" ON public.company_settings;

CREATE POLICY "company_settings_owner_or_member"
  ON public.company_settings
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = company_settings.user_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = company_settings.user_id
    )
  );

-- =========================================================
-- 4. RPC: unirse a una empresa existente mediante su código
--    SECURITY DEFINER: puede leer invite_code de cualquier empresa
--    (para buscar el código), pero SOLO puede escribir en la fila
--    de perfil del propio usuario que llama (auth.uid()).
-- =========================================================
CREATE OR REPLACE FUNCTION public.join_company_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   uuid;
  v_company    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT user_id, name INTO v_owner_id, v_company
  FROM public.company_settings
  WHERE invite_code = trim(p_code);

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;

  IF v_owner_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ese código es el de tu propia empresa');
  END IF;

  UPDATE public.profiles
  SET company_id = v_owner_id
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'company_name', v_company);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_company_by_code(text) TO authenticated;

-- =========================================================
-- 5. RPC: salir de la empresa a la que te uniste (vuelves a ser
--    propietario de tu propia cuenta, vacía)
-- =========================================================
CREATE OR REPLACE FUNCTION public.leave_company()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  UPDATE public.profiles
  SET company_id = NULL
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_company() TO authenticated;

-- =========================================================
-- 6. RPC: regenerar el código de invitación (el que llama pasa a
--    ser el propietario del nuevo código, sobre su propia fila)
-- =========================================================
CREATE OR REPLACE FUNCTION public.regenerate_invite_code()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  v_new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  UPDATE public.company_settings
  SET invite_code = v_new_code
  WHERE user_id = auth.uid();

  -- Si el usuario aún no tenía fila en company_settings, créala
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (user_id, invite_code)
    VALUES (auth.uid(), v_new_code);
  END IF;

  RETURN jsonb_build_object('success', true, 'invite_code', v_new_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_invite_code() TO authenticated;

-- =========================================================
-- ✅ FIN
-- ============================================================================
