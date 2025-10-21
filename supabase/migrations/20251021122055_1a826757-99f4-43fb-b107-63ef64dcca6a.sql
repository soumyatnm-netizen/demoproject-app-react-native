-- Function to check if a company has a feature enabled
CREATE OR REPLACE FUNCTION public.check_company_feature(p_company_id uuid, p_feature_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_features
    WHERE org_id = p_company_id
    AND feature = p_feature_name
    AND enabled = true
  );
END;
$$;

-- Function to get all enabled features for a company
CREATE OR REPLACE FUNCTION public.get_company_features(p_company_id uuid)
RETURNS TABLE(feature text, enabled boolean, tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    of.feature,
    of.enabled,
    of.tier
  FROM org_features of
  WHERE of.org_id = p_company_id
  ORDER BY of.feature;
END;
$$;

COMMENT ON FUNCTION public.check_company_feature IS 'Check if a specific feature is enabled for a company';
COMMENT ON FUNCTION public.get_company_features IS 'Get all features and their status for a company';