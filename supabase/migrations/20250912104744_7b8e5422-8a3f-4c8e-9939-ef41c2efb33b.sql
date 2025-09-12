-- Fix critical security vulnerability: profile_sensitive_data_secure table has no RLS policies
-- This table contains PII (phone numbers, addresses, emergency contacts) and must be secured

-- Enable Row Level Security on the sensitive data secure table
ALTER TABLE public.profile_sensitive_data_secure ENABLE ROW LEVEL SECURITY;

-- Revoke any existing overly permissive grants
REVOKE ALL ON public.profile_sensitive_data_secure FROM anon;
REVOKE ALL ON public.profile_sensitive_data_secure FROM authenticated;

-- Grant only necessary permissions to authenticated users
GRANT SELECT ON public.profile_sensitive_data_secure TO authenticated;

-- Create secure RLS policies for sensitive data access

-- Policy 1: Users can only view their own sensitive data with audit logging
CREATE POLICY "Users can view own sensitive data with logging"
ON public.profile_sensitive_data_secure
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    AND (log_sensitive_data_access(
        user_id,
        'SELECT_SECURE_VIEW',
        ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
        'User accessing own sensitive data via secure view'
    ) IS NULL OR true)
);

-- Policy 2: Company admins can view team member sensitive data with strict logging
CREATE POLICY "Company admins can view team sensitive data with audit"
ON public.profile_sensitive_data_secure
FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = profile_sensitive_data_secure.user_id
        AND p.company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
    )
    AND (log_sensitive_data_access(
        profile_sensitive_data_secure.user_id,
        'ADMIN_VIEW_SECURE',
        ARRAY['admin_access_to_team_sensitive_data'],
        'Company admin accessing team member sensitive data'
    ) IS NULL OR true)
);

-- Policy 3: Super admins can view sensitive data for system administration
CREATE POLICY "Super admins can view sensitive data for administration"
ON public.profile_sensitive_data_secure
FOR SELECT
TO authenticated
USING (
    is_super_admin(auth.uid())
    AND (log_sensitive_data_access(
        profile_sensitive_data_secure.user_id,
        'SUPER_ADMIN_VIEW',
        ARRAY['system_administration'],
        'Super admin accessing sensitive data for system administration'
    ) IS NULL OR true)
);

-- Ensure all access to this table is logged and audited
COMMENT ON TABLE public.profile_sensitive_data_secure IS 'Secure view of sensitive profile data. All access is logged via RLS policies for audit purposes.';

-- Update the original profile_sensitive_data table to ensure it also has proper protections
-- Add trigger to log direct access attempts
CREATE OR REPLACE FUNCTION public.log_direct_sensitive_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log any direct access to the sensitive data table
    PERFORM log_sensitive_data_access(
        COALESCE(NEW.user_id, OLD.user_id),
        TG_OP || '_DIRECT',
        ARRAY['direct_table_access'],
        'Direct access to profile_sensitive_data table - should use secure view'
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to monitor direct access
DROP TRIGGER IF EXISTS log_sensitive_data_direct_access ON public.profile_sensitive_data;
CREATE TRIGGER log_sensitive_data_direct_access
    BEFORE INSERT OR UPDATE OR DELETE ON public.profile_sensitive_data
    FOR EACH ROW EXECUTE FUNCTION public.log_direct_sensitive_access();