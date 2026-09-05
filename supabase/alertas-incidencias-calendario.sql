-- ============================================================================
-- RepartoPro — Alertas en tiempo real: Incidencias → empresa, Calendario → empleados
-- ============================================================================

-- =========================================================
-- 1. Incidencias (vehículo y producto): avisar SOLO a la empresa cuando
--    un empleado las reporta (nunca a otros empleados ni a clientes)
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_company_on_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_text  text;
BEGIN
  -- Si quien crea la incidencia ES la propia empresa, no hace falta autoavisarse
  IF NEW.company_id IS NULL OR NEW.company_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'vehicle_incidents' THEN
    v_title := 'Nueva incidencia de vehículo';
    v_text  := COALESCE(NEW.vehicle, 'Vehículo') || ' · ' || COALESCE(NEW.description, COALESCE(NEW.type, 'Sin descripción'));
  ELSE
    v_title := 'Nueva incidencia de producto';
    v_text  := COALESCE(NEW.product, 'Producto') || ' · ' || COALESCE(NEW.description, COALESCE(NEW.type, 'Sin descripción'));
  END IF;

  INSERT INTO public.notifications (user_id, title, text, type, read)
  VALUES (NEW.company_id, v_title, v_text, 'system', false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_company_vehicle_incident ON public.vehicle_incidents;
CREATE TRIGGER trg_notify_company_vehicle_incident
  AFTER INSERT ON public.vehicle_incidents
  FOR EACH ROW EXECUTE FUNCTION public.notify_company_on_incident();

DROP TRIGGER IF EXISTS trg_notify_company_product_incident ON public.product_incidents;
CREATE TRIGGER trg_notify_company_product_incident
  AFTER INSERT ON public.product_incidents
  FOR EACH ROW EXECUTE FUNCTION public.notify_company_on_incident();

-- =========================================================
-- 2. Calendario: avisar a TODOS los empleados de la empresa cuando la
--    empresa añade o cambia un evento (festivos, turnos, cambios de ruta...)
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_employees_on_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_empresa boolean;
  v_emp        record;
  v_action     text;
BEGIN
  SELECT lower(role) IN ('empresa', 'administrador', 'admin', 'dirección') INTO v_is_empresa
  FROM public.profiles WHERE id = auth.uid();

  -- Solo avisar si quien publica/cambia el evento es la empresa
  IF NOT COALESCE(v_is_empresa, false) THEN
    RETURN NEW;
  END IF;

  v_action := CASE WHEN TG_OP = 'INSERT' THEN 'Nuevo evento' ELSE 'Evento actualizado' END;

  FOR v_emp IN
    SELECT id FROM public.profiles WHERE company_id = NEW.company_id AND lower(role) = 'empleado'
  LOOP
    INSERT INTO public.notifications (user_id, title, text, type, read)
    VALUES (
      v_emp.id,
      v_action || ' en el calendario',
      NEW.title || ' · ' || to_char(NEW.date::date, 'DD/MM/YYYY') || COALESCE(' · ' || NEW.time, ''),
      'system',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_employees_calendar_insert ON public.calendar_events;
CREATE TRIGGER trg_notify_employees_calendar_insert
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_employees_on_calendar_event();

DROP TRIGGER IF EXISTS trg_notify_employees_calendar_update ON public.calendar_events;
CREATE TRIGGER trg_notify_employees_calendar_update
  AFTER UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_employees_on_calendar_event();

-- ✅ FIN
