-- Fix critical security vulnerabilities identified in security scan

-- 1. Fix profile_sensitive_data exposure - make it even more restrictive
DROP POLICY IF EXISTS "ultra_secure_sensitive_data_select_v3" ON public.profile_sensitive_data;

CREATE POLICY "ultra_secure_sensitive_data_select_v4"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (
    -- Only allow access to own data OR with explicit HR consent validation
    user_id = auth.uid()
    OR (
        -- HR admin with valid, recent consent
        is_hr_admin(auth.uid()) 
        AND EXISTS (
            SELECT 1 FROM public.sensitive_data_consent sdc
            WHERE sdc.user_id = profile_sensitive_data.user_id
            AND sdc.consented_by = auth.uid()
            AND sdc.revoked_at IS NULL
            AND sdc.expires_at > now()
            AND sdc.granted_at > (now() - interval '24 hours')
            AND sdc.purpose LIKE '%[EMPLOYEE_APPROVED]%'
        )
        AND get_user_company_id(profile_sensitive_data.user_id) = get_user_company_id(auth.uid())
    )
);

-- 2. Fix profiles table to prevent cross-company access completely
DROP POLICY IF EXISTS "secure_profiles_select_v4" ON public.profiles;

CREATE POLICY "ultra_secure_profiles_select_v5"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    -- Users can only view their own profile
    user_id = auth.uid()
    OR (
        -- Company admins can view team members in same company ONLY
        is_company_admin(auth.uid()) 
        AND company_id = get_user_company_id(auth.uid())
        AND get_user_company_id(auth.uid()) IS NOT NULL
        AND company_id IS NOT NULL
    )
    OR (
        -- Super admins have full access
        is_super_admin(auth.uid())
    )
);

-- 3. Fix broker_companies to prevent any cross-company visibility
DROP POLICY IF EXISTS "secure_companies_select_v4" ON public.broker_companies;

CREATE POLICY "ultra_secure_companies_select_v5"
ON public.broker_companies
FOR SELECT
TO authenticated
USING (
    -- Only users from the exact same company can view company details
    id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- 4. Make company_invites even more secure
DROP POLICY IF EXISTS "secure_invites_manage_v4" ON public.company_invites;
DROP POLICY IF EXISTS "secure_invites_view_own_v4" ON public.company_invites;

CREATE POLICY "ultra_secure_invites_admin_manage_v5"
ON public.company_invites
FOR ALL
TO authenticated
USING (
    -- Only company admins can manage their own company's invites
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
    AND expires_at > now()
    AND used_at IS NULL
)
WITH CHECK (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
    AND expires_at > now()
);

CREATE POLICY "ultra_secure_invites_user_view_v5"
ON public.company_invites
FOR SELECT
TO authenticated
USING (
    -- Users can ONLY view invites for their exact email that are valid and recent
    LOWER(TRIM(email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    AND expires_at > now()
    AND used_at IS NULL
    AND created_at > (now() - interval '48 hours')
    -- Additional security: ensure invite is not expired by more than grace period
    AND expires_at > (now() - interval '1 hour')
);

-- 5. Add additional security function to validate company boundaries
CREATE OR REPLACE FUNCTION public.is_same_company_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p1
        JOIN public.profiles p2 ON p1.company_id = p2.company_id
        WHERE p1.user_id = auth.uid()
        AND p2.user_id = target_user_id
        AND p1.company_id IS NOT NULL
        AND p2.company_id IS NOT NULL
        AND p1.is_active = true
        AND p2.is_active = true
    );
$$;

-- 6. Add audit trail for sensitive data access attempts
CREATE OR REPLACE FUNCTION public.log_security_violation(
    violation_type text,
    attempted_resource text,
    details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.sensitive_data_access_audit (
        accessed_user_id,
        accessing_user_id,
        access_type,
        access_reason,
        accessed_fields
    ) VALUES (
        COALESCE((details->>'target_user_id')::uuid, gen_random_uuid()),
        auth.uid(),
        'SECURITY_VIOLATION',
        format('%s: %s - %s', violation_type, attempted_resource, details::text),
        ARRAY['security_violation']
    );
END;
$$;