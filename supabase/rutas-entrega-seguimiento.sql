-- ============================================================================
-- RepartoPro — Optimización de rutas, prueba de entrega y seguimiento público
-- ============================================================================

-- =========================================================
-- 1. route_stops: coordenadas, prueba de entrega, y enlace público
-- =========================================================
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS photo_url       text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS signature_data  text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS delivery_notes  text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS tracking_token  uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS route_stops_tracking_token_key ON public.route_stops (tracking_token);

-- =========================================================
-- 2. Storage para fotos de prueba de entrega
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "delivery_proofs_upload" ON storage.objects;
CREATE POLICY "delivery_proofs_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-proofs');

DROP POLICY IF EXISTS "delivery_proofs_read" ON storage.objects;
CREATE POLICY "delivery_proofs_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'delivery-proofs');

-- =========================================================
-- 3. RPC pública de seguimiento (sin necesidad de login)
--    Devuelve SOLO los datos de esa parada concreta — nada más de la
--    empresa es visible con este token.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_public_tracking(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stop record;
  v_company_name text;
BEGIN
  SELECT * INTO v_stop FROM public.route_stops WHERE tracking_token = p_token;

  IF v_stop IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enlace no válido');
  END IF;

  SELECT name INTO v_company_name FROM public.company_settings WHERE user_id = v_stop.company_id;

  RETURN jsonb_build_object(
    'success', true,
    'client', v_stop.client,
    'address', v_stop.address,
    'status', v_stop.status,
    'driver', v_stop.driver,
    'delivered_at', v_stop.delivered_at,
    'delivered_to', v_stop.delivered_to,
    'photo_url', v_stop.photo_url,
    'company_name', COALESCE(v_company_name, 'tu proveedor')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tracking(uuid) TO anon, authenticated;

-- =========================================================
-- ✅ FIN
-- ============================================================================
