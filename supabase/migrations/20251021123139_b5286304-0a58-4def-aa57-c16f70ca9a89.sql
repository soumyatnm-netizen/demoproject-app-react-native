-- Update the check function to default to enabled if no record exists
CREATE OR REPLACE FUNCTION public.check_company_feature(p_company_id uuid, p_feature_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  feature_exists boolean;
  feature_enabled boolean;
BEGIN
  -- Check if the feature record exists
  SELECT EXISTS (
    SELECT 1 FROM broker_company_features
    WHERE company_id = p_company_id
    AND feature = p_feature_name
  ) INTO feature_exists;
  
  -- If no record exists, default to enabled (true)
  IF NOT feature_exists THEN
    RETURN true;
  END IF;
  
  -- If record exists, return its enabled status
  SELECT enabled INTO feature_enabled
  FROM broker_company_features
  WHERE company_id = p_company_id
  AND feature = p_feature_name;
  
  RETURN COALESCE(feature_enabled, true);
END;
$$;

COMMENT ON FUNCTION public.check_company_feature IS 'Check if a specific feature is enabled for a broker company. Defaults to enabled (true) if no record exists.';