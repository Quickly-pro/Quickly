-- ============================================================================
-- RepartoPro — Migración de alineación BD ↔ código
-- ----------------------------------------------------------------------------
-- Lo que hace:
--   1. Renombra tus tablas en español a inglés (lo que espera el código)
--   2. Añade las columnas en inglés que necesita la app (sin borrar las tuyas)
--   3. Crea las 14 tablas que faltan
--   4. Aplica RLS básico
--
-- Cómo usarlo:
--   - Pega este archivo entero en el SQL Editor de Supabase y ejecuta.
--   - Es IDEMPOTENTE: puedes ejecutarlo varias veces sin romper nada.
--   - NO borra columnas. Si tenías `nombre` en `clientes`, queda intacta.
--     Solo añade `name` para que el código pueda escribir/leer ahí.
--
-- Si después quieres migrar tus datos viejos (col. españolas → inglesas),
-- ejecuta los UPDATE comentados al final del archivo.
-- ============================================================================

-- =========================================================
-- 1. RENAME tablas existentes en español → inglés
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clientes') THEN
    ALTER TABLE public.clientes RENAME TO clients;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pedidos') THEN
    ALTER TABLE public.pedidos RENAME TO order_headers;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pedido_items') THEN
    ALTER TABLE public.pedido_items RENAME TO order_items;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='productos') THEN
    ALTER TABLE public.productos RENAME TO product_items;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rutas') THEN
    ALTER TABLE public.rutas RENAME TO routes;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vehiculos') THEN
    ALTER TABLE public.vehiculos RENAME TO vehicles;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='combustible_logs') THEN
    ALTER TABLE public.combustible_logs RENAME TO fuel_tickets;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='incidencias') THEN
    ALTER TABLE public.incidencias RENAME TO vehicle_incidents;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='asistencia') THEN
    ALTER TABLE public.asistencia RENAME TO time_tracking;
  END IF;
END $$;

-- =========================================================
-- 2. CLIENTS — asegurar columnas en inglés que usa la app
-- =========================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS name        text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact     text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone       text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email       text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address     text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status      text DEFAULT 'activo';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS avatar      text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes       text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_order  date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

-- =========================================================
-- 3. ORDER_HEADERS / ORDER_ITEMS
-- =========================================================
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS client          text;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS status          text DEFAULT 'pending';
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS subtotal_items  numeric DEFAULT 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS shipping_total  numeric DEFAULT 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS tax_total       numeric DEFAULT 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS discount_price  numeric DEFAULT 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS total           numeric DEFAULT 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS route           text;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS notes           text;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS order_id   uuid;     -- FK a order_headers(id), tipo uuid (Supabase default)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product    text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS qty        numeric DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price      numeric DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total      numeric DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- =========================================================
-- 4. PRODUCT_ITEMS / PRODUCT_CATEGORIES (+ resto productos)
-- =========================================================
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS name             text;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS category_id      bigint;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS price            numeric DEFAULT 0;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS discount_enabled boolean DEFAULT false;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS discount_price   numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS media            jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS status           text DEFAULT 'active';
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS sku              text;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS weight           numeric;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS dimensions       text;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS description      text;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS stock            numeric DEFAULT 0;
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now();
ALTER TABLE public.product_items ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.product_categories (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  slug        text,
  parent_id   bigint REFERENCES public.product_categories(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- NOTA: tus tablas existentes usan UUID como id (default de Supabase),
-- así que los FK son UUID. Si en alguna fuera bigint, sustituye uuid por bigint.

CREATE TABLE IF NOT EXISTS public.product_variants (
  id          bigserial PRIMARY KEY,
  product_id  uuid,
  name        text,
  sku         text,
  price       numeric,
  stock       numeric DEFAULT 0,
  attributes  jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_skus (
  id          bigserial PRIMARY KEY,
  product_id  uuid,
  sku         text NOT NULL,
  stock       numeric DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_custom_fields (
  id          bigserial PRIMARY KEY,
  product_id  uuid,
  field_name  text NOT NULL,
  field_type  text DEFAULT 'text',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_custom_values (
  id          bigserial PRIMARY KEY,
  product_id  uuid,
  field_id    bigint REFERENCES public.product_custom_fields(id) ON DELETE CASCADE,
  value       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id          bigserial PRIMARY KEY,
  product_id  uuid,
  type        text DEFAULT 'in',         -- in / out / adjust
  qty         numeric DEFAULT 0,
  date        timestamptz DEFAULT now(),
  notes       text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- =========================================================
-- 5. ROUTES y ROUTE_STOPS
-- =========================================================
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS name           text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS driver         text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS vehicle        text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS date           date;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS status         text DEFAULT 'planned';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS start_time     timestamptz;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS estimated_end  timestamptz;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS notes          text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.route_stops (
  id           bigserial PRIMARY KEY,
  route_id     uuid,                        -- FK a public.routes(id) — sin REFERENCES por compat. de tipos
  client       text,
  address      text,
  phone        text,
  notes        text,
  lat          numeric,
  lng          numeric,
  order_num    integer DEFAULT 0,
  status       text DEFAULT 'pending',     -- pending / completed / skipped
  driver       text,
  delivered_at timestamptz,
  delivered_to text,
  created_at   timestamptz DEFAULT now()
);

-- =========================================================
-- 6. VEHICLES + INCIDENCIAS y MANTENIMIENTO
-- =========================================================
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS model         text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS plate         text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS year          integer;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS mileage       numeric DEFAULT 0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_service  date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS next_service  date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS fuel_type     text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS status        text DEFAULT 'active';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS vehicle      text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS type         text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS description  text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS status       text DEFAULT 'abierto';
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS date         date;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS cost         numeric DEFAULT 0;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS photos       jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS assigned_to  text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.vehicle_repairs (
  id          bigserial PRIMARY KEY,
  vehicle     text,
  date        date,
  description text,
  cost        numeric DEFAULT 0,
  mechanic    text,
  status      text DEFAULT 'completed',
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id          bigserial PRIMARY KEY,
  vehicle     text,
  date        date,
  type        text,
  mileage     numeric,
  notes       text,
  cost        numeric DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- =========================================================
-- 7. FUEL_TICKETS (ya renombrada de combustible_logs)
-- =========================================================
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS vehicle    text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS driver     text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS date       date DEFAULT CURRENT_DATE;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS liters     numeric DEFAULT 0;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS price      numeric DEFAULT 0;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS total      numeric DEFAULT 0;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS fuel_type  text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS station    text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS photo      text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS notes      text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- =========================================================
-- 8. EMPLOYEES + TIME_TRACKING + CUADRANTE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id                 bigserial PRIMARY KEY,
  name               text NOT NULL,
  role               text DEFAULT 'Repartidor',
  phone              text,
  email              text,
  photo              text,
  joined             date,
  hours_this_month   numeric DEFAULT 0,
  routes_completed   integer DEFAULT 0,
  status             text DEFAULT 'active',
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS employee     text;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS date         date DEFAULT CURRENT_DATE;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS check_in     timestamptz;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS check_out    timestamptz;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS total_hours  numeric;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS notes        text;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.shift_schedules (
  id           bigserial PRIMARY KEY,
  employee     text NOT NULL,
  date         date NOT NULL,
  shift_type   text DEFAULT 'morning',
  hours        numeric DEFAULT 8,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id                    bigserial PRIMARY KEY,
  requester_id          bigint REFERENCES public.employees(id) ON DELETE SET NULL,
  target_id             bigint REFERENCES public.employees(id) ON DELETE SET NULL,
  requester_shift_id    bigint REFERENCES public.shift_schedules(id) ON DELETE SET NULL,
  target_shift_id       bigint REFERENCES public.shift_schedules(id) ON DELETE SET NULL,
  status                text DEFAULT 'pending',     -- pending / accepted / rejected
  message               text,
  created_at            timestamptz DEFAULT now()
);

-- =========================================================
-- 9. INVOICES / INVOICE_ITEMS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id              text PRIMARY KEY,                 -- ej. F-2026-0042
  invoice_number  text,
  client          text,
  client_id       uuid,                             -- FK a clients(id) — sin REFERENCES por compat.
  amount          numeric DEFAULT 0,
  subtotal        numeric DEFAULT 0,
  tax             numeric DEFAULT 0,
  status          text DEFAULT 'pendiente',         -- pendiente / cobrado / vencida
  date            date DEFAULT CURRENT_DATE,
  due_date        date,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id           bigserial PRIMARY KEY,
  invoice_id   text REFERENCES public.invoices(id) ON DELETE CASCADE,
  product      text,
  qty          numeric DEFAULT 0,
  price        numeric DEFAULT 0,
  total        numeric DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- =========================================================
-- 10. CALENDAR_EVENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          bigserial PRIMARY KEY,
  title       text NOT NULL,
  description text,
  date        date,
  start_time  timestamptz,
  end_time    timestamptz,
  type        text DEFAULT 'general',
  color       text,
  notes       text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- =========================================================
-- 11. NOTIFICATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  text        text,
  type        text DEFAULT 'system',     -- invoice / route / stock / order / system / maintenance / email
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- =========================================================
-- 12. CHAT_MESSAGES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id            bigserial PRIMARY KEY,
  sender_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel       text DEFAULT 'general',
  content       text NOT NULL,
  attachments   jsonb DEFAULT '[]'::jsonb,
  created_at    timestamptz DEFAULT now()
);

-- =========================================================
-- 13. SUBSCRIPTIONS (Stripe)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       bigserial PRIMARY KEY,
  user_id                  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status                   text DEFAULT 'inactive',  -- active / trialing / past_due / canceled / inactive
  plan                     text,
  stripe_customer_id       text,
  stripe_subscription_id   text,
  current_period_end       timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- =========================================================
-- 14. SPREADSHEET (Hoja de cálculo)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.spreadsheet_palettes (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text,
  colors      jsonb DEFAULT '[]'::jsonb,
  is_active   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.spreadsheet_cells (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  row_index   integer NOT NULL,
  col_index   integer NOT NULL,
  value       text,
  format      jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, row_index, col_index)
);

-- =========================================================
-- 15. PROFILES — asegurar columnas opcionales que usa el registro
-- =========================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- =========================================================
-- 16. RLS — mínimo viable (autenticados pueden leer/escribir)
--     Si quieres reglas más finas por rol, dímelo y las refinamos.
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'clients','order_headers','order_items','product_items','product_categories',
      'product_variants','product_skus','product_custom_fields','product_custom_values',
      'stock_movements','routes','route_stops','vehicles','vehicle_incidents',
      'vehicle_repairs','vehicle_maintenance','fuel_tickets','employees','time_tracking',
      'shift_schedules','shift_swaps','invoices','invoice_items','calendar_events',
      'notifications','chat_messages','subscriptions','spreadsheet_palettes','spreadsheet_cells'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth read"   ON public.%I; CREATE POLICY "auth read"   ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth insert" ON public.%I; CREATE POLICY "auth insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true);', t, t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth update" ON public.%I; CREATE POLICY "auth update" ON public.%I FOR UPDATE TO authenticated USING (true);', t, t);
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth delete" ON public.%I; CREATE POLICY "auth delete" ON public.%I FOR DELETE TO authenticated USING (true);', t, t);
  END LOOP;
END $$;

-- Profiles: cada usuario solo gestiona su propio perfil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile self select" ON public.profiles;
CREATE POLICY "profile self select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profile self update" ON public.profiles;
CREATE POLICY "profile self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profile self insert" ON public.profiles;
CREATE POLICY "profile self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================================
-- 17. TRIGGER opcional: crear profile al registrarse en Auth
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Cliente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- ✅ FIN DE LA MIGRACIÓN
-- ============================================================================
-- (OPCIONAL) Si quieres copiar datos de tus columnas en español a las inglesas
-- descomenta y ajusta según los nombres reales que tuvieras:
--
-- UPDATE public.clients SET name    = nombre   WHERE name IS NULL AND nombre IS NOT NULL;
-- UPDATE public.clients SET phone   = telefono WHERE phone IS NULL AND telefono IS NOT NULL;
-- UPDATE public.clients SET address = direccion WHERE address IS NULL AND direccion IS NOT NULL;
-- ... etc.
-- ============================================================================
