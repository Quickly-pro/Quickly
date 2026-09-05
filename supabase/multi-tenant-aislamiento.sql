-- ============================================================================
-- RepartoPro — Aislamiento de datos entre empresas (multi-tenant)
-- ----------------------------------------------------------------------------
-- PROBLEMA que arregla:
--   Hasta ahora, CUALQUIER usuario autenticado podía leer y escribir los
--   datos de CUALQUIER otra empresa (clientes, facturas, rutas, empleados,
--   etc.) — las políticas eran "auth read/insert/update/delete USING (true)".
--   Esto funcionaba mientras solo tú probabas la app, pero en cuanto haya
--   una segunda empresa usando Quickly, cada una vería los datos de la otra.
--
-- SOLUCIÓN:
--   1. Cada tabla de negocio recibe una columna `company_id`.
--   2. Un disparador (trigger) la rellena solo automáticamente en cada
--      inserción nueva — así NO hace falta tocar ni una línea del código
--      de las páginas, todo lo hace la base de datos.
--   3. Las políticas de seguridad pasan de "cualquiera ve todo" a
--      "solo ves lo de tu propia empresa".
--   4. Los datos que ya existen se asignan automáticamente al primer
--      dueño de empresa (rol Administrador) que se registró — así no se
--      pierde nada de lo que ya tienes cargado.
--
-- Cómo usarlo: pega esto entero en Supabase → SQL Editor → Run.
-- Es idempotente — puedes ejecutarlo varias veces sin problema.
-- ============================================================================

-- =========================================================
-- 1. Función: "empresa efectiva" del usuario que hace la consulta
--    - Si es el dueño de una empresa (rol Empresa, sin company_id) → su
--      propio id hace de identificador de empresa (igual que ya haces
--      para Premium compartido).
--    - Si se unió a otra empresa (empleado o co-admin) → el id de esa
--      empresa (el que ya tienes en profiles.company_id).
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

-- =========================================================
-- 2. Disparador: rellena company_id solo si el cliente no lo mandó ya
--    (si alguien intentara falsificar el company_id de otra empresa,
--    la política de seguridad de abajo lo rechazaría igualmente)
-- =========================================================
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
-- 3. Aplicar a todas las tablas de negocio
-- =========================================================
DO $$
DECLARE
  t text;
  default_owner uuid;
BEGIN
  -- Dueño "por defecto" para asignar los datos que ya existían antes de
  -- este cambio (el primer Administrador registrado sin empresa propia).
  SELECT id INTO default_owner
  FROM public.profiles
  WHERE role = 'Administrador' AND company_id IS NULL
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

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
    -- Saltar tablas que no existen de verdad en esta base de datos
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      CONTINUE;
    END IF;

    -- Columna
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES auth.users(id) ON DELETE SET NULL', t);

    -- Rellenar datos existentes
    IF default_owner IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET company_id = $1 WHERE company_id IS NULL', t) USING default_owner;
    END IF;

    -- Autocompletar en cada fila nueva
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_company_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id_trigger()', t);

    -- Quitar las políticas viejas "todo el mundo puede todo"
    EXECUTE format('DROP POLICY IF EXISTS "auth read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth delete" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert" ON public.%I', t);

    -- Nuevas políticas: solo ves/escribes lo de tu propia empresa
    EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (company_id = public.get_effective_company_id())', t);
    EXECUTE format('CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = public.get_effective_company_id())', t);

    -- chat_messages ya tiene sus propias políticas de editar/borrar (solo
    -- el autor del mensaje) — no las tocamos, solo añadimos las de abajo
    -- si la tabla NO es chat_messages.
    IF t <> 'chat_messages' THEN
      EXECUTE format('DROP POLICY IF EXISTS "tenant_update" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "tenant_delete" ON public.%I', t);
      EXECUTE format('CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (company_id = public.get_effective_company_id()) WITH CHECK (company_id = public.get_effective_company_id())', t);
      EXECUTE format('CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (company_id = public.get_effective_company_id())', t);
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- 4. Clientes (rol "Cliente"): vincular su cuenta a la empresa correcta
--    Antes, un cliente se identificaba solo por su email. Ahora que
--    `clients` tiene company_id, aprovechamos ese mismo email para
--    saber de qué empresa es cliente, y guardarlo en su perfil.
-- =========================================================
UPDATE public.profiles p
SET company_id = c.company_id
FROM public.clients c
WHERE p.role = 'Cliente'
  AND p.company_id IS NULL
  AND c.email IS NOT NULL
  AND lower(p.email) = lower(c.email);

-- Que también se vincule automáticamente cuando un cliente NUEVO se registre
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role text;
  v_company uuid;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Cliente');

  IF v_role = 'Cliente' THEN
    SELECT company_id INTO v_company FROM public.clients WHERE lower(email) = lower(NEW.email) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    v_role,
    v_company
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================
-- 5. Notificaciones: cada quien ve solo las suyas (antes eran públicas)
-- =========================================================
DROP POLICY IF EXISTS "auth read" ON public.notifications;
DROP POLICY IF EXISTS "auth insert" ON public.notifications;
DROP POLICY IF EXISTS "auth update" ON public.notifications;
DROP POLICY IF EXISTS "auth delete" ON public.notifications;
DROP POLICY IF EXISTS "notif_own_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_own_insert" ON public.notifications;
DROP POLICY IF EXISTS "notif_own_update" ON public.notifications;
DROP POLICY IF EXISTS "notif_own_delete" ON public.notifications;
CREATE POLICY "notif_own_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_own_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_own_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_own_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =========================================================
-- 6. Suscripciones Premium: solo ves la de tu propia empresa
--    (antes, cualquiera podía ver el estado de pago de cualquier otra
--    empresa — no hace falta company_id nuevo, ya se identifica por
--    user_id, que ES el id de la empresa dueña de esa suscripción)
-- =========================================================
DROP POLICY IF EXISTS "auth read" ON public.subscriptions;
DROP POLICY IF EXISTS "sub_tenant_select" ON public.subscriptions;
CREATE POLICY "sub_tenant_select" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = public.get_effective_company_id());

-- =========================================================
-- ✅ FIN
-- ============================================================================
