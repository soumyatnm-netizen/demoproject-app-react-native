-- Fix security vulnerability: Employee Personal Information Could Be Stolen by Hackers
-- This migration ensures the profiles table has proper RLS policies to prevent public access

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "ultra_secure_profiles_select_v5" ON public.profiles;
DROP POLICY IF EXISTS "secure_profiles_insert_v4" ON public.profiles;
DROP POLICY IF EXISTS "secure_profiles_update_v4" ON public.profiles;
DROP POLICY IF EXISTS "ultra_secure_profiles_select_v6" ON public.profiles;
DROP POLICY IF EXISTS "ultra_secure_profiles_insert_v6" ON public.profiles;
DROP POLICY IF EXISTS "ultra_secure_profiles_update_v6" ON public.profiles;
DROP POLICY IF EXISTS "block_all_profile_deletions" ON public.profiles;

-- 1. SELECT Policy: Strict authentication required, no public access
CREATE POLICY "profiles_select_auth_only" 
ON public.profiles 
FOR SELECT 
USING (
    -- Must be authenticated - this prevents all unauthenticated/public access
    auth.uid() IS NOT NULL
    AND (
        -- Own profile access
        user_id = auth.uid() 
        OR 
        -- Company admin access to team members
        (
            is_company_admin(auth.uid()) 
            AND company_id = get_user_company_id(auth.uid()) 
            AND get_user_company_id(auth.uid()) IS NOT NULL 
            AND company_id IS NOT NULL
            AND is_active = true
        )
        OR 
        -- Super admin access
        is_super_admin(auth.uid()) = true
    )
);

-- 2. INSERT Policy: Only authenticated users can create their own profile
CREATE POLICY "profiles_insert_own_only" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
);

-- 3. UPDATE Policy: Users can update own profile, admins can update team members
CREATE POLICY "profiles_update_controlled" 
ON public.profiles 
FOR UPDATE 
USING (
    auth.uid() IS NOT NULL
    AND (
        user_id = auth.uid() 
        OR 
        (
            is_company_admin(auth.uid()) 
            AND company_id = get_user_company_id(auth.uid()) 
            AND get_user_company_id(auth.uid()) IS NOT NULL
        ) 
        OR 
        is_super_admin(auth.uid()) = true
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id IS NOT NULL
);

-- 4. DELETE Policy: Prevent all deletions for data retention
CREATE POLICY "profiles_no_delete" 
ON public.profiles 
FOR DELETE 
USING (false);

-- Verify RLS is working by ensuring no public access
-- This comment documents that anonymous users should have NO access to profiles table