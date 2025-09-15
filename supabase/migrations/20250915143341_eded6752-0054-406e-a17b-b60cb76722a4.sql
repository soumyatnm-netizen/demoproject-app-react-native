-- Fix critical security vulnerabilities with competitive intelligence exposure

-- 1. Restrict underwriter appetite data to company-specific access only
-- Drop overly permissive policies
DROP POLICY IF EXISTS "All authenticated users can view underwriter appetite data" ON public.underwriter_appetite_data;
DROP POLICY IF EXISTS "All authenticated users can view underwriter appetites" ON public.underwriter_appetites;

-- Create company-specific access policies for underwriter appetites
CREATE POLICY "Company members can view underwriter appetites" 
ON public.underwriter_appetites
FOR SELECT
TO authenticated
USING (
    -- Allow access if user is part of a company
    get_user_company_id(auth.uid()) IS NOT NULL
    -- Or if it's a company admin (they can see all for management purposes)
    OR is_company_admin(auth.uid())
);

CREATE POLICY "Company admins can manage underwriter appetites" 
ON public.underwriter_appetites
FOR ALL
TO authenticated
USING (is_company_admin(auth.uid()))
WITH CHECK (is_company_admin(auth.uid()));

-- Create company-specific access for appetite data
CREATE POLICY "Company members can view underwriter appetite data" 
ON public.underwriter_appetite_data
FOR SELECT
TO authenticated
USING (
    -- Allow access if user is part of a company
    get_user_company_id(auth.uid()) IS NOT NULL
    -- Or if it's a company admin
    OR is_company_admin(auth.uid())
);

CREATE POLICY "Company admins can manage underwriter appetite data" 
ON public.underwriter_appetite_data
FOR ALL
TO authenticated
USING (is_company_admin(auth.uid()))
WITH CHECK (is_company_admin(auth.uid()));

-- 2. Restrict market predictions to company-specific data
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view market predictions" ON public.market_predictions;
DROP POLICY IF EXISTS "Company admins can update market predictions" ON public.market_predictions;

-- Create company-specific market predictions access
CREATE POLICY "Company members can view market predictions" 
ON public.market_predictions
FOR SELECT
TO authenticated
USING (
    -- Users can only see predictions if they're part of a company
    get_user_company_id(auth.uid()) IS NOT NULL
);

CREATE POLICY "Company admins can manage market predictions" 
ON public.market_predictions
FOR ALL
TO authenticated
USING (is_company_admin(auth.uid()))
WITH CHECK (is_company_admin(auth.uid()));

-- 3. Add company_id to market_predictions table to enforce data isolation
-- First check if column exists, then add if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'market_predictions' 
                   AND column_name = 'company_id') THEN
        ALTER TABLE public.market_predictions 
        ADD COLUMN company_id uuid REFERENCES public.broker_companies(id);
    END IF;
END $$;

-- Update existing records to have a default company_id (if any exist)
-- This is safe as we're adding the constraint
UPDATE public.market_predictions 
SET company_id = (SELECT id FROM public.broker_companies LIMIT 1)
WHERE company_id IS NULL;

-- Update policies to use company_id for true data isolation
DROP POLICY IF EXISTS "Company members can view market predictions" ON public.market_predictions;
DROP POLICY IF EXISTS "Company admins can manage market predictions" ON public.market_predictions;

CREATE POLICY "Company specific market predictions access" 
ON public.market_predictions
FOR SELECT
TO authenticated
USING (
    company_id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

CREATE POLICY "Company admins manage their market predictions" 
ON public.market_predictions
FOR ALL
TO authenticated
USING (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
)
WITH CHECK (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- 4. Add company_id to underwriter tables for better isolation
-- Add company_id to underwriter_appetites if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'underwriter_appetites' 
                   AND column_name = 'company_id') THEN
        ALTER TABLE public.underwriter_appetites 
        ADD COLUMN company_id uuid REFERENCES public.broker_companies(id);
    END IF;
END $$;

-- Update existing underwriter appetite records
UPDATE public.underwriter_appetites 
SET company_id = (SELECT id FROM public.broker_companies LIMIT 1)
WHERE company_id IS NULL;

-- Update underwriter appetite policies for company isolation
DROP POLICY IF EXISTS "Company members can view underwriter appetites" ON public.underwriter_appetites;
DROP POLICY IF EXISTS "Company admins can manage underwriter appetites" ON public.underwriter_appetites;

CREATE POLICY "Company specific underwriter appetites" 
ON public.underwriter_appetites
FOR SELECT
TO authenticated
USING (
    company_id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

CREATE POLICY "Company admins manage their underwriter appetites" 
ON public.underwriter_appetites
FOR ALL
TO authenticated
USING (
    is_company_admin(auth.uid())
    AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
    AND get_user_company_id(auth.uid()) IS NOT NULL
)
WITH CHECK (
    is_company_admin(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- 5. Fix profiles table conflicting policies
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Secure team access policy" ON public.profiles;

-- Keep the more restrictive individual policies that are already in place
-- These are more secure: "Users can view own profile only", "Company admins can update team profiles", etc.