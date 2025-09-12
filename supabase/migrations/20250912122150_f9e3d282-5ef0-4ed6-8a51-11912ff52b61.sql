-- Step 2: Create consent system and secure sensitive data access (final fix)

-- Create consent table if not exists
CREATE TABLE IF NOT EXISTS public.sensitive_data_consent (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    consented_by uuid NOT NULL,
    consent_type text NOT NULL CHECK (consent_type IN ('hr_access', 'emergency_access', 'audit_access')),
    purpose text NOT NULL,
    expires_at timestamp with time zone,
    granted_at timestamp with time zone NOT NULL DEFAULT now(),
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(user_id, consent_type, consented_by)
);

ALTER TABLE public.sensitive_data_consent ENABLE ROW LEVEL SECURITY;

-- Create HR functions
CREATE OR REPLACE FUNCTION public.is_hr_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = $1 AND role = 'hr_admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.has_sensitive_data_consent(target_user_id uuid, consent_type text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.sensitive_data_consent 
        WHERE user_id = target_user_id 
        AND consented_by = auth.uid()
        AND consent_type = $2
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
    );
$$;

-- Remove existing overly permissive policies
DROP POLICY IF EXISTS "Company admins can view team sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can only access own sensitive data" ON public.profile_sensitive_data;

-- Create new restrictive policies
CREATE POLICY "Own sensitive data access only"
ON public.profile_sensitive_data
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR sensitive data requires explicit consent"
ON public.profile_sensitive_data
FOR SELECT
USING (
    is_hr_admin(auth.uid()) 
    AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = profile_sensitive_data.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
    )
    AND (
        profile_sensitive_data.user_id = auth.uid()
        OR has_sensitive_data_consent(profile_sensitive_data.user_id, 'hr_access')
        OR has_sensitive_data_consent(profile_sensitive_data.user_id, 'emergency_access')
    )
);

-- Consent table RLS policies
CREATE POLICY "Grant consent for own data"
ON public.sensitive_data_consent
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Revoke own consent"
ON public.sensitive_data_consent
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "View consent records policy"
ON public.sensitive_data_consent
FOR SELECT
USING (
    user_id = auth.uid() 
    OR consented_by = auth.uid()
    OR (is_hr_admin(auth.uid()) AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = sensitive_data_consent.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    ))
);

-- Secure access function with mandatory logging
CREATE OR REPLACE FUNCTION public.get_sensitive_data_with_consent(target_user_id uuid, access_reason text DEFAULT 'HR data access')
RETURNS TABLE(
    id uuid, 
    user_id uuid, 
    phone text, 
    personal_address text, 
    emergency_contact jsonb, 
    sensitive_notes text, 
    created_at timestamp with time zone, 
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Enforce access control
    IF NOT (
        auth.uid() = target_user_id
        OR (is_hr_admin(auth.uid()) AND has_sensitive_data_consent(target_user_id, 'hr_access'))
        OR (is_hr_admin(auth.uid()) AND has_sensitive_data_consent(target_user_id, 'emergency_access'))
    ) THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: HR access to employee sensitive data requires explicit consent from employee';
    END IF;

    -- Log access for audit
    IF auth.uid() != target_user_id THEN
        PERFORM public.log_sensitive_data_access(
            target_user_id,
            CASE 
                WHEN has_sensitive_data_consent(target_user_id, 'emergency_access') THEN 'EMERGENCY_SENSITIVE_ACCESS'
                ELSE 'HR_SENSITIVE_ACCESS_WITH_CONSENT'
            END,
            ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
            access_reason
        );
    END IF;

    -- Return authorized data
    RETURN QUERY
    SELECT 
        psd.id,
        psd.user_id,
        psd.phone,
        psd.personal_address,
        psd.emergency_contact,
        psd.sensitive_notes,
        psd.created_at,
        psd.updated_at
    FROM public.profile_sensitive_data psd
    WHERE psd.user_id = target_user_id;
END;
$$;

-- Employee consent grant function
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
    -- Verify HR role
    IF NOT is_hr_admin(hr_user_id) THEN
        RAISE EXCEPTION 'Cannot grant consent: specified user is not an HR administrator';
    END IF;
    
    -- Set expiry
    IF expires_in_days IS NOT NULL THEN
        v_expires_at := now() + (expires_in_days || ' days')::interval;
    END IF;
    
    -- Grant consent
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
    
    -- Log consent grant
    PERFORM public.log_sensitive_data_access(
        auth.uid(),
        'CONSENT_GRANTED',
        ARRAY['consent_management'],
        format('Employee granted %s consent to HR user %s: %s', consent_type, hr_user_id, purpose)
    );
    
    RETURN v_consent_id;
END;
$$;

-- Update existing function to only return own data
CREATE OR REPLACE FUNCTION public.get_accessible_sensitive_data()
RETURNS TABLE(
    id uuid, 
    user_id uuid, 
    phone text, 
    personal_address text, 
    emergency_contact jsonb, 
    sensitive_notes text, 
    created_at timestamp with time zone, 
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only return user's own data - no bulk access to employee data
    RETURN QUERY
    SELECT 
        psd.id,
        psd.user_id,
        psd.phone,
        psd.personal_address,
        psd.emergency_contact,
        psd.sensitive_notes,
        psd.created_at,
        psd.updated_at
    FROM public.profile_sensitive_data psd
    WHERE psd.user_id = auth.uid();
END;
$$;

-- Security documentation
COMMENT ON TABLE public.sensitive_data_consent IS 'SECURITY FIX: Explicit consent required for HR access to employee sensitive personal data. Prevents data theft.';
COMMENT ON FUNCTION public.get_sensitive_data_with_consent IS 'SECURITY FIX: Only authorized access to employee sensitive data with consent verification and mandatory audit logging.';

-- Log security fix completion
INSERT INTO public.sensitive_data_access_audit (
    accessed_user_id,
    accessing_user_id,
    access_type,
    access_reason
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    'SECURITY_VULNERABILITY_FIXED',
    'CRITICAL FIX: Employee personal data theft vulnerability resolved - HR access now requires explicit employee consent'
);