-- Fix remaining security vulnerabilities with audit logs and sensitive data protection

-- 1. Add comprehensive RLS policies for audit tables
CREATE POLICY "Super admins can manage all audit logs" 
ON public.profile_access_audit
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own audit trail" 
ON public.profile_access_audit
FOR SELECT
TO authenticated
USING (
    accessed_user_id = auth.uid() 
    OR accessing_user_id = auth.uid()
);

-- Prevent unauthorized modifications to audit logs
CREATE POLICY "System only can insert audit logs" 
ON public.profile_access_audit
FOR INSERT
TO authenticated
WITH CHECK (false); -- Only allow through security definer functions

-- Similar protection for sensitive data audit
CREATE POLICY "Super admins can manage sensitive audit logs" 
ON public.sensitive_data_access_audit
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own sensitive data audit" 
ON public.sensitive_data_access_audit
FOR SELECT
TO authenticated
USING (
    accessed_user_id = auth.uid() 
    OR accessing_user_id = auth.uid()
);

CREATE POLICY "System only can insert sensitive audit logs" 
ON public.sensitive_data_access_audit
FOR INSERT
TO authenticated
WITH CHECK (false); -- Only allow through security definer functions

-- 2. Strengthen profile sensitive data protection with additional constraints
-- Drop and recreate policies with even more restrictive access
DROP POLICY IF EXISTS "secure_hr_consent_2024" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "secure_own_data_2024" ON public.profile_sensitive_data;

-- Users can only access their own sensitive data
CREATE POLICY "Users own sensitive data access only" 
ON public.profile_sensitive_data
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- HR admins need explicit consent AND company verification
CREATE POLICY "HR admin with explicit consent access" 
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (
    is_hr_admin(auth.uid()) 
    AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = profile_sensitive_data.user_id 
        AND p.company_id = get_user_company_id(auth.uid())
        AND p.company_id IS NOT NULL
    )
    AND has_sensitive_data_consent(profile_sensitive_data.user_id, 'hr_access')
    AND EXISTS (
        SELECT 1 FROM public.sensitive_data_consent sdc
        WHERE sdc.user_id = profile_sensitive_data.user_id
        AND sdc.consented_by = auth.uid()
        AND sdc.consent_type = 'hr_access'
        AND sdc.revoked_at IS NULL
        AND (sdc.expires_at IS NULL OR sdc.expires_at > now())
        AND sdc.granted_at > now() - interval '30 days' -- Consent must be recent
    )
);

-- 3. Add data masking for sensitive information
CREATE OR REPLACE FUNCTION public.get_masked_sensitive_data(target_user_id uuid)
RETURNS TABLE(
    id uuid, 
    user_id uuid, 
    phone_masked text, 
    address_masked text, 
    emergency_contact_exists boolean,
    has_sensitive_notes boolean,
    last_updated timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only return masked data for non-consented access
    IF NOT has_sensitive_data_consent(target_user_id, 'hr_access') THEN
        RETURN QUERY
        SELECT 
            psd.id,
            psd.user_id,
            mask_sensitive_field(psd.phone, 'partial') as phone_masked,
            mask_sensitive_field(psd.personal_address, 'partial') as address_masked,
            (psd.emergency_contact IS NOT NULL) as emergency_contact_exists,
            (psd.sensitive_notes IS NOT NULL) as has_sensitive_notes,
            psd.updated_at
        FROM public.profile_sensitive_data psd
        WHERE psd.user_id = target_user_id;
    ELSE
        -- Return indication that full data access requires proper function call
        RETURN QUERY
        SELECT 
            gen_random_uuid() as id,
            target_user_id as user_id,
            'FULL_ACCESS_AVAILABLE'::text as phone_masked,
            'FULL_ACCESS_AVAILABLE'::text as address_masked,
            true as emergency_contact_exists,
            true as has_sensitive_notes,
            now() as last_updated;
    END IF;
END;
$$;

-- 4. Add automatic consent expiration
CREATE OR REPLACE FUNCTION public.expire_old_consents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Automatically revoke consents older than 90 days if no explicit expiry set
    UPDATE public.sensitive_data_consent 
    SET revoked_at = now()
    WHERE expires_at IS NULL 
    AND granted_at < now() - interval '90 days'
    AND revoked_at IS NULL;
    
    -- Log the automatic expiration
    INSERT INTO public.sensitive_data_access_audit (
        accessed_user_id,
        accessing_user_id,
        access_type,
        access_reason
    )
    SELECT 
        user_id,
        consented_by,
        'CONSENT_AUTO_EXPIRED',
        'Automatic consent expiration after 90 days'
    FROM public.sensitive_data_consent 
    WHERE revoked_at = now()
    AND access_reason IS NULL;
END;
$$;

-- 5. Create a secure company invite validation function
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_invite_code text, p_email text)
RETURNS TABLE(
    is_valid boolean,
    company_id uuid,
    role app_role,
    company_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (ci.id IS NOT NULL AND ci.expires_at > now() AND ci.used_at IS NULL) as is_valid,
        ci.company_id,
        ci.role,
        bc.name as company_name
    FROM public.company_invites ci
    LEFT JOIN public.broker_companies bc ON bc.id = ci.company_id
    WHERE ci.invite_code = p_invite_code
    AND LOWER(ci.email) = LOWER(p_email)
    AND ci.expires_at > now()
    AND ci.used_at IS NULL;
    
    -- Log the validation attempt
    PERFORM public.log_sensitive_operation(
        'INVITE_CODE_VALIDATION',
        'company_invites',
        (SELECT id FROM public.company_invites WHERE invite_code = p_invite_code LIMIT 1),
        jsonb_build_object('email', p_email, 'success', FOUND)
    );
END;
$$;