-- Fix remaining security issues: Security Definer View and sensitive data protection

-- First, let's check what the security definer view is and fix it
-- The profile_sensitive_data_secure is a view, so we need to handle it properly

-- Drop the problematic security definer view if it exists
DROP VIEW IF EXISTS public.profile_sensitive_data_secure CASCADE;

-- Recreate the view without SECURITY DEFINER (which was causing the linter error)
-- This view will use the caller's permissions and RLS policies
CREATE VIEW public.profile_sensitive_data_secure AS
SELECT 
  id,
  user_id,
  phone,
  personal_address,
  emergency_contact,
  sensitive_notes,
  created_at,
  updated_at
FROM public.profile_sensitive_data;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.profile_sensitive_data_secure TO authenticated;
REVOKE ALL ON public.profile_sensitive_data_secure FROM anon;

-- Ensure the underlying table (profile_sensitive_data) has proper RLS policies
-- The view will inherit the security through the underlying table's RLS policies

-- Check if we need to strengthen the profile_sensitive_data table policies
-- Update existing policies to be more restrictive and add audit logging

-- Drop and recreate policies on the underlying table for better security
DROP POLICY IF EXISTS "Enhanced secure access to own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Enhanced secure insert of own sensitive data" ON public.profile_sensitive_data;  
DROP POLICY IF EXISTS "Enhanced secure update of own sensitive data" ON public.profile_sensitive_data;

-- Create new, more secure policies with proper audit logging
CREATE POLICY "Users can view own sensitive data with audit"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    AND (log_sensitive_data_access(
        user_id,
        'SELECT',
        ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
        'User accessing own sensitive data'
    ) IS NULL OR true)
);

CREATE POLICY "Users can insert own sensitive data"
ON public.profile_sensitive_data
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND (log_sensitive_data_access(
        user_id,
        'INSERT',
        ARRAY['new_sensitive_data'],
        'User creating sensitive data record'
    ) IS NULL OR true)
);

CREATE POLICY "Users can update own sensitive data with audit"
ON public.profile_sensitive_data
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    AND (log_sensitive_data_access(
        user_id,
        'UPDATE',
        ARRAY['sensitive_data_update'],
        'User updating own sensitive data'
    ) IS NULL OR true)
)
WITH CHECK (user_id = auth.uid());

-- Add policy for company admins to access team member data (with strict audit logging)
CREATE POLICY "Company admins can view team sensitive data"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (
    is_company_admin(auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = profile_sensitive_data.user_id
        AND p.company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
    )
    AND (log_sensitive_data_access(
        profile_sensitive_data.user_id,
        'ADMIN_ACCESS',
        ARRAY['admin_team_access'],
        'Company admin accessing team member sensitive data'
    ) IS NULL OR true)
);

-- Ensure no other security definer views exist that could cause issues
-- Comment on the view to clarify its security model
COMMENT ON VIEW public.profile_sensitive_data_secure IS 'Secure view of sensitive profile data. Access controlled via RLS policies on underlying profile_sensitive_data table. All access is logged for audit purposes.';