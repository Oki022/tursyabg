REVOKE ALL ON FUNCTION public.app_setting_int(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_setting_bool(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_welcome_bonus() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_phone_verified() FROM PUBLIC, anon, authenticated;
CREATE POLICY "No direct access to verification codes" ON public.phone_verification_codes
  FOR SELECT TO authenticated USING (false);
CREATE POLICY "No direct access to verification locks" ON public.phone_verification_locks
  FOR SELECT TO authenticated USING (false);