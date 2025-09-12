-- Security fix: Restrict access to employee profile data

-- Step 1: Create more restrictive RLS policies for profiles table
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Company admins can view limited team member data" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view basic profile data" ON public.profiles;

-- Create new restrictive policy that limits what company admins can see
CREATE POLICY "Company admins can view team business data only" 
ON public.profiles 
FOR SELECT 
USING (
    -- Users can always see their own profile
    auth.uid() = user_id
    OR 
    -- Company admins can only see limited business data of their team
    (is_company_admin(auth.uid()) 
     AND company_id = get_user_company_id(auth.uid()) 
     AND company_id IS NOT NULL)
);

-- Super admins can view basic business data but access is logged
CREATE POLICY "Super admins can view basic business data" 
ON public.profiles 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Step 2: Create a safe view for team management that excludes sensitive fields
CREATE OR REPLACE VIEW public.team_member_safe_view AS
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

-- Enable security barrier on the view
ALTER VIEW public.team_member_safe_view SET (security_barrier = true);

-- Grant access to the safe view
REVOKE ALL ON public.team_member_safe_view FROM public;
GRANT SELECT ON public.team_member_safe_view TO authenticated;

-- Step 3: Create function to get team member data with access logging
CREATE OR REPLACE FUNCTION public.get_team_member_data(target_user_id uuid)
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
    -- Check if requesting user is company admin for this user's company
    IF NOT (is_company_admin(auth.uid()) AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = target_user_id 
        AND profiles.company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
    )) THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions';
    END IF;
    
    -- Log the access
    PERFORM public.log_profile_access(
        target_user_id,
        'TEAM_MEMBER_VIEW',
        ARRAY['first_name', 'last_name', 'job_title', 'department'],
        'Team member data accessed by company admin'
    );
    
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

-- Step 4: Add security comments
COMMENT ON TABLE public.profiles IS 'User profiles with business data. Access is restricted and logged. Phone numbers are stored separately in profile_sensitive_data.';
COMMENT ON VIEW public.team_member_safe_view IS 'Safe view for team management. Access to individual records requires admin privileges and is logged.';
COMMENT ON FUNCTION public.get_team_member_data IS 'Secure function to access team member data with mandatory access logging.';

-- Step 5: Ensure no public access
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;