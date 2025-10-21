import { supabase } from "@/integrations/supabase/client";

/**
 * Get the company_id for the current authenticated user
 * @returns The company_id or null if not found
 * @throws Error if user is not authenticated or profile not found
 */
export async function getCurrentUserCompanyId(): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile?.company_id) {
    throw new Error('User profile or company not found');
  }

  return profile.company_id;
}
