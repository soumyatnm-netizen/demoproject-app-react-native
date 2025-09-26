-- Fix security vulnerability: Employee Personal Information Could Be Stolen by Hackers
-- This migration ensures the profiles table has strict RLS policies preventing public access

-- Ensure RLS is enabled on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to ensure clean state
DROP POLICY IF EXISTS "ultra_secure_profiles_select_v5" ON public.profiles;
DROP POLICY IF EXISTS "secure_profiles_insert_v4" ON public.profiles;
DROP POLICY IF EXISTS "secure_profiles_update_v4" ON public.profiles;
DROP POLICY IF EXISTS "ultra_secure_profiles_select_v6" ON public.profiles;
DROP POLICY IF EXISTS "ultra_secure_profiles_insert_v6" ON public.profiles;
DROP POLICY IF EXISTS "ultra_secure_profiles_update_v6" ON public.profiles;
DROP POLICY IF EXISTS "block_all_profile_deletions" ON public.profiles;

-- Create restrictive policies that prevent ANY public access

-- 1. SELECT: Only authenticated users can access their own profile or authorized admins
CREATE POLICY "authenticated_profiles_select_only" 
ON public.profiles 
FOR SELECT 
USING (
    -- Must be authenticated first - this prevents public access
    auth.uid() IS NOT NULL
    AND (
        -- User accessing their own profile
        user_id = auth.uid() 
        OR 
        -- Company admin accessing team member profile
        (
            is_company_admin(auth.uid()) 
            AND company_id IS NOT NULL
            AND company_id = get_user_company_id(auth.uid()) 
            AND get_user_company_id(auth.uid()) IS NOT NULL 
            AND is_active = true
        )
        OR 
        -- Super admin access
        is_super_admin(auth.uid()) = true
    )
);

-- 2. INSERT: Only authenticated users can create their own profile
CREATE POLICY "authenticated_profiles_insert_only" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
    -- Must be authenticated and creating own profile
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
);

-- 3. UPDATE: Strict update permissions
CREATE POLICY "authenticated_profiles_update_only" 
ON public.profiles 
FOR UPDATE 
USING (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND (
        -- User updating their own profile
        user_id = auth.uid() 
        OR 
        -- Company admin updating team member profile
        (
            is_company_admin(auth.uid()) 
            AND company_id = get_user_company_id(auth.uid()) 
            AND get_user_company_id(auth.uid()) IS NOT NULL
            AND company_id IS NOT NULL
        ) 
        OR 
        -- Super admin access
        is_super_admin(auth.uid()) = true
    )
)
WITH CHECK (
    -- Must be authenticated and maintain user_id integrity
    auth.uid() IS NOT NULL
    AND user_id IS NOT NULL
);

-- 4. DELETE: Prevent all deletions for data retention
CREATE POLICY "prevent_profile_deletions" 
ON public.profiles 
FOR DELETE 
USING (false);

-- Create audit trigger for profile modifications (not SELECT)
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log profile modifications
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_profile_access(
            NEW.user_id,
            'PROFILE_CREATED',
            ARRAY['profile_creation'],
            'New user profile created'
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if someone else is updating the profile
        IF auth.uid() != NEW.user_id THEN
            PERFORM public.log_profile_access(
                NEW.user_id,
                'PROFILE_MODIFIED',
                ARRAY['first_name', 'last_name', 'job_title', 'department', 'role'],
                CASE 
                    WHEN is_super_admin(auth.uid()) = true THEN 'Super admin modified profile'
                    WHEN is_company_admin(auth.uid()) THEN 'Company admin modified team member profile'
                    ELSE 'Profile modification'
                END
            );
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the audit trigger
DROP TRIGGER IF EXISTS profile_modification_audit ON public.profiles;
CREATE TRIGGER profile_modification_audit
    AFTER INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_profile_changes();