-- ============================================================================
-- RepartoPro — Calendario enriquecido: emoji, prioridad, ubicación,
-- responsable asignado, todo el día y hora de fin
-- ============================================================================

ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS emoji       text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS location    text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS priority    text NOT NULL DEFAULT 'media';
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS all_day     boolean NOT NULL DEFAULT false;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS end_time    text;

-- ✅ FIN
