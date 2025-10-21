import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FeatureAccess {
  [key: string]: boolean;
}

export const useFeatureAccess = () => {
  const [features, setFeatures] = useState<FeatureAccess>({});
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadFeatureAccess();
  }, []);

  const loadFeatureAccess = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get user's company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        setLoading(false);
        return;
      }

      setCompanyId(profile.company_id);

      // Get company features
      const { data: companyFeatures } = await supabase
        .rpc('get_company_features', { p_company_id: profile.company_id });

      // Convert to feature map
      const featureMap: FeatureAccess = {};
      companyFeatures?.forEach((f: any) => {
        featureMap[f.feature] = f.enabled;
      });

      setFeatures(featureMap);
    } catch (error) {
      console.error('Error loading feature access:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (featureName: string): boolean => {
    // If no feature record exists, default to enabled (true)
    // If a record exists, use the enabled value from the database
    const feature = features[featureName];
    return feature !== undefined ? feature : true;
  };

  const checkFeature = async (featureName: string): Promise<boolean> => {
    if (!companyId) return false;
    
    try {
      const { data } = await supabase
        .rpc('check_company_feature', { 
          p_company_id: companyId,
          p_feature_name: featureName 
        });
      return data === true;
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    }
  };

  return {
    features,
    loading,
    hasFeature,
    checkFeature,
    refetch: loadFeatureAccess,
  };
};
