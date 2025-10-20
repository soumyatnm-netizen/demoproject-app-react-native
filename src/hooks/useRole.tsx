import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export type UserRole = 'ADMIN' | 'BROKER' | 'company_admin' | 'broker' | 'hr_admin' | 'super_admin' | null;

interface UseRoleReturn {
  role: UserRole;
  orgId: string | null;
  isAdmin: boolean;
  isBroker: boolean;
  isLoading: boolean;
  user: User | null;
}

export const useRole = (): UseRoleReturn => {
  const [role, setRole] = useState<UserRole>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !currentUser) {
          setIsLoading(false);
          return;
        }

        setUser(currentUser);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, company_id')
          .eq('user_id', currentUser.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setIsLoading(false);
          return;
        }

        if (profile) {
          setRole(profile.role as UserRole);
          setOrgId(profile.company_id);
        }
      } catch (error) {
        console.error('Error in useRole:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setRole(null);
        setOrgId(null);
        setUser(null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        fetchUserRole();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = role === 'ADMIN' || role === 'company_admin' || role === 'super_admin';
  const isBroker = role === 'BROKER' || role === 'broker';

  return {
    role,
    orgId,
    isAdmin,
    isBroker,
    isLoading,
    user
  };
};
