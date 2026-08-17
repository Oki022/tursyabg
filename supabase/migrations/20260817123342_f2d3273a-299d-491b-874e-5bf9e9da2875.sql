-- ENUM
CREATE TYPE public.task_status AS ENUM ('active','pending','pending_payment','inactive');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone text,
  city text,
  neighborhood text,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  budget numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  city text,
  neighborhood text,
  status public.task_status NOT NULL DEFAULT 'pending_payment',
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
GRANT SELECT ON public.tasks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_public_read_active" ON public.tasks FOR SELECT USING (status = 'active');
CREATE POLICY "tasks_owner_read" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tasks_owner_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_owner_update" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_owner_delete" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX tasks_status_created_idx ON public.tasks (status, created_at DESC);
CREATE INDEX tasks_category_idx ON public.tasks (category);
CREATE INDEX tasks_city_idx ON public.tasks (city);
CREATE INDEX tasks_user_idx ON public.tasks (user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TASK IMAGES
CREATE TABLE public.task_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_images TO authenticated;
GRANT ALL ON public.task_images TO service_role;
ALTER TABLE public.task_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_images_read" ON public.task_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (t.status = 'active' OR t.user_id = auth.uid()))
);
CREATE POLICY "task_images_owner_write" ON public.task_images FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE INDEX task_images_task_idx ON public.task_images (task_id, sort_order);

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_participant_read" ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_sender_insert" ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_participant_update" ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);
CREATE INDEX messages_receiver_read_idx ON public.messages (receiver_id, read_at);
CREATE INDEX messages_task_idx ON public.messages (task_id, created_at DESC);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;