alter function public.bg_slug(text) set search_path = public;
revoke all on function public.bg_slug(text) from anon, authenticated;