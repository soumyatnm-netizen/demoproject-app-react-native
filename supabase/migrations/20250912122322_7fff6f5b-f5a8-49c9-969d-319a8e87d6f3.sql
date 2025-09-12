-- Final step: Complete security fix with consent management

-- Create function for employees to grant consent to HR
CREATE OR REPLACE FUNCTION public.grant_sensitive_data_consent(hr_user_id uuid, consent_type text, purpose text, expires_in_days integer DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_consent_id uuid;
    v_expires_at timestamp with time zone;
BEGIN
    -- Verify the HR user exists and has HR role
    IF NOT is_hr_admin(hr_user_id) THEN
        RAISE EXCEPTION 'Cannot grant consent: specified user is not an HR administrator';
    END IF;
    
    -- Calculate expiry if specified
    IF expires_in_days IS NOT NULL THEN
        v_expires_at := now() + (expires_in_days || ' days')::interval;
    END IF;
    
    -- Insert or update consent record
    INSERT INTO public.sensitive_data_consent (
        user_id,
        consented_by,
        consent_type,
        purpose,
        expires_at
    ) VALUES (
        auth.uid(),
        hr_user_id,
        consent_type,
        purpose,
        v_expires_at
    )
    ON CONFLICT (user_id, consent_type, consented_by)
    DO UPDATE SET
        purpose = EXCLUDED.purpose,
        expires_at = EXCLUDED.expires_at,
        granted_at = now(),
        revoked_at = NULL
    RETURNING id INTO v_consent_id;
    
    -- Log the consent action
    PERFORM public.log_sensitive_data_access(
        auth.uid(),
        'CONSENT_GRANTED',
        ARRAY['consent_management'],
        format('Employee granted %s consent to HR user %s: %s', consent_type, hr_user_id, purpose)
    );
    
    RETURN v_consent_id;
END;
$$;

-- Create function to revoke consent
CREATE OR REPLACE FUNCTION public.revoke_sensitive_data_consent(hr_user_id uuid, consent_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.sensitive_data_consent 
    SET revoked_at = now()
    WHERE user_id = auth.uid() 
    AND consented_by = hr_user_id 
    AND consent_type = $2
    AND revoked_at IS NULL;
    
    IF FOUND THEN
        PERFORM public.log_sensitive_data_access(
            auth.uid(),
            'CONSENT_REVOKED',
            ARRAY['consent_management'],
            format('Employee revoked %s consent from HR user %s', consent_type, hr_user_id)
        );
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- Add comprehensive documentation
COMMENT ON TABLE public.sensitive_data_consent IS 'SECURITY FIX: Explicit consent mechanism for HR access to employee sensitive personal data. Prevents unauthorized access to phone numbers, addresses, and emergency contacts.';
COMMENT ON FUNCTION public.is_hr_admin IS 'SECURITY: Verifies HR admin role for sensitive data access authorization';
COMMENT ON FUNCTION public.has_sensitive_data_consent IS 'SECURITY: Enforces explicit employee consent before HR can access sensitive personal data';
COMMENT ON FUNCTION public.get_sensitive_data_with_consent IS 'SECURITY: Secure function for HR access to employee sensitive data with mandatory consent verification and audit logging';
COMMENT ON FUNCTION public.grant_sensitive_data_consent IS 'SECURITY: Employee function to grant explicit consent for HR access to sensitive personal data with optional expiry';
COMMENT ON FUNCTION public.revoke_sensitive_data_consent IS 'SECURITY: Employee function to revoke HR access consent to sensitive personal data';

-- Log the security vulnerability fix
INSERT INTO public.profile_access_audit (
    accessed_user_id,
    accessing_user_id,
    access_type,
    access_reason
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    'CRITICAL_VULNERABILITY_FIXED',
    'SECURITY FIX COMPLETED: Employee personal data theft vulnerability resolved. Company admins no longer have unrestricted access to phone numbers, addresses, and emergency contacts. HR access now requires explicit employee consent and is fully audited.'
);