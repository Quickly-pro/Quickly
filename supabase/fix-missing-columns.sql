-- ============================================================
-- Fix: columnas que faltan para que todos los botones funcionen
-- Ejecutar en: Supabase → SQL Editor → Run
-- Es idempotente: se puede ejecutar varias veces sin errores
-- ============================================================

-- ── EMPLOYEES ─────────────────────────────────────────────────
-- schema-nuevo.sql usa avatar_url; migration-alinear-bd usa photo
-- Aseguramos que ambas existen para compatibilidad total
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url       text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo            text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department       text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS supervisor_id    bigint;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joined           date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hours_this_month numeric DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS routes_completed integer DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status           text DEFAULT 'active';

-- ── CALENDAR_EVENTS ───────────────────────────────────────────
-- La página calendario usa: date, time (text), type, description
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS date        date;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS time        text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS type        text DEFAULT 'reparto';
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS title       text;

-- ── ORDER_HEADERS ─────────────────────────────────────────────
-- schema-nuevo usa client_id y notes
-- Añadimos customer_id como alias y customer_notes como alias
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS client_id      uuid;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS customer_notes text;
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS currency       text DEFAULT 'EUR';
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS status         text DEFAULT 'pending_payment';
ALTER TABLE public.order_headers ADD COLUMN IF NOT EXISTS recipient      jsonb;

-- ── CLIENTS ───────────────────────────────────────────────────
-- Asegurar avatar_url para la página de clientes
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS avatar_url  text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact     text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_order  date;

-- ── VEHICLE_INCIDENTS ─────────────────────────────────────────
-- Asegurar assigned_to y photo
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS photo       text;
ALTER TABLE public.vehicle_incidents ADD COLUMN IF NOT EXISTS driver      text;

-- ── SHIFT_SCHEDULES (Cuadrante) ───────────────────────────────
-- La página cuadrante usa employee_id, week_start_date, day_index
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS employee_id    bigint;
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS week_start_date date;
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS day_index       integer DEFAULT 0;
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS shift_type      text DEFAULT '';
ALTER TABLE public.shift_schedules ADD COLUMN IF NOT EXISTS hours           numeric DEFAULT 8;

-- ── SHIFT_SWAPS ───────────────────────────────────────────────
-- La página cuadrante usa requester_employee_id, target_employee_id, etc.
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS requester_employee_id bigint;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS target_employee_id    bigint;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS requester_day_index   integer;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS target_day_index      integer;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS requester_shift_type  text;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS target_shift_type     text;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS week_start_date       date;
ALTER TABLE public.shift_swaps ADD COLUMN IF NOT EXISTS status                text DEFAULT 'pending';

-- ── VEHICLE_MAINTENANCE ───────────────────────────────────────
-- La página de mantenimiento de vehículos usa vehicle_name, maintenance_type, etc.
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS vehicle_name      text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS maintenance_type  text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS scheduled_date    date;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS status            text DEFAULT 'pendiente';
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS cost_estimate     numeric DEFAULT 0;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS mechanic          text;
ALTER TABLE public.vehicle_maintenance ADD COLUMN IF NOT EXISTS description       text;

-- ── VERIFICAR ─────────────────────────────────────────────────
SELECT 'fix-missing-columns.sql aplicado correctamente' AS resultado;
