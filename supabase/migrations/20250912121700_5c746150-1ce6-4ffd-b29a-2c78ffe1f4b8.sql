-- Fix sensitive data access vulnerability
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
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consented_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE POLICY "HR admins can access team sensitive data with consent"
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
        -- HR access with explicit consent
        has_sensitive_data_consent(profile_sensitive_data.user_id, 'hr_access')
        OR
        -- Emergency access (logged separately)
        has_sensitive_data_consent(profile_sensitive_data.user_id, 'emergency_access')
    )
);

-- Create emergency access logging trigger
CREATE OR REPLACE FUNCTION public.log_sensitive_emergency_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log emergency access attempts
    IF has_sensitive_data_consent(NEW.user_id, 'emergency_access') AND auth.uid() != NEW.user_id THEN
        PERFORM public.log_sensitive_data_access(
            NEW.user_id,
            'EMERGENCY_ACCESS',
            ARRAY['phone', 'personal_address', 'emergency_contact'],
            'HR emergency access to employee sensitive data'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Add trigger for emergency access logging
DROP TRIGGER IF EXISTS log_sensitive_emergency_access_trigger ON public.profile_sensitive_data;
CREATE TRIGGER log_sensitive_emergency_access_trigger
    AFTER SELECT ON public.profile_sensitive_data
    FOR EACH ROW
    EXECUTE FUNCTION public.log_sensitive_emergency_access();

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

CREATE POLICY "HR admins can view consent records"
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

-- Update existing sensitive data access function for enhanced security
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
    -- Log this access attempt
    PERFORM public.log_sensitive_data_access(
        auth.uid(),
        'BULK_SENSITIVE_ACCESS',
        ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
        'Bulk sensitive data access via secure function'
    );
    
    -- Return only authorized data
    RETURN QUERY
    SELECT 
        psd.id,
        psd.user_id,
        CASE 
            WHEN psd.user_id = auth.uid() THEN psd.phone
            WHEN is_hr_admin(auth.uid()) AND has_sensitive_data_consent(psd.user_id, 'hr_access') THEN psd.phone
            ELSE public.mask_sensitive_field(psd.phone, 'partial')
        END as phone,
        CASE 
            WHEN psd.user_id = auth.uid() THEN psd.personal_address
            WHEN is_hr_admin(auth.uid()) AND has_sensitive_data_consent(psd.user_id, 'hr_access') THEN psd.personal_address
            ELSE public.mask_sensitive_field(psd.personal_address, 'partial')
        END as personal_address,
        CASE 
            WHEN psd.user_id = auth.uid() THEN psd.emergency_contact
            WHEN is_hr_admin(auth.uid()) AND has_sensitive_data_consent(psd.user_id, 'hr_access') THEN psd.emergency_contact
            ELSE '{"masked": true}'::jsonb
        END as emergency_contact,
        CASE 
            WHEN psd.user_id = auth.uid() THEN psd.sensitive_notes
            WHEN is_hr_admin(auth.uid()) AND has_sensitive_data_consent(psd.user_id, 'hr_access') THEN psd.sensitive_notes
            ELSE 'Access restricted - consent required'
        END as sensitive_notes,
        psd.created_at,
        psd.updated_at
    FROM public.profile_sensitive_data psd
    WHERE psd.user_id = auth.uid() 
    OR (
        is_hr_admin(auth.uid()) 
        AND EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = psd.user_id 
            AND p.company_id = get_user_company_id(auth.uid())
            AND get_user_company_id(auth.uid()) IS NOT NULL
        )
    );
END;
$$;

-- Add security documentation
COMMENT ON TABLE public.sensitive_data_consent IS 'Explicit consent mechanism for accessing employee sensitive personal data. Requires HR role and explicit user consent.';
COMMENT ON FUNCTION public.is_hr_admin IS 'Checks if user has HR admin role for accessing sensitive employee data';
COMMENT ON FUNCTION public.has_sensitive_data_consent IS 'Verifies explicit consent exists for accessing sensitive employee data';

-- Log this security enhancement
INSERT INTO public.profile_access_audit (
    accessed_user_id,
    accessing_user_id,
    access_type,
    access_reason
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    'SECURITY_ENHANCEMENT',
    'Implemented HR-only access controls and explicit consent mechanism for sensitive employee data to prevent unauthorized access'
);