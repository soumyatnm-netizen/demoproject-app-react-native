-- Fix profiles table RLS policies
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