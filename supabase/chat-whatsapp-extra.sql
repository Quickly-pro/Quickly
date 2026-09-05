-- ============================================================================
-- RepartoPro — Chat: reacciones, responder, reenviar, leído, destacados
-- ----------------------------------------------------------------------------
-- Qué hace:
--   1. Reacciones con emoji a mensajes (tabla nueva)
--   2. Responder citando un mensaje (reply_to_id)
--   3. Marca de "reenviado"
--   4. Confirmación de lectura (doble check azul)
--   5. Mensajes destacados (por usuario, como en WhatsApp)
--
-- Cómo usarlo: pega esto entero en Supabase → SQL Editor → Run.
-- Idempotente.
-- ============================================================================

-- =========================================================
-- 1. Columnas nuevas en chat_messages
-- =========================================================
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES public.chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS forwarded   boolean NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_by     uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS starred_by  uuid[] NOT NULL DEFAULT '{}';

-- =========================================================
-- 2. Tabla de reacciones (una reacción por usuario y mensaje)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id          bigserial PRIMARY KEY,
  message_id  bigint NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_all" ON public.chat_message_reactions;
CREATE POLICY "reactions_select_all" ON public.chat_message_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reactions_insert_own" ON public.chat_message_reactions;
CREATE POLICY "reactions_insert_own" ON public.chat_message_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_update_own" ON public.chat_message_reactions;
CREATE POLICY "reactions_update_own" ON public.chat_message_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_delete_own" ON public.chat_message_reactions;
CREATE POLICY "reactions_delete_own" ON public.chat_message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- 3. RPC: reaccionar (tocar el mismo emoji lo quita; otro lo reemplaza)
-- =========================================================
CREATE OR REPLACE FUNCTION public.react_to_message(p_message_id bigint, p_emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT emoji INTO v_existing FROM public.chat_message_reactions
  WHERE message_id = p_message_id AND user_id = auth.uid();

  IF v_existing IS NOT NULL AND v_existing = p_emoji THEN
    DELETE FROM public.chat_message_reactions WHERE message_id = p_message_id AND user_id = auth.uid();
    RETURN jsonb_build_object('success', true, 'action', 'removed');
  ELSIF v_existing IS NOT NULL THEN
    UPDATE public.chat_message_reactions SET emoji = p_emoji, created_at = now()
    WHERE message_id = p_message_id AND user_id = auth.uid();
    RETURN jsonb_build_object('success', true, 'action', 'updated');
  ELSE
    INSERT INTO public.chat_message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);
    RETURN jsonb_build_object('success', true, 'action', 'added');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.react_to_message(bigint, text) TO authenticated;

-- =========================================================
-- 4. RPC: marcar como leídos todos los mensajes de una conversación
--    que no sean míos (para el doble check azul)
-- =========================================================
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_channel text, p_target_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  UPDATE public.chat_messages
  SET read_by = array_append(read_by, auth.uid())
  WHERE channel = p_channel
    AND ((p_target_id IS NULL AND target_id IS NULL) OR (target_id = p_target_id))
    AND (sender_id IS DISTINCT FROM auth.uid())
    AND NOT (auth.uid() = ANY(read_by));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_read(text, text) TO authenticated;

-- =========================================================
-- 5. RPC: destacar / quitar destacado (personal, no se comparte)
-- =========================================================
CREATE OR REPLACE FUNCTION public.toggle_star_message(p_message_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starred boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT (auth.uid() = ANY(starred_by)) INTO v_starred FROM public.chat_messages WHERE id = p_message_id;

  IF v_starred THEN
    UPDATE public.chat_messages SET starred_by = array_remove(starred_by, auth.uid()) WHERE id = p_message_id;
    RETURN jsonb_build_object('success', true, 'starred', false);
  ELSE
    UPDATE public.chat_messages SET starred_by = array_append(starred_by, auth.uid()) WHERE id = p_message_id;
    RETURN jsonb_build_object('success', true, 'starred', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_star_message(bigint) TO authenticated;

-- =========================================================
-- ✅ FIN
-- ============================================================================
