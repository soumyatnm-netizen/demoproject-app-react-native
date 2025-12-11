import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSuperAdminCheck = () => {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSuperAdminStatus();
  }, []);

  const checkSuperAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user has CC_STAFF role or is_super_admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin, role')
        .eq('user_id', user.id)
        .single();

      const isCCStaff = profile?.role === 'CC_STAFF';
      const isSuperAdminFlag = profile?.is_super_admin === true;

      setIsSuperAdmin(isCCStaff || isSuperAdminFlag);
    } catch (error) {
      console.error('Error checking super admin status:', error);
    } finally {
      setLoading(false);
    }
  };

  return { isSuperAdmin, loading };
};
