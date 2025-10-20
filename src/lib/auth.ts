import { supabase } from "@/integrations/supabase/client";

/**
 * Send a password reset email with proper redirect URL
 * @param email User's email address
 * @returns Promise with error if any
 */
export async function sendPasswordReset(email: string) {
  const redirectUrl = `${window.location.origin}/auth/reset`;
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });
  
  return { error };
}

/**
 * Update user's password
 * @param newPassword The new password
 * @returns Promise with error if any
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  
  return { error };
}

/**
 * Sign out the current user
 * @returns Promise with error if any
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}
