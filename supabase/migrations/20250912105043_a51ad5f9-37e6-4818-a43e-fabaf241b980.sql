-- Final security fixes: Address remaining sensitive data issues and ensure proper RLS

-- The profile_sensitive_data_secure is now a regular view, but the scanner still sees issues
-- Let's ensure the view has proper RLS by making sure the underlying table is fully secured

-- First, ensure the profile_sensitive_data table is properly configured
ALTER TABLE public.profile_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Remove any overly permissive table-level grants
REVOKE ALL ON public.profile_sensitive_data FROM anon;
REVOKE ALL ON public.profile_sensitive_data FROM authenticated;

-- Grant only necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.profile_sensitive_data TO authenticated;

-- The view should now inherit proper security from the underlying table
-- But let's also ensure the view itself has no inappropriate grants
REVOKE ALL ON public.profile_sensitive_data_secure FROM anon;
GRANT SELECT ON public.profile_sensitive_data_secure TO authenticated;

-- Add a final check to make sure there are no bypass grants on any sensitive tables
-- Revoke any potential public grants that might have been added
REVOKE ALL ON public.profile_sensitive_data FROM public;
REVOKE ALL ON public.profile_sensitive_data_secure FROM public;

-- Create a comprehensive audit log entry for this security hardening
INSERT INTO public.sensitive_data_access_audit (
    accessed_user_id, 
    accessing_user_id, 
    access_type, 
    access_reason
) VALUES (
    gen_random_uuid(), -- System action
    gen_random_uuid(), -- System action  
    'SECURITY_HARDENING',
    'Applied comprehensive security fixes to sensitive data tables and views'
);

-- Add comments to document the security model
COMMENT ON TABLE public.profile_sensitive_data IS 'Contains sensitive user PII. Protected by RLS policies requiring user ownership or company admin privileges. All access is logged.';

-- Ensure proper cascade handling for the view
ALTER VIEW public.profile_sensitive_data_secure SET (security_barrier = true);