-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.get_team_member_safe_data(target_user_id uuid)
RETURNS TABLE (
    user_id uuid,
    first_name text,
    last_name text,
    job_title text,
    department text,
    role app_role,
    is_active boolean,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT 
        p.user_id,
        p.first_name,
        p.last_name,
        p.job_title,
        p.department,
        p.role,
        p.is_active,
        p.last_login_at,
        p.created_at
    FROM public.profiles p
    WHERE p.user_id = target_user_id
    AND is_company_admin(auth.uid())
    AND p.company_id = get_user_company_id(auth.uid())
    AND p.company_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.log_profile_access(
    p_accessed_user_id uuid,
    p_access_type text,
    p_accessed_fields text[] DEFAULT NULL,
    p_access_reason text DEFAULT NULL,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profile_access_audit (
        accessed_user_id,
        accessing_user_id,
        access_type,
        accessed_fields,
        access_reason,
        ip_address,
        user_agent
    ) VALUES (
        p_accessed_user_id,
        auth.uid(),
        p_access_type,
        p_accessed_fields,
        p_access_reason,
        p_ip_address,
        p_user_agent
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete audit logs older than 1 year
    DELETE FROM public.profile_access_audit 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    DELETE FROM public.login_audit 
    WHERE login_time < NOW() - INTERVAL '1 year';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT CASE
        -- Users can always access their own profile
        WHEN auth.uid() = target_user_id THEN true
        -- Company admins can access team member profiles
        WHEN is_company_admin(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = target_user_id 
            AND company_id = get_user_company_id(auth.uid())
        ) THEN true
        -- Super admins can access basic profile data
        WHEN is_super_admin(auth.uid()) THEN true
        ELSE false
    END;
$$;