-- Step 2: Create consent table, policies, and secure functions (now that enum is committed)

-- Create sensitive data consent table if not exists
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

-- Enable RLS on consent table
ALTER TABLE public.sensitive_data_consent ENABLE ROW LEVEL SECURITY;

-- HR role check function
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

-- Consent check function
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

-- Replace permissive policy on profile_sensitive_data
DROP POLICY IF EXISTS "Company admins can view team sensitive data" ON public.profile_sensitive_data;

CREATE POLICY "Users can manage their own sensitive data"
ON public.profile_sensitive_data
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR admins can read sensitive data with explicit consent"
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

-- Consent table policies
CREATE POLICY "Users can grant consent for their own data"
ON public.sensitive_data_consent
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can revoke their own consent"
ON public.sensitive_data_consent
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "View consent records"
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

-- Secure function for targeted access with logging
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
    IF NOT (
        auth.uid() = target_user_id
        OR (is_hr_admin(auth.uid()) AND has_sensitive_data_consent(target_user_id, 'hr_access'))
        OR (is_hr_admin(auth.uid()) AND has_sensitive_data_consent(target_user_id, 'emergency_access'))
    ) THEN
        RAISE EXCEPTION 'Access denied: HR access to sensitive data requires explicit employee consent';
    END IF;

    IF auth.uid() != target_user_id THEN
        PERFORM public.log_sensitive_data_access(
            target_user_id,
            CASE 
                WHEN has_sensitive_data_consent(target_user_id, 'emergency_access') THEN 'EMERGENCY_SENSITIVE_ACCESS'
                ELSE 'HR_SENSITIVE_ACCESS'
            END,
            ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
            access_reason
        );
    END IF;

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

-- Update bulk helper to no longer expose others' data
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

-- Docs
COMMENT ON TABLE public.sensitive_data_consent IS 'SECURITY: Explicit consent for HR/emergency access to employee sensitive data.';
COMMENT ON FUNCTION public.is_hr_admin IS 'SECURITY: Checks HR role';
COMMENT ON FUNCTION public.has_sensitive_data_consent IS 'SECURITY: Verifies consent is active and not expired';
COMMENT ON FUNCTION public.get_sensitive_data_with_consent IS 'SECURITY: Gatekept sensitive data access with mandatory logging';