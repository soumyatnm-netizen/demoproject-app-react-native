-- Fix Security Definer View Issue
-- Remove SECURITY DEFINER from view and create safer alternative

-- Drop the problematic view
DROP VIEW IF EXISTS public.profile_sensitive_data_masked;

-- Create a safer function-based approach instead of SECURITY DEFINER view
CREATE OR REPLACE FUNCTION public.get_masked_sensitive_data_secure(target_user_id uuid)
RETURNS TABLE(
    id uuid,
    user_id uuid,
    phone text,
    personal_address text,
    emergency_contact jsonb,
    sensitive_notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    access_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    access_validation jsonb;
    mask_level text;
BEGIN
    -- Get access validation
    access_validation := public.validate_enhanced_sensitive_access(target_user_id, 'masked_data_access');
    
    -- Extract mask level
    mask_level := access_validation->>'mask_level';
    
    -- Only return data if access is allowed
    IF (access_validation->>'allowed')::boolean THEN
        RETURN QUERY
        SELECT 
            psd.id,
            psd.user_id,
            CASE 
                WHEN mask_level = 'none' THEN psd.phone
                WHEN mask_level = 'partial' THEN public.mask_sensitive_field(psd.phone, 'partial')
                ELSE '***PROTECTED***'
            END as phone,
            CASE 
                WHEN mask_level = 'none' THEN psd.personal_address
                WHEN mask_level = 'partial' THEN public.mask_sensitive_field(psd.personal_address, 'partial')
                ELSE '***PROTECTED***'
            END as personal_address,
            CASE 
                WHEN mask_level = 'none' THEN psd.emergency_contact
                WHEN mask_level = 'partial' THEN jsonb_build_object('contact_exists', psd.emergency_contact IS NOT NULL)
                ELSE jsonb_build_object('access', 'protected')
            END as emergency_contact,
            CASE 
                WHEN mask_level = 'none' THEN psd.sensitive_notes
                ELSE CASE WHEN psd.sensitive_notes IS NOT NULL THEN '***PROTECTED NOTES***' ELSE NULL END
            END as sensitive_notes,
            psd.created_at,
            psd.updated_at,
            mask_level as access_level
        FROM public.profile_sensitive_data psd
        WHERE psd.user_id = target_user_id;
    END IF;
END;
$$;

-- Create cleanup function for expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_access_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Auto-expire sessions
    UPDATE public.sensitive_data_access_sessions 
    SET revoked_at = now()
    WHERE expires_at < now() 
    AND revoked_at IS NULL;
    
    -- Delete very old sessions (older than 7 days)
    DELETE FROM public.sensitive_data_access_sessions
    WHERE created_at < (now() - interval '7 days');
END;
$$;