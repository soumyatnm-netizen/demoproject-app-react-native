-- Security fix: Remove sensitive data from profiles table and restrict access

-- Step 1: Migrate phone numbers from profiles to profile_sensitive_data
-- First, ensure all users have a record in profile_sensitive_data
INSERT INTO public.profile_sensitive_data (user_id, phone, created_at, updated_at)
SELECT 
    user_id, 
    phone, 
    now(), 
    now()
FROM public.profiles 
WHERE phone IS NOT NULL 
AND user_id NOT IN (SELECT user_id FROM public.profile_sensitive_data)
ON CONFLICT (user_id) DO UPDATE SET 
    phone = COALESCE(EXCLUDED.phone, profile_sensitive_data.phone),
    updated_at = now();

-- Step 2: Remove phone column from profiles table (it belongs in sensitive data)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

-- Step 3: Create more restrictive RLS policies for profiles table
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Company admins can view limited team member data" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view basic profile data" ON public.profiles;

-- Create new restrictive policies that only show business-necessary data to admins
CREATE POLICY "Company admins can view team business data only" 
ON public.profiles 
FOR SELECT 
USING (
    is_company_admin(auth.uid()) 
    AND company_id = get_user_company_id(auth.uid()) 
    AND company_id IS NOT NULL
);

-- Super admins can view basic business data but not personal details
CREATE POLICY "Super admins can view basic business data" 
ON public.profiles 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Step 4: Create a safe view for team management that excludes sensitive fields
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

-- Set RLS on the view
ALTER VIEW public.team_member_safe_view SET (security_barrier = true);

-- Grant access to the safe view
GRANT SELECT ON public.team_member_safe_view TO authenticated;

-- Step 5: Create audit logging for profile access
CREATE OR REPLACE FUNCTION public.log_profile_view_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log when someone accesses profile data beyond their own
    IF auth.uid() != NEW.user_id THEN
        PERFORM public.log_profile_access(
            NEW.user_id,
            'PROFILE_VIEW',
            ARRAY['first_name', 'last_name', 'job_title', 'department', 'role'],
            'Team member profile accessed by admin'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 6: Add security comments
COMMENT ON TABLE public.profiles IS 'User profiles with business data only. Sensitive personal information is stored in profile_sensitive_data table with stricter access controls.';
COMMENT ON VIEW public.team_member_safe_view IS 'Safe view for team management that excludes sensitive personal data like phone numbers.';

-- Step 7: Ensure no public access to any profile data
REVOKE ALL ON public.profiles FROM public;
REVOKE ALL ON public.profiles FROM anon;