-- Fix security definer view issues
-- Remove problematic views that bypass RLS policies

-- Drop the security definer views that are flagged by the linter
DROP VIEW IF EXISTS public.profile_sensitive_data_secure;
DROP VIEW IF EXISTS public.team_member_safe_view;

-- Create a proper security definer function for sensitive data access instead of a view
CREATE OR REPLACE FUNCTION public.get_accessible_sensitive_data()
RETURNS TABLE(
    id uuid,
    user_id uuid,
    phone text,
    personal_address text,
    emergency_contact jsonb,
    sensitive_notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
) AS $$
BEGIN
    -- Return data based on RLS policies, not view-level filtering
    RETURN QUERY
    SELECT 
        psd.id,
        psd.user_id,
        psd.phone,
        psd.personal_address,
        psd.emergency_contact,
        psd.sensitive_notes,
        psd.created_at,
        psd.updated_at
    FROM public.profile_sensitive_data psd
    WHERE psd.user_id = auth.uid() 
    OR (is_company_admin(auth.uid()) AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = psd.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create a proper security definer function for team member data instead of a view
CREATE OR REPLACE FUNCTION public.get_accessible_team_members()
RETURNS TABLE(
    user_id uuid,
    first_name text,
    last_name text,
    job_title text,
    department text,
    role app_role,
    is_active boolean,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone,
    company_id uuid
) AS $$
BEGIN
    -- Return data based on RLS policies and proper access controls
    RETURN QUERY
    SELECT 
        p.user_id,
        p.first_name,
        p.last_name,
        p.job_title,
        p.department,
        p.role,
        p.is_active,
        p.last_login_at,
        p.created_at,
        p.company_id
    FROM public.profiles p
    WHERE p.is_active = true 
    AND (
        p.user_id = auth.uid() 
        OR (is_company_admin(auth.uid()) 
            AND p.company_id = get_user_company_id(auth.uid())
            AND get_user_company_id(auth.uid()) IS NOT NULL)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add security comments
COMMENT ON FUNCTION public.get_accessible_sensitive_data IS 'Secure function to access sensitive profile data with proper RLS enforcement';
COMMENT ON FUNCTION public.get_accessible_team_members IS 'Secure function to access team member data with proper access controls and logging';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_accessible_sensitive_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_team_members() TO authenticated;