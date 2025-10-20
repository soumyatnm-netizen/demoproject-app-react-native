import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'BROKER' | 'ADMIN' | 'CC_STAFF' | null;

interface UseRoleReturn {
  role: UserRole;
  orgId: string | null;
  isBroker: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
}

export const useRole = (): UseRoleReturn => {
  const [role, setRole] = useState<UserRole>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (mounted) {
            setRole(null);
            setOrgId(null);
            setLoading(false);
          }
          return;
        }

        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('role, org_id')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          if (mounted) {
            setRole(null);
            setOrgId(null);
          }
        } else if (roleData && mounted) {
          setRole(roleData.role as UserRole);
          setOrgId(roleData.org_id);
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    orgId,
    isBroker: role === 'BROKER',
    isAdmin: role === 'ADMIN',
    isStaff: role === 'CC_STAFF',
    loading,
  };
};
