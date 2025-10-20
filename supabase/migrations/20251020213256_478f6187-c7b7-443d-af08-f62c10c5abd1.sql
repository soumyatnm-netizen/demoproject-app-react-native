-- Add CC_STAFF role to app_role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t 
                   JOIN pg_enum e ON t.oid = e.enumtypid  
                   WHERE t.typname = 'app_role' AND e.enumlabel = 'CC_STAFF') THEN
        ALTER TYPE app_role ADD VALUE 'CC_STAFF';
    END IF;
END $$;

-- Ensure org_features table has proper structure for feature management
ALTER TABLE org_features ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE org_features ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;

-- Create index for faster CC_STAFF lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_cc_staff ON user_roles(user_id) WHERE role = 'CC_STAFF';

-- Add company metadata columns if they don't exist
ALTER TABLE broker_companies ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'basic';
ALTER TABLE broker_companies ADD COLUMN IF NOT EXISTS max_users integer DEFAULT 10;

-- Ensure RLS policies allow CC_STAFF to view all data
DROP POLICY IF EXISTS "cc_staff_view_all_orgs" ON orgs;
CREATE POLICY "cc_staff_view_all_orgs" ON orgs
  FOR SELECT TO authenticated
  USING (is_cc_staff(auth.uid()));

DROP POLICY IF EXISTS "cc_staff_manage_all_orgs" ON orgs;
CREATE POLICY "cc_staff_manage_all_orgs" ON orgs
  FOR ALL TO authenticated
  USING (is_cc_staff(auth.uid()))
  WITH CHECK (is_cc_staff(auth.uid()));

DROP POLICY IF EXISTS "cc_staff_view_all_companies" ON broker_companies;
CREATE POLICY "cc_staff_view_all_companies" ON broker_companies
  FOR SELECT TO authenticated
  USING (is_cc_staff(auth.uid()));

DROP POLICY IF EXISTS "cc_staff_manage_all_companies" ON broker_companies;
CREATE POLICY "cc_staff_manage_all_companies" ON broker_companies
  FOR ALL TO authenticated
  USING (is_cc_staff(auth.uid()))
  WITH CHECK (is_cc_staff(auth.uid()));

-- Allow CC_STAFF to view all users
DROP POLICY IF EXISTS "cc_staff_view_all_profiles" ON profiles;
CREATE POLICY "cc_staff_view_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (is_cc_staff(auth.uid()));

-- Allow CC_STAFF to view all documents for monitoring
DROP POLICY IF EXISTS "cc_staff_view_all_documents" ON documents;
CREATE POLICY "cc_staff_view_all_documents" ON documents
  FOR SELECT TO authenticated
  USING (is_cc_staff(auth.uid()));

-- Allow CC_STAFF to view all quotes for analytics
DROP POLICY IF EXISTS "cc_staff_view_all_quotes" ON structured_quotes;
CREATE POLICY "cc_staff_view_all_quotes" ON structured_quotes
  FOR SELECT TO authenticated
  USING (is_cc_staff(auth.uid()));

-- Allow CC_STAFF to view all placement outcomes
DROP POLICY IF EXISTS "cc_staff_view_all_placements" ON placement_outcomes;
CREATE POLICY "cc_staff_view_all_placements" ON placement_outcomes
  FOR SELECT TO authenticated
  USING (is_cc_staff(auth.uid()));

-- Allow CC_STAFF to view all client reports
DROP POLICY IF EXISTS "cc_staff_view_all_reports" ON client_reports;
CREATE POLICY "cc_staff_view_all_reports" ON client_reports
  FOR SELECT TO authenticated
  USING (is_cc_staff(auth.uid()));