-- Fix security vulnerability in broker_companies table
-- The current policies are too permissive and could expose sensitive business data

-- First, let's ensure RLS is enabled on the table
ALTER TABLE public.broker_companies ENABLE ROW LEVEL SECURITY;

-- Drop the overly permissive INSERT policy that allows "anyone" to create companies
DROP POLICY IF EXISTS "Anyone can create a company" ON public.broker_companies;

-- Create a more restrictive INSERT policy for authenticated users only
CREATE POLICY "Authenticated users can create companies" 
ON public.broker_companies 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Update the SELECT policy to be more explicit about authentication requirements
DROP POLICY IF EXISTS "Users can view their own company" ON public.broker_companies;

CREATE POLICY "Authenticated users can view their own company" 
ON public.broker_companies 
FOR SELECT 
TO authenticated
USING (id = get_user_company_id(auth.uid()));

-- Ensure the UPDATE policy is also properly scoped to authenticated users
DROP POLICY IF EXISTS "Company admins can update their company" ON public.broker_companies;

CREATE POLICY "Authenticated company admins can update their company" 
ON public.broker_companies 
FOR UPDATE 
TO authenticated
USING ((id = get_user_company_id(auth.uid())) AND is_company_admin(auth.uid()));

-- Add explicit DENY policy for unauthenticated users
CREATE POLICY "Deny all access to unauthenticated users" 
ON public.broker_companies 
FOR ALL 
TO anon
USING (false);

-- Log this security fix
COMMENT ON TABLE public.broker_companies IS 'Contains sensitive business data - access restricted to authenticated users only. Updated policies to prevent data theft of phone numbers and addresses.';