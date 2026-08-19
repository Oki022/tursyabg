CREATE TABLE public.favourites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

GRANT SELECT, INSERT, DELETE ON public.favourites TO authenticated;
GRANT ALL ON public.favourites TO service_role;

ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favourites"
  ON public.favourites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favourites"
  ON public.favourites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favourites"
  ON public.favourites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX favourites_user_created_idx ON public.favourites (user_id, created_at DESC);
CREATE INDEX favourites_task_idx ON public.favourites (task_id);