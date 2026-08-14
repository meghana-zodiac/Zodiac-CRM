-- Defense in depth: the Google `hd` OAuth parameter is only an account-picker
-- hint. Database access must independently verify the authenticated identity.
CREATE OR REPLACE FUNCTION public.is_zodiac_google_workspace_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) ~ '^[^@]+@zodiachrc\.com$'
    AND coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google';
$$;

REVOKE ALL ON FUNCTION public.is_zodiac_google_workspace_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_zodiac_google_workspace_user() TO authenticated;

DO $$
DECLARE
  crm_table text;
  existing_policy record;
BEGIN
  FOREACH crm_table IN ARRAY ARRAY[
    'accounts', 'activities', 'cag_targets', 'call_logs', 'contacts', 'deals',
    'kra_targets', 'leads', 'poa_entries', 'trainers', 'training_batches',
    'training_requests'
  ]
  LOOP
    IF to_regclass(format('public.%I', crm_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', crm_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', crm_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', crm_table);

    FOR existing_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = crm_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, crm_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_zodiac_google_workspace_user()) WITH CHECK (public.is_zodiac_google_workspace_user())',
      'Zodiac Google Workspace users can access CRM data',
      crm_table
    );
  END LOOP;
END
$$;
