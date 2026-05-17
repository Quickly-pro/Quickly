-- ============================================================
-- MIGRACIÓN: Columnas y tablas que necesita EmpresaDashboard
-- Pega en Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. COLUMNAS FALTANTES EN TABLAS EXISTENTES ─────────────

-- clients: total_spent (facturado acumulado)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_spent numeric default 0;

-- routes: driver (nombre del conductor), start_time (hora de inicio)
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS driver text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS start_time timestamptz;

-- order_headers: desglose de importes y proveedor de pago
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS subtotal_items   numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS shipping_total   numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS tax_total        numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS discount_price   numeric default 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS payment_provider text    default 'manual';

-- ── 2. TABLA FACTURAS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid references public.clients(id) on delete set null,
  client         text,                      -- nombre del cliente (desnormalizado para velocidad)
  invoice_number text,                      -- ej: "FAC-0001"
  amount         numeric default 0,
  status         text default 'pendiente',  -- 'pendiente' | 'cobrada' | 'vencida'
  due_date       date,
  notes          text,
  created_at     timestamptz default now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.invoices;
CREATE POLICY "allow all" ON public.invoices
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ── 3. TABLA TICKETS DE COMBUSTIBLE ───────────────────────
CREATE TABLE IF NOT EXISTS public.fuel_tickets (
  id         uuid primary key default uuid_generate_v4(),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id  uuid references public.employees(id) on delete set null,
  cost       numeric default 0,
  liters     numeric default 0,
  date       date,
  station    text,
  notes      text,
  created_at timestamptz default now()
);

ALTER TABLE public.fuel_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.fuel_tickets;
CREATE POLICY "allow all" ON public.fuel_tickets
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ── VERIFICAR ──────────────────────────────────────────────
SELECT 'Migración completada' AS resultado;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
