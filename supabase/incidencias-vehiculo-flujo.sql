-- ============================================================================
-- RepartoPro — Incidencias de vehículo: flujo empleado → empresa
-- ----------------------------------------------------------------------------
-- Nuevo flujo:
--   1. El EMPLEADO reporta la incidencia (solo él puede crear)
--   2. La EMPRESA la marca como "vista"
--   3. La EMPRESA la envía a "taller" para su arreglo
--   4. La EMPRESA la marca como "lista" → el empleado que la reportó
--      recibe una notificación automática de que el vehículo está listo
-- ============================================================================

-- =========================================================
-- 1. Columnas nuevas: quién reportó, y marcas de tiempo del flujo
-- =========================================================
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS reporter_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS reporter_name text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS seen_at       timestamptz;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS workshop_at   timestamptz;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS ready_at      timestamptz;

-- Migrar los estados antiguos al nuevo flujo de 4 pasos
UPDATE public.vehicle_incidents SET status = 'reportada' WHERE status = 'abierta';
UPDATE public.vehicle_incidents SET status = 'en_taller' WHERE status = 'en_proceso';
UPDATE public.vehicle_incidents SET status = 'lista'     WHERE status = 'resuelta';

-- Autocompletar qui\u00e9n reporta (reutiliza el mismo disparador que ya
-- usamos en incidencias de producto)
DROP TRIGGER IF EXISTS trg_set_reporter_id ON public.vehicle_incidents;
CREATE TRIGGER trg_set_reporter_id BEFORE INSERT ON public.vehicle_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_reporter_id_trigger();

-- =========================================================
-- 2. Solo el empleado puede crear incidencias (la empresa NO)
-- =========================================================
DROP POLICY IF EXISTS "tenant_insert" ON public.vehicle_incidents;
CREATE POLICY "tenant_insert" ON public.vehicle_incidents FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_effective_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'empleado')
  );

-- =========================================================
-- 3. RPC: avanzar el estado del flujo (SOLO empresa) y notificar
--    al empleado cuando el vehículo queda listo
-- =========================================================
CREATE OR REPLACE FUNCTION public.advance_incident_status(p_incident_id bigint, p_new_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_empresa boolean;
  v_incident record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT lower(role) IN ('empresa', 'administrador', 'admin', 'dirección') INTO v_is_empresa
  FROM public.profiles WHERE id = auth.uid();

  IF NOT COALESCE(v_is_empresa, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo la empresa puede actualizar el estado');
  END IF;

  IF p_new_status NOT IN ('vista', 'en_taller', 'lista') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estado no válido');
  END IF;

  SELECT * INTO v_incident FROM public.vehicle_incidents WHERE id = p_incident_id;
  IF v_incident IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incidencia no encontrada');
  END IF;

  UPDATE public.vehicle_incidents
  SET status = p_new_status,
      seen_at = CASE WHEN p_new_status = 'vista' THEN now() ELSE seen_at END,
      workshop_at = CASE WHEN p_new_status = 'en_taller' THEN now() ELSE workshop_at END,
      ready_at = CASE WHEN p_new_status = 'lista' THEN now() ELSE ready_at END
  WHERE id = p_incident_id;

  -- Avisar al empleado que report\u00f3 la incidencia cuando el veh\u00edculo est\u00e9 listo
  IF p_new_status = 'lista' AND v_incident.reporter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, text, type, read)
    VALUES (
      v_incident.reporter_id,
      'Vehículo listo',
      'El vehículo ' || v_incident.vehicle || ' ya está reparado y listo para recogerlo.',
      'route',
      false
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_incident_status(bigint, text) TO authenticated;

-- ✅ FIN
