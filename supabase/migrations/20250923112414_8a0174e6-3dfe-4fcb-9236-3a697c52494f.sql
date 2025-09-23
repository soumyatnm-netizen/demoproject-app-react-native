-- Fix profiles table - currently too restrictive for business needs but should be secure
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can update team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create secure, business-appropriate policies for profiles table
CREATE POLICY "secure_profiles_select_v4"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    -- Users can view their own profile
    user_id = auth.uid()
    OR 
    -- Company admins can view team member profiles in same company
    (
        is_company_admin(auth.uid()) 
        AND company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
    )
    OR
    -- Super admins can view any profile
    is_super_admin(auth.uid())
);

CREATE POLICY "secure_profiles_insert_v4"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "secure_profiles_update_v4"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    -- Users can update their own profile
    user_id = auth.uid()
    OR
    -- Company admins can update team profiles in same company
    (
        is_company_admin(auth.uid()) 
        AND company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
    )
    OR
    -- Super admins can update any profile
    is_super_admin(auth.uid())
)
WITH CHECK (
    -- Prevent privilege escalation - users can't change their own role to admin
    CASE 
        WHEN user_id = auth.uid() THEN 
            (NEW.role IS NULL OR NEW.role = OLD.role OR NOT (NEW.role IN ('company_admin', 'hr_admin')))
        ELSE true 
    END
);

-- Strengthen broker_companies table policies
DROP POLICY IF EXISTS "Authenticated users can view their own company" ON public.broker_companies;
DROP POLICY IF EXISTS "Authenticated company admins can update their company" ON public.broker_companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.broker_companies;

CREATE POLICY "secure_companies_select_v4"
ON public.broker_companies
FOR SELECT
TO authenticated
USING (
    -- Only users from the same company can view company details
    id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

CREATE POLICY "secure_companies_update_v4"
ON public.broker_companies
FOR UPDATE
TO authenticated
USING (
    id = get_user_company_id(auth.uid()) 
    AND is_company_admin(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

CREATE POLICY "secure_companies_insert_v4"
ON public.broker_companies
FOR INSERT
TO authenticated
WITH CHECK (
    -- Only allow company creation if user doesn't already belong to a company
    get_user_company_id(auth.uid()) IS NULL
);

-- Strengthen company_invites table policies  
DROP POLICY IF EXISTS "Company admins can manage company invites" ON public.company_invites;
DROP POLICY IF EXISTS "Users can only view valid invites for their email" ON public.company_invites;

CREATE POLICY "secure_invites_manage_v4"
ON public.company_invites
FOR ALL
TO authenticated
USING (
    -- Company admins can manage their company's invites
    company_id = get_user_company_id(auth.uid())
    AND is_company_admin(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
    AND expires_at > now()
    AND used_at IS NULL
)
WITH CHECK (
    -- Same conditions for insert/update
    company_id = get_user_company_id(auth.uid())
    AND is_company_admin(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
    AND expires_at > now()
);

CREATE POLICY "secure_invites_view_own_v4"
ON public.company_invites
FOR SELECT
TO authenticated
USING (
    -- Users can only view invites for their own email that are valid
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND expires_at > now()
    AND used_at IS NULL
    AND created_at > (now() - interval '7 days')
);

-- Add logging for all profile access
CREATE OR REPLACE FUNCTION public.log_profile_access_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Log when someone accesses profile data beyond their own
    IF TG_OP = 'SELECT' AND auth.uid() != NEW.user_id THEN
        PERFORM public.log_profile_access(
            NEW.user_id,
            'PROFILE_VIEW',
            ARRAY['first_name', 'last_name', 'job_title', 'department', 'role'],
            CASE 
                WHEN is_super_admin(auth.uid()) THEN 'Super admin profile access'
                WHEN is_company_admin(auth.uid()) THEN 'Company admin team member access'
                ELSE 'Profile access'
            END
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add trigger for profile access logging (for INSERT/UPDATE/DELETE only, not SELECT)
CREATE TRIGGER profile_access_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_profile_access_trigger();

-- Create function to validate business-appropriate access
CREATE OR REPLACE FUNCTION public.validate_team_access(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    accessing_user_id uuid;
    target_company_id uuid;
    accessing_company_id uuid;
BEGIN
    accessing_user_id := auth.uid();
    
    -- Allow self-access
    IF accessing_user_id = target_user_id THEN
        RETURN true;
    END IF;
    
    -- Get company IDs
    SELECT company_id INTO target_company_id 
    FROM public.profiles 
    WHERE user_id = target_user_id;
    
    SELECT company_id INTO accessing_company_id 
    FROM public.profiles 
    WHERE user_id = accessing_user_id;
    
    -- Allow company admin access to same company members
    IF is_company_admin(accessing_user_id) 
       AND target_company_id = accessing_company_id 
       AND target_company_id IS NOT NULL THEN
        RETURN true;
    END IF;
    
    -- Allow super admin access
    IF is_super_admin(accessing_user_id) THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;