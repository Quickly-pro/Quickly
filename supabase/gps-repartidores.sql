-- ============================================================================
-- RepartoPro — GPS real de repartidores
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_name text,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  heading     numeric,
  speed_kmh   numeric,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  sharing     boolean NOT NULL DEFAULT true
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Reutiliza el mismo disparador de company_id que el resto de tablas
DROP TRIGGER IF EXISTS trg_set_company_id ON public.driver_locations;
CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_trigger();

DROP POLICY IF EXISTS "driver_locations_self_write" ON public.driver_locations;
CREATE POLICY "driver_locations_self_write"
  ON public.driver_locations FOR ALL TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "driver_locations_company_read" ON public.driver_locations;
CREATE POLICY "driver_locations_company_read"
  ON public.driver_locations FOR SELECT TO authenticated
  USING (company_id = public.get_effective_company_id());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ✅ FIN
