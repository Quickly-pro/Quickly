-- ============================================================
-- SCHEMA COMPLETO - Quickly App de Reparto
-- Pega en Supabase → SQL Editor → Run
-- ============================================================

-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- ============================================================
-- PERFILES (vinculado a auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text default 'empleado', -- 'empresa', 'empleado', 'cliente', 'repartidor'
  avatar_url text,
  phone text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
drop policy if exists "allow all" on public.profiles;
create policy "allow all" on public.profiles for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- CATEGORÍAS DE PRODUCTOS
-- ============================================================
create table if not exists public.product_categories (
  id bigint generated always as identity primary key,
  name text not null,
  sort_order integer default 0,
  color text default '#f97316',
  created_at timestamptz default now()
);

alter table public.product_categories enable row level security;
drop policy if exists "allow all" on public.product_categories;
create policy "allow all" on public.product_categories for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- PRODUCTOS
-- ============================================================
create table if not exists public.product_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id bigint references public.product_categories(id) on delete set null,
  price numeric default 0,
  stock numeric default 0,
  stock_actual integer default 0,
  min_stock numeric default 10,
  description text,
  status text default 'active',
  media jsonb default '[]',
  discount_enabled boolean default false,
  discount_price numeric,
  weight numeric,
  dimensions text,
  sku text,
  currency text default 'EUR',
  pricing_mode integer default 0,
  precio_unidad numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.product_items enable row level security;
drop policy if exists "allow all" on public.product_items;
create policy "allow all" on public.product_items for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  notes text,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.clients enable row level security;
drop policy if exists "allow all" on public.clients;
create policy "allow all" on public.clients for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- EMPLEADOS
-- ============================================================
create table if not exists public.employees (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  role text default 'repartidor',
  status text default 'active',
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.employees enable row level security;
drop policy if exists "allow all" on public.employees;
create policy "allow all" on public.employees for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- VEHÍCULOS
-- ============================================================
create table if not exists public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  plate text not null,
  brand text,
  model text,
  year integer,
  type text default 'furgoneta',
  status text default 'active',
  fuel_type text default 'diesel',
  km integer default 0,
  created_at timestamptz default now()
);

alter table public.vehicles enable row level security;
drop policy if exists "allow all" on public.vehicles;
create policy "allow all" on public.vehicles for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- RUTAS
-- ============================================================
create table if not exists public.routes (
  id uuid primary key default uuid_generate_v4(),
  name text,
  date date,
  status text default 'pending',
  driver_id uuid references public.employees(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

alter table public.routes enable row level security;
drop policy if exists "allow all" on public.routes;
create policy "allow all" on public.routes for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- PARADAS DE RUTA
-- ============================================================
create table if not exists public.route_stops (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid references public.routes(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  address text,
  status text default 'pending',
  sort_order integer default 0,
  notes text,
  created_at timestamptz default now()
);

alter table public.route_stops enable row level security;
drop policy if exists "allow all" on public.route_stops;
create policy "allow all" on public.route_stops for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- PEDIDOS
-- ============================================================
create table if not exists public.order_headers (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete set null,
  status text default 'pending',
  total numeric default 0,
  notes text,
  delivery_date date,
  created_at timestamptz default now()
);

alter table public.order_headers enable row level security;
drop policy if exists "allow all" on public.order_headers;
create policy "allow all" on public.order_headers for all to authenticated, anon using (true) with check (true);

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.order_headers(id) on delete cascade,
  product_id uuid references public.product_items(id) on delete set null,
  quantity numeric default 1,
  price numeric default 0,
  created_at timestamptz default now()
);

alter table public.order_items enable row level security;
drop policy if exists "allow all" on public.order_items;
create policy "allow all" on public.order_items for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  message text,
  type text default 'info',
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;
drop policy if exists "allow all" on public.notifications;
create policy "allow all" on public.notifications for all to authenticated, anon using (true) with check (true);

-- ============================================================
-- DATOS DE EJEMPLO
-- ============================================================
insert into public.product_categories (name, sort_order, color) values
  ('Panadería', 1, '#f97316'),
  ('Lácteos', 2, '#3b82f6'),
  ('Conservas', 3, '#10b981')
on conflict do nothing;

-- Verificar
select 'Tablas creadas correctamente' as resultado;
select table_name from information_schema.tables where table_schema = 'public' order by table_name;
