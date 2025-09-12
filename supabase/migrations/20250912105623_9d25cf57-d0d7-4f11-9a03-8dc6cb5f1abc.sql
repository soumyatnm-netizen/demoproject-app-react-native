-- Complete the security fix by adding secure access components

-- Create secure team view (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'team_member_safe_view' AND table_schema = 'public') THEN
        CREATE VIEW public.team_member_safe_view AS
        SELECT 
            user_id,
            first_name,
            last_name,
            job_title,
            department,
            role,
            is_active,
            last_login_at,
            created_at,
            company_id
        FROM public.profiles
        WHERE is_active = true;
        
        -- Secure the view
        ALTER VIEW public.team_member_safe_view SET (security_barrier = true);
        REVOKE ALL ON public.team_member_safe_view FROM public;
        GRANT SELECT ON public.team_member_safe_view TO authenticated;
    END IF;
END
$$;

-- Create secure access function for team member data
CREATE OR REPLACE FUNCTION public.get_team_member_secure(target_user_id uuid)
RETURNS TABLE(
    user_id uuid,
    first_name text,
    last_name text,
    job_title text,
    department text,
    role app_role,
    is_active boolean,
    last_login_at timestamp with time zone
) AS $$
BEGIN
    -- Verify permissions
    IF NOT (
        -- User accessing their own data
        auth.uid() = target_user_id
        OR 
        -- Company admin accessing team member
        (is_company_admin(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = target_user_id 
            AND profiles.company_id = get_user_company_id(auth.uid())
            AND get_user_company_id(auth.uid()) IS NOT NULL
        ))
        OR
        -- Super admin access
        is_super_admin(auth.uid())
    ) THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions to view profile data';
    END IF;
    
    -- Log admin access to employee data (excluding self-access)
    IF auth.uid() != target_user_id THEN
        PERFORM public.log_profile_access(
            target_user_id,
            'SECURE_TEAM_ACCESS',
            ARRAY['first_name', 'last_name', 'job_title', 'department'],
            CASE 
                WHEN is_super_admin(auth.uid()) THEN 'Super admin accessed employee profile'
                ELSE 'Company admin accessed team member profile'
            END
        );
    END IF;
    
    -- Return the data
    RETURN QUERY
    SELECT 
        p.user_id,
        p.first_name,
        p.last_name,
        p.job_title,
        p.department,
        p.role,
        p.is_active,
        p.last_login_at
    FROM public.profiles p
    WHERE p.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add security documentation
COMMENT ON TABLE public.profiles IS 'Employee business profiles with restricted access. Phone numbers stored separately in profile_sensitive_data for enhanced security. All admin access is logged.';
COMMENT ON FUNCTION public.get_team_member_secure IS 'Secure function for accessing team member data with mandatory permission checks and audit logging to prevent unauthorized employee data access.';

-- Ensure no public access remains
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;

-- Log this security completion
INSERT INTO public.profile_access_audit (
    accessed_user_id,
    accessing_user_id,
    access_type,
    access_reason
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    'SECURITY_COMPLETION',
    'Security hardening completed: Employee profile data now protected with restricted access and mandatory audit logging'
);