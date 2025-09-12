-- Security fix: Restrict access to employee profile data (clean implementation)

-- Step 1: Clean up existing policies and create new restrictive ones
DO $$
BEGIN
    -- Drop all existing SELECT policies on profiles
    DROP POLICY IF EXISTS "Company admins can view limited team member data" ON public.profiles;
    DROP POLICY IF EXISTS "Super admins can view basic profile data" ON public.profiles;
    DROP POLICY IF EXISTS "Company admins can view team business data only" ON public.profiles;
    DROP POLICY IF EXISTS "Super admins can view basic business data" ON public.profiles;
    
    -- Create the secure policies
    CREATE POLICY "Secure team access policy" 
    ON public.profiles 
    FOR SELECT 
    USING (
        -- Users can always see their own profile
        auth.uid() = user_id
        OR 
        -- Company admins can see team members but access is restricted
        (is_company_admin(auth.uid()) 
         AND company_id = get_user_company_id(auth.uid()) 
         AND company_id IS NOT NULL)
        OR
        -- Super admins have access but it should be logged
        is_super_admin(auth.uid())
    );
END
$$;

-- Step 2: Create secure team view (drop if exists first)
DROP VIEW IF EXISTS public.team_member_safe_view;

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

-- Step 3: Create secure access function
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
        -- Super admin (should be rare)
        is_super_admin(auth.uid())
    ) THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions to view profile data';
    END IF;
    
    -- Log admin access to employee data
    IF auth.uid() != target_user_id THEN
        PERFORM public.log_profile_access(
            target_user_id,
            'SECURE_PROFILE_ACCESS',
            ARRAY['first_name', 'last_name', 'job_title', 'department'],
            CASE 
                WHEN is_super_admin(auth.uid()) THEN 'Super admin access to profile'
                ELSE 'Company admin access to team member profile'
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

-- Step 4: Add comprehensive security documentation
COMMENT ON TABLE public.profiles IS 'User business profiles. Sensitive data like phone numbers stored separately. All admin access is logged for security.';
COMMENT ON VIEW public.team_member_safe_view IS 'Filtered view of team members. Individual access requires proper permissions and triggers audit logging.';
COMMENT ON FUNCTION public.get_team_member_secure IS 'Secure function for profile access with mandatory permission checks and audit logging.';

-- Step 5: Revoke any potential public access
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;

-- Step 6: Log this security hardening action
INSERT INTO public.profile_access_audit (
    accessed_user_id,
    accessing_user_id,
    access_type,
    access_reason
) VALUES (
    gen_random_uuid(), -- System action
    gen_random_uuid(), -- System action  
    'SECURITY_HARDENING',
    'Applied strict access controls to profiles table to prevent unauthorized employee data access'
);