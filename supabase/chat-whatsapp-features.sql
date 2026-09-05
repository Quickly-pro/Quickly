-- ============================================================================
-- RepartoPro — Chat estilo WhatsApp: audio real, editar y eliminar mensajes
-- ----------------------------------------------------------------------------
-- Qué hace:
--   1. Crea un bucket de Storage para notas de voz (en vez de guardarlas
--      como texto base64 gigante en la tabla — causa más probable de que
--      no se escuchara nada: quedaban truncadas o corruptas).
--   2. Añade quién envió cada mensaje (sender_id), para poder editar/borrar
--      solo tus propios mensajes.
--   3. Añade "editado" y "ocultar solo para mí".
--   4. Cierra el hueco de seguridad que había: ahora mismo CUALQUIER
--      usuario autenticado podía editar o borrar los mensajes de CUALQUIER
--      otra persona. A partir de aquí, solo tú puedes editar/borrar los tuyos.
--
-- Cómo usarlo: pega esto entero en Supabase → SQL Editor → Run.
-- Idempotente: puedes ejecutarlo varias veces sin problema.
-- ============================================================================

-- =========================================================
-- 1. Columnas nuevas en chat_messages
-- =========================================================
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at  timestamptz;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS hidden_for uuid[] NOT NULL DEFAULT '{}';

-- =========================================================
-- 2. Bucket de Storage para notas de voz
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_audio_upload" ON storage.objects;
CREATE POLICY "chat_audio_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-audio');

DROP POLICY IF EXISTS "chat_audio_read" ON storage.objects;
CREATE POLICY "chat_audio_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-audio');

DROP POLICY IF EXISTS "chat_audio_owner_delete" ON storage.objects;
CREATE POLICY "chat_audio_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-audio' AND owner = auth.uid());

-- =========================================================
-- 3. Endurecer permisos: solo el autor puede editar/borrar SU mensaje
--    (antes: "auth update"/"auth delete" permitía a cualquiera tocar
--    los mensajes de cualquier otra persona)
-- =========================================================
DROP POLICY IF EXISTS "auth update" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_update_own" ON public.chat_messages;
CREATE POLICY "chat_messages_update_own"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR sender_id IS NULL)
  WITH CHECK (sender_id = auth.uid() OR sender_id IS NULL);

DROP POLICY IF EXISTS "auth delete" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_own"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR sender_id IS NULL);

-- =========================================================
-- 4. RPC: editar un mensaje propio
-- =========================================================
CREATE OR REPLACE FUNCTION public.edit_chat_message(p_message_id bigint, p_new_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT sender_id INTO v_sender FROM public.chat_messages WHERE id = p_message_id;

  IF v_sender IS NULL OR v_sender <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo puedes editar tus propios mensajes');
  END IF;

  UPDATE public.chat_messages
  SET text = p_new_text, edited_at = now()
  WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_chat_message(bigint, text) TO authenticated;

-- =========================================================
-- 5. RPC: eliminar un mensaje propio para todos
-- =========================================================
CREATE OR REPLACE FUNCTION public.delete_chat_message_everyone(p_message_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT sender_id INTO v_sender FROM public.chat_messages WHERE id = p_message_id;

  IF v_sender IS NULL OR v_sender <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo puedes eliminar tus propios mensajes para todos');
  END IF;

  DELETE FROM public.chat_messages WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_chat_message_everyone(bigint) TO authenticated;

-- =========================================================
-- 6. RPC: ocultar un mensaje SOLO para mí (cualquier mensaje que veas,
--    tuyo o de otros — como "eliminar para mí" en WhatsApp)
-- =========================================================
CREATE OR REPLACE FUNCTION public.hide_chat_message_for_me(p_message_id bigint)
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
  SET hidden_for = array_append(hidden_for, auth.uid())
  WHERE id = p_message_id
    AND NOT (auth.uid() = ANY(hidden_for));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hide_chat_message_for_me(bigint) TO authenticated;

-- =========================================================
-- ✅ FIN
-- ============================================================================
