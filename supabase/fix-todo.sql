-- ============================================================
-- FIX COMPLETO — Ejecutar en Supabase → SQL Editor → Run
-- Añade columnas que faltan + activa permisos en todas las tablas
-- Es idempotente: se puede ejecutar múltiples veces sin errores
-- ============================================================

-- ── CLIENTS ───────────────────────────────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS avatar_url   text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact      text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_spent  numeric DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_order   date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city         text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postal_code  text;

-- ── EMPLOYEES ─────────────────────────────────────────────────
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url        text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo             text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department        text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS supervisor_id     bigint;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joined            date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hours_this_month  numeric DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS routes_completed  integer DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status            text DEFAULT 'active';

-- ── ORDER_HEADERS ─────────────────────────────────────────────
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS client_id       uuid;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS notes           text;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS customer_notes  text;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS total           numeric DEFAULT 0;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS status          text DEFAULT 'pending_payment';
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS currency        text DEFAULT 'EUR';
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS delivery_date   date;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS recipient       jsonb;

-- ── CALENDAR_EVENTS ───────────────────────────────────────────
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS date        date;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS time        text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS title       text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS type        text DEFAULT 'reparto';
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS description text;

-- ── VEHICLE_INCIDENTS ─────────────────────────────────────────
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS photo       text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS driver      text;

-- ── SHIFT_SCHEDULES ───────────────────────────────────────────
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS employee_id     bigint;
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS week_start_date  date;
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS day_index        integer DEFAULT 0;
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS shift_type       text DEFAULT '';
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS hours            numeric DEFAULT 8;

-- ── SHIFT_SWAPS ───────────────────────────────────────────────
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS requester_employee_id bigint;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS target_employee_id    bigint;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS requester_day_index   integer;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS target_day_index      integer;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS requester_shift_type  text;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS target_shift_type     text;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS week_start_date       date;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS status                text DEFAULT 'pending';

-- ── VEHICLE_MAINTENANCE ───────────────────────────────────────
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS vehicle_name      text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS maintenance_type  text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS scheduled_date    date;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS status            text DEFAULT 'pendiente';
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS cost_estimate     numeric DEFAULT 0;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS mechanic          text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS description       text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS current_km        integer DEFAULT 0;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS scheduled_km      integer;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS completed_date    date;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS completed_km      integer;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS notes             text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS recurrence_km     integer;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS recurrence_months integer;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS alert_email       text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS parent_maintenance_id bigint;

-- ── ROUTES (columnas extra que usa el código) ─────────────────
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS driver        text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS vehicle       text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS start_time    text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS estimated_end text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS status        text DEFAULT 'planificada';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS date          date;

-- ── ROUTE_STOPS ───────────────────────────────────────────────
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS client    text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS address   text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS status    text DEFAULT 'pending';
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS order_num integer DEFAULT 0;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS time      text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS route_id  bigint;

-- ── INVOICES ──────────────────────────────────────────────────
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client       text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount       numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status       text DEFAULT 'pendiente';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS date         date;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date     date;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes        text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id    uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_percent  numeric DEFAULT 21;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal     numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax          numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_email text;

-- ── INVOICE_ITEMS ─────────────────────────────────────────────
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS invoice_id  bigint;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS quantity    numeric DEFAULT 1;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS unit_price  numeric DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS total       numeric DEFAULT 0;

-- ── TIME_TRACKING ─────────────────────────────────────────────
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS employee    text;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS date        date;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS check_in    text;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS check_out   text;
ALTER TABLE public.time_tracking ADD COLUMN IF NOT EXISTS total_hours numeric;

-- ── FUEL_TICKETS ──────────────────────────────────────────────
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS vehicle       text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS employee      text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS date          date;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS time          text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS liters        numeric;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS cost          numeric;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS station       text;
ALTER TABLE public.fuel_tickets ADD COLUMN IF NOT EXISTS invoice_photo text;

-- ============================================================
-- PERMISOS RLS — permite todas las operaciones a usuarios
-- autenticados y anónimos (necesario para que la app funcione)
-- ============================================================

-- Función helper para aplicar política permisiva
-- (se ejecuta tabla por tabla)

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_clients" ON public.clients;
CREATE POLICY "allow_all_clients" ON public.clients FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_employees" ON public.employees;
CREATE POLICY "allow_all_employees" ON public.employees FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.order_headers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_order_headers" ON public.order_headers;
CREATE POLICY "allow_all_order_headers" ON public.order_headers FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_order_items" ON public.order_items;
CREATE POLICY "allow_all_order_items" ON public.order_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_calendar_events" ON public.calendar_events;
CREATE POLICY "allow_all_calendar_events" ON public.calendar_events FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.vehicle_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_vehicle_incidents" ON public.vehicle_incidents;
CREATE POLICY "allow_all_vehicle_incidents" ON public.vehicle_incidents FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.vehicle_repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_vehicle_repairs" ON public.vehicle_repairs;
CREATE POLICY "allow_all_vehicle_repairs" ON public.vehicle_repairs FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_vehicle_maintenance" ON public.vehicle_maintenance;
CREATE POLICY "allow_all_vehicle_maintenance" ON public.vehicle_maintenance FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_shift_schedules" ON public.shift_schedules;
CREATE POLICY "allow_all_shift_schedules" ON public.shift_schedules FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_shift_swaps" ON public.shift_swaps;
CREATE POLICY "allow_all_shift_swaps" ON public.shift_swaps FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_routes" ON public.routes;
CREATE POLICY "allow_all_routes" ON public.routes FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_route_stops" ON public.route_stops;
CREATE POLICY "allow_all_route_stops" ON public.route_stops FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_invoices" ON public.invoices;
CREATE POLICY "allow_all_invoices" ON public.invoices FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_invoice_items" ON public.invoice_items;
CREATE POLICY "allow_all_invoice_items" ON public.invoice_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.time_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_time_tracking" ON public.time_tracking;
CREATE POLICY "allow_all_time_tracking" ON public.time_tracking FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.fuel_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_fuel_tickets" ON public.fuel_tickets;
CREATE POLICY "allow_all_fuel_tickets" ON public.fuel_tickets FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_profiles" ON public.profiles;
CREATE POLICY "allow_all_profiles" ON public.profiles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Verificación final
SELECT 'fix-todo.sql aplicado correctamente — columnas y permisos OK' AS resultado;
