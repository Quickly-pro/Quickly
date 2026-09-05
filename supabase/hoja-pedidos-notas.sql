-- ============================================================================
-- RepartoPro — Notas de Hoja de Pedidos (solo empresa edita) + notificaciones reales
-- ----------------------------------------------------------------------------
-- Qué hace:
--   1. Conecta de verdad la tabla de notificaciones (hasta ahora la campanita
--      solo mostraba datos de ejemplo guardados en el navegador — no llegaban
--      de verdad a nadie).
--   2. Crea una tabla para las notas de "Hoja de Pedidos", compartida entre
--      dispositivos (antes vivía solo en el navegador de quien la escribía).
--   3. Solo la empresa puede escribir/editar esa nota — el empleado solo
--      puede verla.
--   4. Al guardar una nota, se le crea una notificación real al empleado
--      cuyo nombre coincide con esa fila.
-- ============================================================================

-- =========================================================
-- 1. Tabla notifications: asegurar columnas necesarias
-- =========================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title      text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS text       text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type       text DEFAULT 'system';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read       boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- 2. Tabla de notas de Hoja de Pedidos (compartida, no local)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.order_sheet_notes (
  row_id        bigint PRIMARY KEY,
  company_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_name text,
  note          text NOT NULL DEFAULT '',
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_sheet_notes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_set_company_id ON public.order_sheet_notes;
CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.order_sheet_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_trigger();

-- Cualquiera de la empresa (empresa o empleado) puede LEER las notas
DROP POLICY IF EXISTS "order_notes_read" ON public.order_sheet_notes;
CREATE POLICY "order_notes_read"
  ON public.order_sheet_notes FOR SELECT TO authenticated
  USING (company_id = public.get_effective_company_id());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_sheet_notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- 3. RPC: guardar nota (SOLO empresa) + notificar al empleado
-- =========================================================
CREATE OR REPLACE FUNCTION public.save_order_note(p_row_id bigint, p_employee_name text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company    uuid;
  v_is_empresa boolean;
  v_employee_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT lower(role) IN ('empresa', 'administrador', 'admin', 'dirección') INTO v_is_empresa
  FROM public.profiles WHERE id = auth.uid();

  IF NOT COALESCE(v_is_empresa, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo la empresa puede editar esta nota');
  END IF;

  v_company := public.get_effective_company_id();

  INSERT INTO public.order_sheet_notes (row_id, company_id, employee_name, note, updated_by, updated_at)
  VALUES (p_row_id, v_company, p_employee_name, p_note, auth.uid(), now())
  ON CONFLICT (row_id) DO UPDATE
  SET note = EXCLUDED.note, employee_name = EXCLUDED.employee_name, updated_by = auth.uid(), updated_at = now();

  -- Notificar al empleado si su nombre coincide con alguien de la empresa
  SELECT id INTO v_employee_id
  FROM public.profiles
  WHERE lower(trim(full_name)) = lower(trim(p_employee_name))
    AND (company_id = v_company OR id = v_company)
    AND id <> auth.uid()
  LIMIT 1;

  IF v_employee_id IS NOT NULL AND length(trim(p_note)) > 0 THEN
    INSERT INTO public.notifications (user_id, title, text, type, read)
    VALUES (
      v_employee_id,
      'Nota en tu pedido',
      'La empresa dejó una nota: "' || left(p_note, 100) || '"',
      'order',
      false
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_order_note(bigint, text, text) TO authenticated;

-- =========================================================
-- ✅ FIN
-- ============================================================================
