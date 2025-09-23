-- CRITICAL SECURITY FIX: Replace vulnerable RLS policies (Corrected)
-- Fixes employee personal data theft vulnerability

-- Drop the vulnerable complex policies
DROP POLICY IF EXISTS "enterprise_secure_sensitive_data_select_v6" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "secure_sensitive_data_insert_v2" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "secure_sensitive_data_update_v2" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "secure_sensitive_data_delete_v2" ON public.profile_sensitive_data;

-- SECURE POLICY 1: Users can only access their own sensitive data (BULLETPROOF)
CREATE POLICY "users_own_sensitive_data_only"
    ON public.profile_sensitive_data
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- SECURE POLICY 2: HR admins with explicit consent and same company validation
CREATE POLICY "hr_admin_consented_access"
    ON public.profile_sensitive_data
    FOR SELECT
    TO authenticated
    USING (
        user_id != auth.uid() -- Not self-access (covered by policy 1)
        AND is_hr_admin(auth.uid()) -- Must be HR admin
        AND EXISTS ( -- Must be same company
            SELECT 1 FROM public.profiles target_profile
            JOIN public.profiles hr_profile ON target_profile.company_id = hr_profile.company_id
            WHERE target_profile.user_id = profile_sensitive_data.user_id
            AND hr_profile.user_id = auth.uid()
            AND target_profile.company_id IS NOT NULL
            AND hr_profile.company_id IS NOT NULL
            AND target_profile.is_active = true
            AND hr_profile.is_active = true
        )
        AND EXISTS ( -- Must have valid employee consent
            SELECT 1 FROM public.sensitive_data_consent sdc
            WHERE sdc.user_id = profile_sensitive_data.user_id
            AND sdc.consented_by = auth.uid()
            AND sdc.revoked_at IS NULL
            AND sdc.expires_at > now()
            AND sdc.granted_at > (now() - INTERVAL '24 hours')
            AND sdc.purpose LIKE '%EMPLOYEE_APPROVED%'
            AND sdc.consent_type = 'hr_access'
        )
    );

-- SECURE POLICY 3: Super admin emergency access (extremely restricted)
CREATE POLICY "super_admin_emergency_only"
    ON public.profile_sensitive_data
    FOR SELECT
    TO authenticated
    USING (
        user_id != auth.uid() -- Not self-access
        AND is_super_admin(auth.uid()) -- Must be super admin
        AND EXISTS ( -- Must have active emergency session
            SELECT 1 FROM public.sensitive_data_access_sessions
            WHERE hr_user_id = auth.uid()
            AND target_user_id = profile_sensitive_data.user_id
            AND expires_at > now()
            AND revoked_at IS NULL
            AND purpose LIKE '%EMERGENCY%'
            AND created_at > (now() - INTERVAL '1 hour') -- Emergency sessions expire quickly
        )
    );

-- Create audit function for data modifications (INSERT, UPDATE, DELETE only)
CREATE OR REPLACE FUNCTION public.audit_sensitive_data_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log data modifications with full audit trail
    PERFORM public.log_pii_access(
        COALESCE(NEW.user_id, OLD.user_id),
        auth.uid(),
        'sensitive_data',
        'database_' || lower(TG_OP),
        ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
        'Sensitive data modification: ' || TG_OP,
        CASE WHEN auth.uid() != COALESCE(NEW.user_id, OLD.user_id) THEN true ELSE false END, -- consent required for non-self
        CASE WHEN auth.uid() != COALESCE(NEW.user_id, OLD.user_id) THEN 
            EXISTS (
                SELECT 1 FROM public.sensitive_data_consent 
                WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) 
                AND consented_by = auth.uid() 
                AND revoked_at IS NULL
                AND expires_at > now()
            )
        ELSE true END, -- consent given
        NULL, NULL, NULL,
        CASE 
            WHEN auth.uid() = COALESCE(NEW.user_id, OLD.user_id) THEN 10 -- self modification
            WHEN is_hr_admin(auth.uid()) THEN 60 -- HR modification
            WHEN is_super_admin(auth.uid()) THEN 80 -- admin modification
            ELSE 100 -- suspicious modification
        END,
        true,
        NULL,
        jsonb_build_object(
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'accessing_user_role', COALESCE(
                (SELECT role FROM public.profiles WHERE user_id = auth.uid()), 
                'unknown'
            ),
            'data_changed', CASE 
                WHEN TG_OP = 'INSERT' AND NEW IS NOT NULL THEN 
                    jsonb_build_object(
                        'phone_set', NEW.phone IS NOT NULL,
                        'address_set', NEW.personal_address IS NOT NULL,
                        'emergency_contact_set', NEW.emergency_contact IS NOT NULL,
                        'notes_set', NEW.sensitive_notes IS NOT NULL
                    )
                WHEN TG_OP = 'UPDATE' AND NEW IS NOT NULL AND OLD IS NOT NULL THEN
                    jsonb_build_object(
                        'phone_changed', OLD.phone IS DISTINCT FROM NEW.phone,
                        'address_changed', OLD.personal_address IS DISTINCT FROM NEW.personal_address,
                        'emergency_contact_changed', OLD.emergency_contact IS DISTINCT FROM NEW.emergency_contact,
                        'notes_changed', OLD.sensitive_notes IS DISTINCT FROM NEW.sensitive_notes
                    )
                WHEN TG_OP = 'DELETE' AND OLD IS NOT NULL THEN
                    jsonb_build_object('deleted', true)
                ELSE '{}'::jsonb
            END,
            'timestamp', now()
        )
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit trigger (INSERT, UPDATE, DELETE only - no SELECT)
DROP TRIGGER IF EXISTS audit_sensitive_data_modifications_trigger ON public.profile_sensitive_data;
CREATE TRIGGER audit_sensitive_data_modifications_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.profile_sensitive_data
    FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_data_modifications();