-- Fix critical security issue: Restrict profile visibility
-- Drop all existing SELECT policies on profiles table to avoid conflicts
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can view company profiles" ON public.profiles;

-- Create new secure policies
-- 1. Users can view their own profile only
CREATE POLICY "Users can view own profile only"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- 2. Company admins can view profiles in their company (for legitimate management purposes)
CREATE POLICY "Company admins can view company member profiles"
ON public.profiles  
FOR SELECT
USING (
  is_company_admin(auth.uid()) 
  AND company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);