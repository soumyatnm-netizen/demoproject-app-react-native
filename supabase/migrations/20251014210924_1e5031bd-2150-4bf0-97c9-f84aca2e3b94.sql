-- ============================================================================
-- SECURITY FIX: Strengthen broker_companies protection
-- ============================================================================

-- Remove the weak "deny all" policy and replace with explicit SELECT denial
DROP POLICY IF EXISTS "Deny all access to unauthenticated users" ON public.broker_companies;

-- Add explicit SELECT denial for anonymous users
CREATE POLICY "deny_anon_companies_select" ON public.broker_companies
FOR SELECT
TO anon
USING (false);

-- Ensure anonymous users cannot perform any operations
CREATE POLICY "deny_anon_companies_all" ON public.broker_companies
FOR ALL
TO anon
USING (false);

COMMENT ON POLICY "deny_anon_companies_select" ON public.broker_companies IS 
'Security fix: Explicitly blocks anonymous SELECT queries on company data';