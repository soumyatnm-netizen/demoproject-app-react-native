-- Enhanced Security System for Profile Sensitive Data
-- Addresses: Employee Phone Numbers and Addresses Could Be Accessed by Unauthorized Users

-- 1. Create enhanced security session table for sensitive data access
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hr_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    session_token text NOT NULL UNIQUE,
    purpose text NOT NULL,
    ip_address inet,
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    accessed_fields text[] DEFAULT ARRAY[]::text[],
    access_count integer DEFAULT 0,
    revoked_at timestamp with time zone,
    auto_expire_minutes integer DEFAULT 15
);

ALTER TABLE public.sensitive_data_access_sessions ENABLE ROW LEVEL SECURITY;

-- Only HR admins can manage their own sessions
CREATE POLICY "HR admins manage own access sessions"
ON public.sensitive_data_access_sessions
FOR ALL
TO authenticated
USING (hr_user_id = auth.uid() AND is_hr_admin(auth.uid()))
WITH CHECK (hr_user_id = auth.uid() AND is_hr_admin(auth.uid()));

-- 2. Create data masking levels enum
DO $$ BEGIN
    CREATE TYPE public.data_mask_level AS ENUM ('none', 'partial', 'full', 'blocked');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Enhanced security validation function
CREATE OR REPLACE FUNCTION public.validate_enhanced_sensitive_access(
    target_user_id uuid,
    access_purpose text DEFAULT 'hr_data_access',
    requested_fields text[] DEFAULT ARRAY['phone', 'personal_address', 'emergency_contact']
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    accessing_user_id uuid;
    user_company_id uuid;
    target_company_id uuid;
    valid_consent_exists boolean := false;
    active_session_exists boolean := false;
    risk_score integer := 0;
    access_decision jsonb;
    recent_access_count integer;
BEGIN
    accessing_user_id := auth.uid();
    
    -- Self-access always allowed (with audit)
    IF accessing_user_id = target_user_id THEN
        PERFORM public.log_sensitive_data_access(
            target_user_id,
            'SELF_ACCESS',
            requested_fields,
            access_purpose
        );
        RETURN jsonb_build_object(
            'allowed', true,
            'mask_level', 'none',
            'reason', 'self_access',
            'session_required', false
        );
    END IF;
    
    -- Verify HR admin status
    IF NOT is_hr_admin(accessing_user_id) THEN
        PERFORM public.log_security_violation(
            'UNAUTHORIZED_HR_ACCESS',
            'profile_sensitive_data',
            jsonb_build_object('target_user_id', target_user_id, 'purpose', access_purpose)
        );
        RETURN jsonb_build_object(
            'allowed', false,
            'mask_level', 'blocked',
            'reason', 'not_hr_admin',
            'session_required', false
        );
    END IF;
    
    -- Get company IDs
    SELECT get_user_company_id(accessing_user_id) INTO user_company_id;
    SELECT get_user_company_id(target_user_id) INTO target_company_id;
    
    -- Verify same company
    IF user_company_id IS NULL OR target_company_id IS NULL OR user_company_id != target_company_id THEN
        PERFORM public.log_security_violation(
            'CROSS_COMPANY_ACCESS_ATTEMPT',
            'profile_sensitive_data',
            jsonb_build_object('target_user_id', target_user_id, 'hr_company', user_company_id, 'target_company', target_company_id)
        );
        RETURN jsonb_build_object(
            'allowed', false,
            'mask_level', 'blocked',
            'reason', 'cross_company_access',
            'session_required', false
        );
    END IF;
    
    -- Calculate risk score based on recent access patterns
    SELECT COUNT(*) INTO recent_access_count
    FROM public.sensitive_data_access_audit
    WHERE accessing_user_id = accessing_user_id
    AND access_timestamp > (now() - interval '1 hour');
    
    risk_score := CASE
        WHEN recent_access_count > 10 THEN 100
        WHEN recent_access_count > 5 THEN 75
        WHEN recent_access_count > 2 THEN 50
        ELSE 25
    END;
    
    -- Check for valid employee consent (stricter validation)
    SELECT EXISTS (
        SELECT 1 FROM public.sensitive_data_consent sdc
        WHERE sdc.user_id = target_user_id
        AND sdc.consented_by = accessing_user_id
        AND sdc.revoked_at IS NULL
        AND sdc.expires_at > now()
        AND sdc.granted_at > (now() - interval '12 hours')  -- Reduced from 24 hours
        AND sdc.purpose LIKE '%[EMPLOYEE_APPROVED]%'
        AND sdc.consent_type = 'hr_access'
    ) INTO valid_consent_exists;
    
    -- Check for active security session
    SELECT EXISTS (
        SELECT 1 FROM public.sensitive_data_access_sessions
        WHERE hr_user_id = accessing_user_id
        AND target_user_id = target_user_id
        AND expires_at > now()
        AND revoked_at IS NULL
        AND access_count < 5  -- Limit access attempts per session
    ) INTO active_session_exists;
    
    -- Determine access level based on security factors
    IF valid_consent_exists AND active_session_exists AND risk_score < 75 THEN
        -- Full access with active monitoring
        access_decision := jsonb_build_object(
            'allowed', true,
            'mask_level', 'none',
            'reason', 'full_authorization',
            'session_required', true,
            'risk_score', risk_score
        );
    ELSIF valid_consent_exists AND risk_score < 50 THEN
        -- Partial access with masking
        access_decision := jsonb_build_object(
            'allowed', true,
            'mask_level', 'partial',
            'reason', 'consent_only',
            'session_required', true,
            'risk_score', risk_score
        );
    ELSIF is_super_admin(accessing_user_id) AND active_session_exists THEN
        -- Super admin emergency access
        access_decision := jsonb_build_object(
            'allowed', true,
            'mask_level', 'none',
            'reason', 'super_admin_emergency',
            'session_required', true,
            'risk_score', risk_score
        );
    ELSE
        -- Deny access
        access_decision := jsonb_build_object(
            'allowed', false,
            'mask_level', 'blocked',
            'reason', 'insufficient_authorization',
            'session_required', false,
            'risk_score', risk_score
        );
    END IF;
    
    -- Log the access attempt
    PERFORM public.log_sensitive_data_access(
        target_user_id,
        CASE WHEN (access_decision->>'allowed')::boolean THEN 'AUTHORIZED_ACCESS' ELSE 'DENIED_ACCESS' END,
        requested_fields,
        format('%s (Risk: %s, Consent: %s, Session: %s)', 
               access_purpose, risk_score, valid_consent_exists, active_session_exists)
    );
    
    RETURN access_decision;
END;
$$;

-- 4. Create secure access session function
CREATE OR REPLACE FUNCTION public.create_sensitive_data_session(
    target_user_id uuid,
    purpose text,
    duration_minutes integer DEFAULT 15
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    session_id uuid;
    session_token text;
BEGIN
    -- Verify HR admin and same company
    IF NOT is_hr_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only HR administrators can create sensitive data access sessions';
    END IF;
    
    IF get_user_company_id(auth.uid()) != get_user_company_id(target_user_id) THEN
        RAISE EXCEPTION 'Cannot create session for users outside your company';
    END IF;
    
    -- Limit session duration (max 30 minutes)
    IF duration_minutes > 30 THEN
        duration_minutes := 30;
    END IF;
    
    -- Generate secure session token
    session_token := encode(gen_random_bytes(32), 'base64');
    
    -- Create session record
    INSERT INTO public.sensitive_data_access_sessions (
        hr_user_id,
        target_user_id,
        session_token,
        purpose,
        expires_at,
        auto_expire_minutes
    ) VALUES (
        auth.uid(),
        target_user_id,
        session_token,
        purpose,
        now() + (duration_minutes || ' minutes')::interval,
        duration_minutes
    ) RETURNING id INTO session_id;
    
    -- Log session creation
    PERFORM public.log_sensitive_data_access(
        target_user_id,
        'SESSION_CREATED',
        ARRAY['session_management'],
        format('HR admin created %s-minute access session: %s', duration_minutes, purpose)
    );
    
    RETURN session_id;
END;
$$;

-- 5. Replace the existing RLS policy with enhanced version
DROP POLICY IF EXISTS "ultra_secure_sensitive_data_select_v4" ON public.profile_sensitive_data;

CREATE POLICY "enterprise_secure_sensitive_data_select_v6"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (
    -- Use the enhanced validation function
    (public.validate_enhanced_sensitive_access(user_id, 'profile_data_access'))->>'allowed' = 'true'
);

-- 6. Create masked data view for safer access
CREATE OR REPLACE VIEW public.profile_sensitive_data_masked AS
SELECT 
    id,
    user_id,
    CASE 
        WHEN (public.validate_enhanced_sensitive_access(user_id))->>'mask_level' = 'none' THEN phone
        WHEN (public.validate_enhanced_sensitive_access(user_id))->>'mask_level' = 'partial' THEN public.mask_sensitive_field(phone, 'partial')
        ELSE '***PROTECTED***'
    END as phone,
    CASE 
        WHEN (public.validate_enhanced_sensitive_access(user_id))->>'mask_level' = 'none' THEN personal_address
        WHEN (public.validate_enhanced_sensitive_access(user_id))->>'mask_level' = 'partial' THEN public.mask_sensitive_field(personal_address, 'partial')
        ELSE '***PROTECTED***'
    END as personal_address,
    CASE 
        WHEN (public.validate_enhanced_sensitive_access(user_id))->>'mask_level' = 'none' THEN emergency_contact
        WHEN (public.validate_enhanced_sensitive_access(user_id))->>'mask_level' = 'partial' THEN jsonb_build_object('contact_exists', emergency_contact IS NOT NULL)
        ELSE jsonb_build_object('access', 'protected')
    END as emergency_contact,
    CASE 
        WHEN (public.validate_enhanced_sensitive_access(user_id))->>'mask_level' = 'none' THEN sensitive_notes
        ELSE CASE WHEN sensitive_notes IS NOT NULL THEN '***PROTECTED NOTES***' ELSE NULL END
    END as sensitive_notes,
    created_at,
    updated_at
FROM public.profile_sensitive_data;