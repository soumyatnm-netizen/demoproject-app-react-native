-- Fix critical security vulnerability: Market Intelligence data exposure
-- Add company_id to market_intelligence table for proper access control

-- Step 1: Add company_id column to market_intelligence table
ALTER TABLE public.market_intelligence 
ADD COLUMN company_id uuid REFERENCES public.broker_companies(id);

-- Step 2: Add created_by column to track who created the data
ALTER TABLE public.market_intelligence 
ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Step 3: For existing data, we'll set a default company_id to the first company
-- This prevents data loss during migration
UPDATE public.market_intelligence 
SET company_id = (
  SELECT id FROM public.broker_companies LIMIT 1
)
WHERE company_id IS NULL;

-- Step 4: Make company_id NOT NULL to enforce the constraint going forward
ALTER TABLE public.market_intelligence 
ALTER COLUMN company_id SET NOT NULL;

-- Step 5: Drop the existing overly permissive RLS policy
DROP POLICY IF EXISTS "Authenticated users can view market intelligence" ON public.market_intelligence;

-- Step 6: Create secure company-specific RLS policies

-- Users can only view market intelligence from their own company
CREATE POLICY "Users can view their company's market intelligence" 
ON public.market_intelligence 
FOR SELECT 
USING (
  company_id = get_user_company_id(auth.uid())
  AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- Only company admins can insert market intelligence data
CREATE POLICY "Company admins can insert market intelligence" 
ON public.market_intelligence 
FOR INSERT 
WITH CHECK (
  is_company_admin(auth.uid()) 
  AND company_id = get_user_company_id(auth.uid())
  AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- Only company admins can update their company's market intelligence
CREATE POLICY "Company admins can update their company's market intelligence" 
ON public.market_intelligence 
FOR UPDATE 
USING (
  company_id = get_user_company_id(auth.uid())
  AND is_company_admin(auth.uid())
  AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- Only company admins can delete their company's market intelligence
CREATE POLICY "Company admins can delete their company's market intelligence" 
ON public.market_intelligence 
FOR DELETE 
USING (
  company_id = get_user_company_id(auth.uid())
  AND is_company_admin(auth.uid())
  AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- Step 7: Create an index for better performance on company-based queries
CREATE INDEX idx_market_intelligence_company_id ON public.market_intelligence(company_id);

-- Step 8: Create a function to safely insert market intelligence data
CREATE OR REPLACE FUNCTION public.create_market_intelligence(
  p_insurer_name text,
  p_product_type text,
  p_industry text DEFAULT NULL,
  p_appetite_score integer DEFAULT NULL,
  p_win_rate numeric DEFAULT NULL,
  p_preferences jsonb DEFAULT NULL,
  p_revenue_band_min numeric DEFAULT NULL,
  p_revenue_band_max numeric DEFAULT NULL,
  p_typical_limits jsonb DEFAULT NULL,
  p_avg_premium_rate numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_new_id uuid;
BEGIN
  -- Get the user's company ID
  SELECT get_user_company_id(auth.uid()) INTO v_company_id;
  
  -- Check if user is a company admin
  IF NOT is_company_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only company administrators can create market intelligence data';
  END IF;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User must be associated with a company to create market intelligence data';
  END IF;
  
  -- Insert the market intelligence record
  INSERT INTO public.market_intelligence (
    insurer_name,
    product_type,
    industry,
    appetite_score,
    win_rate,
    preferences,
    revenue_band_min,
    revenue_band_max,
    typical_limits,
    avg_premium_rate,
    company_id,
    created_by
  ) VALUES (
    p_insurer_name,
    p_product_type,
    p_industry,
    p_appetite_score,
    p_win_rate,
    p_preferences,
    p_revenue_band_min,
    p_revenue_band_max,
    p_typical_limits,
    p_avg_premium_rate,
    v_company_id,
    auth.uid()
  ) RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;