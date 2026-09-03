-- Google OAuth determines which accounts may authenticate. This migration ensures
-- that unauthenticated visitors cannot read or modify CRM data through Supabase.
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

    -- A permissive old policy (including an anon policy) would override the new
    -- restriction, so replace every existing table policy deliberately.
    FOR existing_policy IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = crm_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, crm_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'Authenticated organization users can access CRM data',
      crm_table
    );
  END LOOP;
END
$$;
