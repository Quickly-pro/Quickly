-- ============================================================
-- COMPANY SETTINGS — datos de empresa por usuario
-- Pega en Supabase → SQL Editor → Run
-- ============================================================

create table if not exists public.company_settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  name          text    default '',
  legal_name    text    default '',
  cif           text    default '',
  address       text    default '',
  city          text    default '',
  postal_code   text    default '',
  phone         text    default '',
  email         text    default '',
  website       text    default '',
  logo          text    default '',
  brand_color   text    default '#f97316',
  founded       text    default '',
  employees     integer default 0,
  clients       integer default 0,
  monthly_revenue numeric default 0,
  payment_bizum   text  default '',
  payment_iban    text  default '',
  payment_paypal  text  default '',
  payment_stripe  text  default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.company_settings enable row level security;

drop policy if exists "company_settings_own" on public.company_settings;
create policy "company_settings_own"
  on public.company_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
