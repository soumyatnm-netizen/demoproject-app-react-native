-- Allow CC Staff to manage all company_invites records across companies
-- This preserves existing admin policies and simply grants staff elevated access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'company_invites' 
      AND policyname = 'cc_staff_manage_company_invites'
  ) THEN
    CREATE POLICY "cc_staff_manage_company_invites"
    ON public.company_invites
    FOR ALL
    TO authenticated
    USING (is_cc_staff(auth.uid()))
    WITH CHECK (is_cc_staff(auth.uid()));
  END IF;
END $$;
