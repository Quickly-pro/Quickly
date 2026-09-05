-- ============================================================================
-- RepartoPro — Turnos en Hoja de Pedidos
-- ============================================================================

ALTER TABLE public.order_sheet_rows ADD COLUMN IF NOT EXISTS turno int NOT NULL DEFAULT 1;

-- Actualizar create_order_row para aceptar el turno
CREATE OR REPLACE FUNCTION public.create_order_row(
  p_employee text,
  p_date     text,
  p_address  text DEFAULT '',
  p_items    jsonb DEFAULT '[]'::jsonb,
  p_turno    int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_empresa  boolean;
  v_company     uuid;
  v_new_id      bigint;
  v_employee_id uuid;
  v_item        jsonb;
  v_pos         int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT lower(role) IN ('empresa', 'administrador', 'admin', 'dirección') INTO v_is_empresa
  FROM public.profiles WHERE id = auth.uid();

  IF NOT COALESCE(v_is_empresa, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo la empresa puede crear pedidos');
  END IF;

  IF p_employee IS NULL OR trim(p_employee) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Falta el nombre del cliente');
  END IF;

  v_company := public.get_effective_company_id();

  INSERT INTO public.order_sheet_rows (company_id, employee, date, address, turno)
  VALUES (v_company, p_employee, COALESCE(p_date, ''), COALESCE(p_address, ''), COALESCE(p_turno, 1))
  RETURNING id INTO v_new_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pos := v_pos + 1;
    INSERT INTO public.order_sheet_items (company_id, row_id, product, quantity, position)
    VALUES (v_company, v_new_id, COALESCE(v_item->>'product', ''), COALESCE(v_item->>'quantity', ''), v_pos);
  END LOOP;

  SELECT id INTO v_employee_id
  FROM public.profiles
  WHERE lower(trim(full_name)) = lower(trim(p_employee))
    AND (company_id = v_company OR id = v_company)
    AND id <> auth.uid()
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, text, type, read)
    VALUES (v_employee_id, 'Nuevo pedido', 'Se añadió un nuevo pedido a Hoja de Pedidos para ti.', 'order', false);
  END IF;

  RETURN jsonb_build_object('success', true, 'row_id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_row(text, text, text, jsonb, int) TO authenticated;

-- ✅ FIN
