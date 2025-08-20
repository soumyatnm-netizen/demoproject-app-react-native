-- Fix critical security issue: Restrict profile visibility
-- Current policy allows all company members to see each other's personal data
-- New policy: Users can only see their own profile + Company admins can see their company's profiles

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;

-- Create new restrictive policies
-- 1. Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- 2. Company admins can view profiles in their company (for management purposes)  
CREATE POLICY "Company admins can view company profiles"
ON public.profiles  
FOR SELECT
USING (
  is_company_admin(auth.uid()) 
  AND company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);