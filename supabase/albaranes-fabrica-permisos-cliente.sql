-- ============================================================================
-- RepartoPro — Albaranes reales, Pedidos a Fábrica reales, y aislar a Clientes
-- ----------------------------------------------------------------------------
-- 1. Albaranes: antes vivían solo en el navegador (se perdían al recargar).
--    Ahora es una tabla real, compartida entre dispositivos.
-- 2. Pedidos a Fábrica: mismo problema, mismo arreglo.
-- 3. Un cliente ahora solo ve SUS PROPIOS pedidos e incidencias — antes veía
--    los de todos los demás clientes también.
-- ============================================================================

-- =========================================================
-- 1. Tabla de Albaranes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.albaranes (
  id              text PRIMARY KEY,
  company_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client          text NOT NULL,
  client_address  text,
  client_phone    text,
  client_email    text,
  date            date NOT NULL DEFAULT current_date,
  delivery_date   date,
  delivered_at    timestamptz,
  delivered_by    text,
  driver          text,
  vehicle         text,
  status          text NOT NULL DEFAULT 'pendiente',
  items           jsonb NOT NULL DEFAULT '[]',
  subtotal        numeric NOT NULL DEFAULT 0,
  tax             numeric NOT NULL DEFAULT 0,
  total           numeric NOT NULL DEFAULT 0,
  notes           text,
  signature       text,
  signature_name  text,
  invoice_id      text,
  reject_reason   text,
  route_id        text,
  order_id        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.albaranes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_set_company_id ON public.albaranes;
CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.albaranes
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_trigger();

DROP POLICY IF EXISTS "albaranes_select" ON public.albaranes;
CREATE POLICY "albaranes_select" ON public.albaranes FOR SELECT TO authenticated
  USING (company_id = public.get_effective_company_id());

DROP POLICY IF EXISTS "albaranes_insert" ON public.albaranes;
CREATE POLICY "albaranes_insert" ON public.albaranes FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_effective_company_id());

DROP POLICY IF EXISTS "albaranes_update" ON public.albaranes;
CREATE POLICY "albaranes_update" ON public.albaranes FOR UPDATE TO authenticated
  USING (company_id = public.get_effective_company_id())
  WITH CHECK (company_id = public.get_effective_company_id());

DROP POLICY IF EXISTS "albaranes_delete" ON public.albaranes;
CREATE POLICY "albaranes_delete" ON public.albaranes FOR DELETE TO authenticated
  USING (company_id = public.get_effective_company_id());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.albaranes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- 2. Tabla de Pedidos a Fábrica
-- =========================================================
CREATE TABLE IF NOT EXISTS public.factory_orders (
  id                 text PRIMARY KEY,
  company_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  factory            text NOT NULL,
  product            text NOT NULL,
  qty                numeric NOT NULL DEFAULT 0,
  unit_price         numeric NOT NULL DEFAULT 0,
  total              numeric NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'en_proceso',
  expected_delivery  date,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.factory_orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_set_company_id ON public.factory_orders;
CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.factory_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_trigger();

DROP POLICY IF EXISTS "factory_orders_select" ON public.factory_orders;
CREATE POLICY "factory_orders_select" ON public.factory_orders FOR SELECT TO authenticated
  USING (company_id = public.get_effective_company_id());

DROP POLICY IF EXISTS "factory_orders_insert" ON public.factory_orders;
CREATE POLICY "factory_orders_insert" ON public.factory_orders FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_effective_company_id());

DROP POLICY IF EXISTS "factory_orders_update" ON public.factory_orders;
CREATE POLICY "factory_orders_update" ON public.factory_orders FOR UPDATE TO authenticated
  USING (company_id = public.get_effective_company_id())
  WITH CHECK (company_id = public.get_effective_company_id());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.factory_orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- 3. Helper: averiguar el id de "clients" que corresponde al usuario
--    que ha iniciado sesión (si es un cliente) — clients.id es uuid
-- =========================================================
DROP FUNCTION IF EXISTS public.my_client_id();
CREATE OR REPLACE FUNCTION public.my_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.clients c
  JOIN auth.users u ON lower(u.email) = lower(c.email)
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_cliente_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT lower(role) = 'cliente' FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- =========================================================
-- 4. order_headers: un cliente solo ve SUS pedidos, no los de otros
--    (comparamos como texto por si acaso client_id no es uuid puro)
-- =========================================================
DROP POLICY IF EXISTS "tenant_select" ON public.order_headers;
CREATE POLICY "tenant_select" ON public.order_headers FOR SELECT TO authenticated
  USING (
    company_id = public.get_effective_company_id()
    AND (NOT public.is_cliente_role() OR client_id::text = public.my_client_id()::text)
  );

-- =========================================================
-- 5. product_incidents: añadir aislamiento por empresa + por cliente
--    (esta tabla no se incluyó en la migración multi-tenant anterior)
-- =========================================================
ALTER TABLE public.product_incidents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.product_incidents ADD COLUMN IF NOT EXISTS reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
DECLARE
  default_owner uuid;
BEGIN
  SELECT id INTO default_owner FROM public.profiles WHERE role = 'Administrador' AND company_id IS NULL ORDER BY created_at ASC NULLS LAST LIMIT 1;
  IF default_owner IS NOT NULL THEN
    UPDATE public.product_incidents SET company_id = default_owner WHERE company_id IS NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_set_company_id ON public.product_incidents;
CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.product_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_trigger();

CREATE OR REPLACE FUNCTION public.set_reporter_id_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reporter_id IS NULL THEN
    NEW.reporter_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_reporter_id ON public.product_incidents;
CREATE TRIGGER trg_set_reporter_id BEFORE INSERT ON public.product_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_reporter_id_trigger();

DROP POLICY IF EXISTS "auth read" ON public.product_incidents;
DROP POLICY IF EXISTS "auth insert" ON public.product_incidents;
DROP POLICY IF EXISTS "auth update" ON public.product_incidents;
DROP POLICY IF EXISTS "auth delete" ON public.product_incidents;
DROP POLICY IF EXISTS "product_incidents_select" ON public.product_incidents;
CREATE POLICY "product_incidents_select" ON public.product_incidents FOR SELECT TO authenticated
  USING (
    company_id = public.get_effective_company_id()
    AND (NOT public.is_cliente_role() OR reporter_id = auth.uid())
  );

DROP POLICY IF EXISTS "product_incidents_insert" ON public.product_incidents;
CREATE POLICY "product_incidents_insert" ON public.product_incidents FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_effective_company_id());

DROP POLICY IF EXISTS "product_incidents_update" ON public.product_incidents;
CREATE POLICY "product_incidents_update" ON public.product_incidents FOR UPDATE TO authenticated
  USING (company_id = public.get_effective_company_id())
  WITH CHECK (company_id = public.get_effective_company_id());

-- =========================================================
-- ✅ FIN
-- ============================================================================
