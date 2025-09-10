-- Fix Security Definer View issue by recreating the view with proper security

-- Drop the existing view that has security definer issues
DROP VIEW IF EXISTS public.profile_sensitive_data_secure;

-- Recreate the view with SECURITY INVOKER (default) instead of SECURITY DEFINER
-- This ensures the view runs with the querying user's permissions, not the creator's
CREATE VIEW public.profile_sensitive_data_secure AS
SELECT 
    id,
    user_id,
    CASE
        WHEN (auth.uid() = user_id) THEN phone
        ELSE mask_sensitive_field(phone, 'partial'::text)
    END AS phone,
    CASE
        WHEN (auth.uid() = user_id) THEN personal_address
        ELSE mask_sensitive_field(personal_address, 'partial'::text)
    END AS personal_address,
    CASE
        WHEN (auth.uid() = user_id) THEN emergency_contact
        ELSE '{"masked": true}'::jsonb
    END AS emergency_contact,
    CASE
        WHEN (auth.uid() = user_id) THEN sensitive_notes
        ELSE mask_sensitive_field(sensitive_notes, 'full'::text)
    END AS sensitive_notes,
    created_at,
    updated_at
FROM public.profile_sensitive_data;

-- Grant appropriate permissions to authenticated users only
-- Remove access from anonymous users for better security
REVOKE ALL ON public.profile_sensitive_data_secure FROM anon;
REVOKE ALL ON public.profile_sensitive_data_secure FROM public;
GRANT SELECT ON public.profile_sensitive_data_secure TO authenticated;

-- Ensure the underlying table has proper RLS policies
-- (The view will inherit the security context of the querying user)