CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  participant_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_unique_pair UNIQUE (task_id, participant_a, participant_b),
  CONSTRAINT conversations_distinct_participants CHECK (participant_a <> participant_b)
);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_participant_read ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE POLICY conversations_participant_insert ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE POLICY conversations_participant_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b)
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE INDEX IF NOT EXISTS conversations_a_last_msg_idx ON public.conversations (participant_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_b_last_msg_idx ON public.conversations (participant_b, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_task_idx ON public.conversations (task_id);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at DESC);

DROP POLICY IF EXISTS messages_participant_read ON public.messages;
CREATE POLICY messages_participant_read ON public.messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS messages_sender_insert ON public.messages;
CREATE POLICY messages_sender_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
          AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
      )
    )
  );

CREATE OR REPLACE FUNCTION public.find_or_create_conversation(_task_id uuid, _other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _a uuid;
  _b uuid;
  _id uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _other_user = _me THEN
    RAISE EXCEPTION 'cannot message yourself';
  END IF;

  _a := LEAST(_me, _other_user);
  _b := GREATEST(_me, _other_user);

  INSERT INTO public.conversations (task_id, participant_a, participant_b)
  VALUES (_task_id, _a, _b)
  ON CONFLICT (task_id, participant_a, participant_b) DO UPDATE
    SET last_message_at = public.conversations.last_message_at
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_conversation(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations
      SET last_message_at = NEW.created_at
      WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_conversation ON public.messages;
CREATE TRIGGER messages_bump_conversation
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;