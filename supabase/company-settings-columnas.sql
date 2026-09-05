-- ============================================================================
-- RepartoPro — Asegurar que company_settings tiene todas las columnas
-- ============================================================================

ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS name             text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS legal_name       text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS cif              text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS address          text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS city             text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS postal_code      text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS phone            text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS email            text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS website          text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS logo             text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS brand_color      text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS founded          text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS employees        int;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS clients          int;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS monthly_revenue  numeric;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS payment_bizum    text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS payment_iban     text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS payment_paypal   text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS payment_stripe   text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS invite_code      text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- ✅ FIN
