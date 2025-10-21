-- Allow CC Staff to view all company invites across all companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'company_invites' 
      AND policyname = 'cc_staff_view_all_invites'
  ) THEN
    CREATE POLICY "cc_staff_view_all_invites"
    ON public.company_invites
    FOR SELECT
    TO authenticated
    USING (is_cc_staff(auth.uid()));
  END IF;
END $$;