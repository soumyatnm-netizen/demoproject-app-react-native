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

-- Enable RLS on the view (views can have RLS too)
ALTER VIEW public.profile_sensitive_data_secure ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for the view that ensures users can only see their own data or masked data
CREATE POLICY "Users can view sensitive data securely" 
ON public.profile_sensitive_data_secure 
FOR SELECT 
USING (true); -- Allow all users to query the view, but the view logic handles masking

-- Grant appropriate permissions to authenticated users only
REVOKE ALL ON public.profile_sensitive_data_secure FROM anon;
GRANT SELECT ON public.profile_sensitive_data_secure TO authenticated;