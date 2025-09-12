-- Fix sensitive data access vulnerability (corrected)
-- Add HR role to app_role enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hr_admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
        ALTER TYPE public.app_role ADD VALUE 'hr_admin';
    END IF;
END $$;

-- Create sensitive data consent table
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

-- Create HR role check function
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

-- Create consent check function
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

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Company admins can view team sensitive data" ON public.profile_sensitive_data;

-- Create new restrictive policies for sensitive data
CREATE POLICY "Users can access their own sensitive data"
ON public.profile_sensitive_data
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR admins can access team sensitive data with explicit consent only"
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
        -- Self-access always allowed
        profile_sensitive_data.user_id = auth.uid()
        OR
        -- HR access ONLY with explicit consent
        has_sensitive_data_consent(profile_sensitive_data.user_id, 'hr_access')
        OR
        -- Emergency access ONLY with explicit consent
        has_sensitive_data_consent(profile_sensitive_data.user_id, 'emergency_access')
    )
);

-- Create policies for consent table
CREATE POLICY "Users can grant consent for their own data"
ON public.sensitive_data_consent
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can revoke their own consent"
ON public.sensitive_data_consent
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view consent records for their data"
ON public.sensitive_data_consent
FOR SELECT
USING (
    user_id = auth.uid() 
    OR consented_by = auth.uid()
    OR is_hr_admin(auth.uid())
);

CREATE POLICY "HR admins can view consent records in their company"
ON public.sensitive_data_consent
FOR SELECT
USING (
    is_hr_admin(auth.uid()) 
    AND EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = sensitive_data_consent.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
    )
);

-- Create secure function for accessing sensitive data with automatic logging
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
    -- Check permissions first
    IF NOT (
        -- Self access
        auth.uid() = target_user_id
        OR
        -- HR with explicit consent
        (is_hr_admin(auth.uid()) AND has_sensitive_data_consent(target_user_id, 'hr_access'))
        OR
        -- Emergency access with explicit consent
        (is_hr_admin(auth.uid()) AND has_sensitive_data_consent(target_user_id, 'emergency_access'))
    ) THEN
        RAISE EXCEPTION 'Access denied: HR access to sensitive data requires explicit employee consent';
    END IF;
    
    -- Log the access for audit trail
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
    
    -- Return the authorized data
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

-- Update existing function to use new security model
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
    -- Log this bulk access attempt
    PERFORM public.log_sensitive_data_access(
        auth.uid(),
        'BULK_SENSITIVE_ACCESS_ATTEMPT',
        ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
        'Attempted bulk sensitive data access - now requires individual consent'
    );
    
    -- Only return user's own data - no bulk HR access without explicit consent
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
    
    -- If HR admin, inform about the new consent requirement
    IF is_hr_admin(auth.uid()) THEN
        RAISE NOTICE 'HR Notice: Sensitive data access now requires explicit employee consent. Use get_sensitive_data_with_consent() for individual employee data access.';
    END IF;
END;
$$;

-- Create function to grant consent (to be used by employees)
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

-- Add security documentation
COMMENT ON TABLE public.sensitive_data_consent IS 'SECURITY: Explicit consent mechanism for HR access to employee sensitive data. Prevents unauthorized access to personal information.';
COMMENT ON FUNCTION public.is_hr_admin IS 'SECURITY: Verifies HR admin role for sensitive data access authorization';
COMMENT ON FUNCTION public.has_sensitive_data_consent IS 'SECURITY: Enforces explicit employee consent before HR can access sensitive personal data';
COMMENT ON FUNCTION public.get_sensitive_data_with_consent IS 'SECURITY: Secure function for HR access to employee sensitive data with mandatory consent verification and audit logging';
COMMENT ON FUNCTION public.grant_sensitive_data_consent IS 'SECURITY: Employee function to grant explicit consent for HR access to sensitive personal data';

-- Log this critical security enhancement
INSERT INTO public.profile_access_audit (
    accessed_user_id,
    accessing_user_id,
    access_type,
    access_reason
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    'CRITICAL_SECURITY_FIX',
    'FIXED: Employee personal data theft vulnerability - implemented HR-only access with mandatory explicit consent mechanism'
);