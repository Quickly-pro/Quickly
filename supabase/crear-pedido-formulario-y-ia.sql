-- ============================================================================
-- RepartoPro — Crear pedidos desde un formulario (o desde el Asistente IA)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order_row(
  p_employee text,
  p_date     text,
  p_product1 text DEFAULT '', p_cant1 text DEFAULT '',
  p_product2 text DEFAULT '', p_cant2 text DEFAULT '',
  p_product3 text DEFAULT '', p_cant3 text DEFAULT '',
  p_product4 text DEFAULT '', p_cant4 text DEFAULT ''
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
    RETURN jsonb_build_object('success', false, 'error', 'Falta el nombre del cliente/empleado');
  END IF;

  v_company := public.get_effective_company_id();

  INSERT INTO public.order_sheet_rows (company_id, employee, date, product1, cant1, product2, cant2, product3, cant3, product4, cant4)
  VALUES (v_company, p_employee, COALESCE(p_date, ''), p_product1, p_cant1, p_product2, p_cant2, p_product3, p_cant3, p_product4, p_cant4)
  RETURNING id INTO v_new_id;

  -- Avisar al empleado si su nombre coincide con una cuenta real
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

GRANT EXECUTE ON FUNCTION public.create_order_row(text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- ✅ FIN
