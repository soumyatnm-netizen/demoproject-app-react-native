-- Fix critical security issue: Block anonymous access to profile_sensitive_data
DROP POLICY IF EXISTS "deny_anonymous_sensitive_data" ON public.profile_sensitive_data;
CREATE POLICY "deny_anonymous_sensitive_data" ON public.profile_sensitive_data
FOR ALL
TO anon
USING (false);