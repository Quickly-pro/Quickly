-- ============================================================
-- MIGRACIÓN COMPLETA - Alinear schema Supabase con las páginas
-- Ejecutar en: Supabase → SQL Editor → Run
-- Es idempotente: seguro de re-ejecutar si algo ya existe
-- ============================================================

-- ── 1. CLIENTS ─────────────────────────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_spent numeric default 0;

-- ── 2. ROUTES ──────────────────────────────────────────────
-- Las páginas (rutas, mapa, dashboard) usan texto para driver/vehicle,
-- no los UUIDs que tiene el schema original
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS driver        text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS vehicle       text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS start_time   timestamptz;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS estimated_end text;

-- ── 3. ROUTE_STOPS ─────────────────────────────────────────
-- La página mapa-reparto inserta: client, phone, driver, order_num, lat, lng
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS order_num integer default 0;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS client   text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS phone    text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS driver   text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS lat      numeric;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS lng      numeric;

-- ── 4. ORDER_HEADERS ───────────────────────────────────────
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS subtotal_items   numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS shipping_total   numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS tax_total        numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS discount_price   numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS payment_provider text    default 'manual';

-- ── 5. VEHICLE_INCIDENTS ───────────────────────────────────
-- Asegurar columnas que usan las páginas incidencias e incidencias-vehiculo
-- La tabla se creó en la sesión anterior; ADD COLUMN IF NOT EXISTS es seguro
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS vehicle     text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS driver      text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS date        date;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS type        text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS status      text default 'abierta';
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS cost        numeric default 0;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS photo       text;

-- ── 6. VEHICLE_REPAIRS ─────────────────────────────────────
ALTER TABLE public.vehicle_repairs ADD COLUMN IF NOT EXISTS incident_id uuid references public.vehicle_incidents(id) on delete set null;
ALTER TABLE public.vehicle_repairs ADD COLUMN IF NOT EXISTS vehicle     text;
ALTER TABLE public.vehicle_repairs ADD COLUMN IF NOT EXISTS date        date;
ALTER TABLE public.vehicle_repairs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.vehicle_repairs ADD COLUMN IF NOT EXISTS cost        numeric default 0;
ALTER TABLE public.vehicle_repairs ADD COLUMN IF NOT EXISTS workshop    text;
ALTER TABLE public.vehicle_repairs ADD COLUMN IF NOT EXISTS status      text default 'pendiente';

-- ── 7. CALENDAR_EVENTS (usa EmpleadoDashboard) ─────────────
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  start_time timestamptz,
  end_time   timestamptz,
  all_day    boolean default false,
  color      text default '#f97316',
  notes      text,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.calendar_events;
CREATE POLICY "allow all" ON public.calendar_events
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ── 8. TABLA FACTURAS ──────────────────────────────────────
-- id bigint porque la página facturacion.tsx usa invoice_id como número
CREATE TABLE IF NOT EXISTS public.invoices (
  id             bigint generated always as identity primary key,
  invoice_number text,
  client         text,
  client_id      uuid references public.clients(id) on delete set null,
  date           date,
  due_date       date,
  amount         numeric  default 0,
  subtotal       numeric  default 0,
  tax            numeric  default 0,
  status         text     default 'pendiente', -- 'pendiente' | 'cobrado' | 'vencida'
  payment_method text     default 'Transferencia',
  notes          text,
  created_at     timestamptz default now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.invoices;
CREATE POLICY "allow all" ON public.invoices
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ── 9. LÍNEAS DE FACTURA ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          bigint generated always as identity primary key,
  invoice_id  bigint references public.invoices(id) on delete cascade,
  product     text,
  description text,
  qty         numeric default 1,
  price       numeric default 0,
  total       numeric default 0,
  created_at  timestamptz default now()
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.invoice_items;
CREATE POLICY "allow all" ON public.invoice_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ── 10. TICKETS DE COMBUSTIBLE ─────────────────────────────
-- Las páginas combustible e incidencias usan campos de texto, no UUIDs
CREATE TABLE IF NOT EXISTS public.fuel_tickets (
  id            uuid primary key default uuid_generate_v4(),
  vehicle       text,
  employee      text,
  date          date,
  time          text,
  liters        numeric default 0,
  cost          numeric default 0,
  station       text,
  invoice_photo text,
  created_at    timestamptz default now()
);
ALTER TABLE public.fuel_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.fuel_tickets;
CREATE POLICY "allow all" ON public.fuel_tickets
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ── VERIFICAR RESULTADO ────────────────────────────────────
SELECT 'Migración completada OK' AS resultado;

SELECT
  t.table_name,
  COUNT(c.column_name) AS num_columnas
FROM information_schema.tables t
JOIN information_schema.columns c
  ON c.table_name = t.table_name AND c.table_schema = 'public'
WHERE t.table_schema = 'public'
GROUP BY t.table_name
ORDER BY t.table_name;
