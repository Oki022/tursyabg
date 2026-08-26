DO $do$
DECLARE r record; ddl text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc LIKE '%' || chr(8212) || '%'
  LOOP
    ddl := pg_get_functiondef(r.oid);
    ddl := replace(ddl, ' ' || chr(8212) || ' ', ', ');
    ddl := replace(ddl, chr(8212), ',');
    EXECUTE ddl;
  END LOOP;
END
$do$;