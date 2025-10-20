import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRole } from './useRole';

type Feature = 
  | 'client_mgmt'
  | 'instant_compare'
  | 'docs_and_guides'
  | 'insurer_matching'
  | 'attack_intel'
  | 'market_intel'
  | 'team_mgmt'
  | 'company_usage'
  | 'invite_codes';

interface OrgFeature {
  feature: string;
  enabled: boolean;
  tier: string | null;
}

export const useFeatures = () => {
  const { orgId, isStaff } = useRole();
  const [features, setFeatures] = useState<OrgFeature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatures = async () => {
      if (!orgId && !isStaff) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('org_features')
          .select('feature, enabled, tier')
          .eq('org_id', orgId || '');

        if (error) {
          console.error('Error fetching features:', error);
        } else if (data) {
          setFeatures(data);
        }
      } catch (error) {
        console.error('Error in fetchFeatures:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, [orgId, isStaff]);

  const enabled = (featureKey: Feature): boolean => {
    // CC Staff has access to everything
    if (isStaff) return true;
    
    const feature = features.find(f => f.feature === featureKey);
    return feature?.enabled ?? false;
  };

  const tier = (featureKey: Feature): string | null => {
    const feature = features.find(f => f.feature === featureKey);
    return feature?.tier ?? null;
  };

  return {
    enabled,
    tier,
    loading,
  };
};
