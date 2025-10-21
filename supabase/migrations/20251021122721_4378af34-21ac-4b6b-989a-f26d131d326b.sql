-- Create a new table for broker company features
CREATE TABLE IF NOT EXISTS public.broker_company_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.broker_companies(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean DEFAULT true,
  tier text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, feature)
);

-- Enable RLS
ALTER TABLE public.broker_company_features ENABLE ROW LEVEL SECURITY;

-- CC Staff can manage all company features
CREATE POLICY "CC Staff can manage company features"
ON public.broker_company_features
FOR ALL
USING (is_cc_staff(auth.uid()))
WITH CHECK (is_cc_staff(auth.uid()));

-- Users can view their own company's features
CREATE POLICY "Users can view their company features"
ON public.broker_company_features
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_broker_company_features_company ON public.broker_company_features(company_id);
CREATE INDEX idx_broker_company_features_enabled ON public.broker_company_features(company_id, enabled);

-- Update the check and get functions to use broker_company_features
CREATE OR REPLACE FUNCTION public.check_company_feature(p_company_id uuid, p_feature_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM broker_company_features
    WHERE company_id = p_company_id
    AND feature = p_feature_name
    AND enabled = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_company_features(p_company_id uuid)
RETURNS TABLE(feature text, enabled boolean, tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bcf.feature,
    bcf.enabled,
    bcf.tier
  FROM broker_company_features bcf
  WHERE bcf.company_id = p_company_id
  ORDER BY bcf.feature;
END;
$$;

COMMENT ON TABLE public.broker_company_features IS 'Tracks which features are enabled for each broker company';
COMMENT ON FUNCTION public.check_company_feature IS 'Check if a specific feature is enabled for a broker company';
COMMENT ON FUNCTION public.get_company_features IS 'Get all features and their status for a broker company';