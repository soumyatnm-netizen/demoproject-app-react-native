-- ============================================================================
-- CRITICAL SECURITY FIX: Add explicit anonymous user denial policies
-- ============================================================================
-- This migration addresses critical security vulnerabilities where sensitive
-- tables lack policies explicitly blocking anonymous (unauthenticated) access.
-- ============================================================================

-- 1. PROFILES TABLE - Block anonymous access to employee data
-- Current risk: Employee names, job titles, departments, company data exposed
CREATE POLICY "deny_anonymous_profiles" ON public.profiles
FOR ALL 
TO anon
USING (false);

-- 2. PROFILE_SENSITIVE_DATA - Block anonymous access to PII
-- Current risk: Phone numbers, addresses, emergency contacts exposed
CREATE POLICY "deny_anonymous_sensitive_data" ON public.profile_sensitive_data
FOR ALL
TO anon
USING (false);

-- 3. COMPANY_INVITES - Block anonymous access to prevent email harvesting
-- Current risk: Employee emails and invite codes exposed
CREATE POLICY "deny_anonymous_invites" ON public.company_invites
FOR ALL
TO anon
USING (false);

-- 4. Additional security: Block anonymous access to other sensitive tables
CREATE POLICY "deny_anonymous_documents" ON public.documents
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_quotes" ON public.structured_quotes
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_policy_wordings" ON public.policy_wordings
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_comparisons" ON public.comparisons
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_reports" ON public.reports
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_client_reports" ON public.client_reports
FOR ALL
TO anon
USING (false);

-- 5. Audit tables - ensure anonymous users cannot view or manipulate audit logs
CREATE POLICY "deny_anonymous_login_audit" ON public.login_audit
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_file_access_audit" ON public.file_access_audit
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_pii_access_audit" ON public.pii_access_audit
FOR ALL
TO anon
USING (false);

-- 6. Block anonymous access to placement and market intelligence data
CREATE POLICY "deny_anonymous_placement_outcomes" ON public.placement_outcomes
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_market_intelligence" ON public.market_intelligence
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_market_predictions" ON public.market_predictions
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_underwriter_appetites" ON public.underwriter_appetites
FOR ALL
TO anon
USING (false);

CREATE POLICY "deny_anonymous_underwriter_appetite_data" ON public.underwriter_appetite_data
FOR ALL
TO anon
USING (false);

-- Add documentation comments
COMMENT ON POLICY "deny_anonymous_profiles" ON public.profiles IS 
'Critical security fix: Explicitly blocks anonymous access to employee directory data to prevent phishing and social engineering attacks';

COMMENT ON POLICY "deny_anonymous_sensitive_data" ON public.profile_sensitive_data IS 
'Critical security fix: Explicitly blocks anonymous access to personal contact information including phone numbers, addresses, and emergency contacts';

COMMENT ON POLICY "deny_anonymous_invites" ON public.company_invites IS 
'Critical security fix: Prevents email harvesting by blocking anonymous access to company invitation records';