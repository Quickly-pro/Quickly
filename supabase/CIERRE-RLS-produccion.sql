-- ============================================================================
-- RepartoPro / Quickly — Cierre definitivo de RLS antes de producción
-- ----------------------------------------------------------------------------
-- QUÉ HACE:
--   A lo largo de varios scripts sueltos (fix-todo.sql, schema-nuevo.sql,
--   fix-products-rls.sql, fix-dashboard-schema.sql, fix-rls-*.sql) se crearon
--   políticas "allow_all_<tabla>" / "allow all" que dan acceso TOTAL a
--   "authenticated, anon" — es decir, también a peticiones SIN sesión, usando
--   solo la clave pública que ya va dentro de la app.
--
--   multi-tenant-aislamiento.sql añadió políticas correctas ("tenant_select",
--   etc.) pero NUNCA borró las anteriores. En Postgres, cuando dos políticas
--   permisivas conviven en la misma tabla, se combinan con OR — así que la
--   política abierta gana siempre y anula a la restrictiva, aunque ambas
--   sigan "instaladas".
--
--   Este script: 1) borra por nombre TODAS las políticas abiertas conocidas
--   en cada tabla, y 2) vuelve a crear (de forma idempotente, se puede
--   ejecutar varias veces sin romper nada) las políticas correctas de
--   aislamiento por empresa, perfil propio, notificaciones propias y
--   suscripción propia.
--
-- CÓMO USARLO: Supabase → SQL Editor → pega esto entero → Run.
-- Después, ejecuta la consulta de verificación al final (Sección F).
-- ============================================================================

-- =========================================================
-- A. Función "empresa efectiva" del usuario (igual que multi-tenant-aislamiento.sql,
--    CREATE OR REPLACE por si no se llegó a ejecutar antes)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_effective_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.profiles WHERE id = auth.uid()),
    auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.set_company_id_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_effective_company_id();
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================
-- B. Tablas de negocio: borrar TODAS las políticas abiertas conocidas
--    (por los dos nombres distintos que se usaron en los scripts sueltos)
--    y dejar solo el aislamiento por empresa.
-- =========================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'clients','order_headers','order_items','product_items','product_categories',
      'product_variants','product_skus','product_custom_fields','product_custom_values',
      'stock_movements','routes','route_stops','vehicles','vehicle_incidents',
      'vehicle_repairs','vehicle_maintenance','fuel_tickets','employees','time_tracking',
      'shift_schedules','shift_swaps','invoices','invoice_items','calendar_events',
      'chat_messages'
    ])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      CONTINUE;
    END IF;

    -- Borra las políticas abiertas de CUALQUIERA de los scripts anteriores
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "allow all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth delete" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon read" ON public.%I', t);

    -- Vuelve a dejar (o reafirma) el aislamiento por empresa
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES auth.users(id) ON DELETE SET NULL', t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_company_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id_trigger()', t);

    EXECUTE format('DROP POLICY IF EXISTS "tenant_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (company_id = public.get_effective_company_id())', t);
    EXECUTE format('CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = public.get_effective_company_id())', t);

    IF t <> 'chat_messages' THEN
      EXECUTE format('DROP POLICY IF EXISTS "tenant_update" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_delete" ON public.%I', t);
      EXECUTE format('CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (company_id = public.get_effective_company_id()) WITH CHECK (company_id = public.get_effective_company_id())', t);
      EXECUTE format('CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (company_id = public.get_effective_company_id())', t);
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- C. profiles — SOLO tu propia fila, nunca "allow_all_profiles" / "allow all"
-- =========================================================
DROP POLICY IF EXISTS "allow_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow all" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile self select" ON public.profiles;
DROP POLICY IF EXISTS "profile self update" ON public.profiles;
DROP POLICY IF EXISTS "profile self insert" ON public.profiles;
CREATE POLICY "profile self select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profile self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profile self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================================
-- D. notifications — solo las tuyas (schema-nuevo.sql las había dejado
--    públicas con "allow all")
-- =========================================================
DROP POLICY IF EXISTS "allow all" ON public.notifications;
DROP POLICY IF EXISTS "auth read" ON public.notifications;
DROP POLICY IF EXISTS "auth insert" ON public.notifications;
DROP POLICY IF EXISTS "auth update" ON public.notifications;
DROP POLICY IF EXISTS "auth delete" ON public.notifications;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_own_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_own_insert" ON public.notifications;
DROP POLICY IF EXISTS "notif_own_update" ON public.notifications;
DROP POLICY IF EXISTS "notif_own_delete" ON public.notifications;
CREATE POLICY "notif_own_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_own_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_own_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_own_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =========================================================
-- E. subscriptions — solo la de tu propia empresa
-- =========================================================
DROP POLICY IF EXISTS "allow all" ON public.subscriptions;
DROP POLICY IF EXISTS "auth read" ON public.subscriptions;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_tenant_select" ON public.subscriptions;
CREATE POLICY "sub_tenant_select" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = public.get_effective_company_id());

-- =========================================================
-- (Opcional) producto_elementos — tabla que no usa el código actual
-- (la app usa product_items, no esta). Se cierra por si acaso en vez de
-- borrarla, ya que no cuesta nada y evita dejar una puerta abierta suelta.
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='producto_elementos') THEN
    EXECUTE 'DROP POLICY IF EXISTS "allow all" ON public.producto_elementos';
    EXECUTE 'ALTER TABLE public.producto_elementos ENABLE ROW LEVEL SECURITY';
    -- Sin ninguna política = nadie puede leer/escribir salvo el service_role.
    -- Si en algún momento usas esta tabla de verdad, avísame y le hacemos
    -- una política de aislamiento por empresa como a las demás.
  END IF;
END $$;

-- =========================================================
-- F. VERIFICACIÓN — ejecuta esto después y comprueba que la lista sale VACÍA.
--    Si aparece alguna fila, esa tabla todavía tiene una política abierta.
-- =========================================================
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon' = ANY(roles)
ORDER BY tablename;
