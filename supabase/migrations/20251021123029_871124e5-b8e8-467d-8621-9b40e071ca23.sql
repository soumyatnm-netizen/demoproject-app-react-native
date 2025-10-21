-- Function to initialize default features for a company based on their tier
CREATE OR REPLACE FUNCTION public.initialize_company_features()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert all features appropriate for the company's tier, all enabled by default
  INSERT INTO broker_company_features (company_id, feature, enabled, tier)
  VALUES
    -- Basic tier features (available to all)
    (NEW.id, 'document_processing', true, 'basic'),
    (NEW.id, 'quote_comparison', true, 'basic')
  ON CONFLICT (company_id, feature) DO NOTHING;
  
  -- Professional tier features
  IF NEW.subscription_tier IN ('professional', 'enterprise') THEN
    INSERT INTO broker_company_features (company_id, feature, enabled, tier)
    VALUES
      (NEW.id, 'market_intelligence', true, 'professional'),
      (NEW.id, 'placement_tracking', true, 'professional'),
      (NEW.id, 'underwriter_matching', true, 'professional'),
      (NEW.id, 'appetite_guides', true, 'professional')
    ON CONFLICT (company_id, feature) DO NOTHING;
  END IF;
  
  -- Enterprise tier features
  IF NEW.subscription_tier = 'enterprise' THEN
    INSERT INTO broker_company_features (company_id, feature, enabled, tier)
    VALUES
      (NEW.id, 'predictive_analytics', true, 'enterprise'),
      (NEW.id, 'api_access', true, 'enterprise'),
      (NEW.id, 'custom_reporting', true, 'enterprise'),
      (NEW.id, 'white_label', true, 'enterprise')
    ON CONFLICT (company_id, feature) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-initialize features on company creation
DROP TRIGGER IF EXISTS trigger_initialize_company_features ON public.broker_companies;
CREATE TRIGGER trigger_initialize_company_features
  AFTER INSERT ON public.broker_companies
  FOR EACH ROW
  EXECUTE FUNCTION initialize_company_features();

-- Initialize features for existing companies that don't have features set up
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN 
    SELECT id, subscription_tier 
    FROM broker_companies 
    WHERE id NOT IN (SELECT DISTINCT company_id FROM broker_company_features)
  LOOP
    -- Insert basic features
    INSERT INTO broker_company_features (company_id, feature, enabled, tier)
    VALUES
      (company_record.id, 'document_processing', true, 'basic'),
      (company_record.id, 'quote_comparison', true, 'basic')
    ON CONFLICT (company_id, feature) DO NOTHING;
    
    -- Professional features
    IF company_record.subscription_tier IN ('professional', 'enterprise') THEN
      INSERT INTO broker_company_features (company_id, feature, enabled, tier)
      VALUES
        (company_record.id, 'market_intelligence', true, 'professional'),
        (company_record.id, 'placement_tracking', true, 'professional'),
        (company_record.id, 'underwriter_matching', true, 'professional'),
        (company_record.id, 'appetite_guides', true, 'professional')
      ON CONFLICT (company_id, feature) DO NOTHING;
    END IF;
    
    -- Enterprise features
    IF company_record.subscription_tier = 'enterprise' THEN
      INSERT INTO broker_company_features (company_id, feature, enabled, tier)
      VALUES
        (company_record.id, 'predictive_analytics', true, 'enterprise'),
        (company_record.id, 'api_access', true, 'enterprise'),
        (company_record.id, 'custom_reporting', true, 'enterprise'),
        (company_record.id, 'white_label', true, 'enterprise')
      ON CONFLICT (company_id, feature) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.initialize_company_features IS 'Automatically initializes all tier-appropriate features as enabled when a company is created';