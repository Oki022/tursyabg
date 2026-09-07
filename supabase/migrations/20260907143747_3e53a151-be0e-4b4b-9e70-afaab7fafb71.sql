CREATE OR REPLACE FUNCTION public.submit_contact_message(
  _name text, _email text, _subject text, _body text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid;
BEGIN
  _name := trim(coalesce(_name, ''));
  _email := trim(coalesce(_email, ''));
  _subject := trim(coalesce(_subject, ''));
  _body := trim(coalesce(_body, ''));

  IF length(_name) < 2 OR length(_name) > 120 THEN
    RAISE EXCEPTION 'CONTACT_INVALID_NAME' USING ERRCODE = 'check_violation';
  END IF;
  IF _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
    RAISE EXCEPTION 'CONTACT_INVALID_EMAIL' USING ERRCODE = 'check_violation';
  END IF;
  IF length(_subject) < 2 OR length(_subject) > 120 THEN
    RAISE EXCEPTION 'CONTACT_INVALID_SUBJECT' USING ERRCODE = 'check_violation';
  END IF;
  IF length(_body) < 10 OR length(_body) > 4000 THEN
    RAISE EXCEPTION 'CONTACT_INVALID_BODY' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.contact_messages (user_id, name, email, subject, body, status)
  VALUES (auth.uid(), _name, _email, _subject, _body, 'new')
  RETURNING id INTO _id;

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.submit_contact_message(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_message(text, text, text, text) TO anon, authenticated;
