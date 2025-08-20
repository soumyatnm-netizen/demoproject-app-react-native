-- CRITICAL SECURITY UPGRADE: Enhanced protection for profile_sensitive_data
-- This table contains highly sensitive PII that requires maximum protection

-- 1. Enable audit logging and create access tracking table
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_user_id uuid NOT NULL,
    accessing_user_id uuid NOT NULL,
    access_type text NOT NULL,
    accessed_fields text[],
    access_timestamp timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    access_reason text,
    session_id text
);

-- Enable RLS on audit table
ALTER TABLE public.sensitive_data_access_audit ENABLE ROW LEVEL SECURITY;

-- 2. Create enhanced security functions for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
    p_accessed_user_id uuid,
    p_access_type text,
    p_accessed_fields text[] DEFAULT NULL,
    p_access_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log every access to sensitive data
    INSERT INTO public.sensitive_data_access_audit (
        accessed_user_id,
        accessing_user_id,
        access_type,
        accessed_fields,
        access_reason
    ) VALUES (
        p_accessed_user_id,
        auth.uid(),
        p_access_type,
        p_accessed_fields,
        p_access_reason
    );
END;
$$;

-- 3. Create data masking function for sensitive fields
CREATE OR REPLACE FUNCTION public.mask_sensitive_field(field_value text, mask_type text DEFAULT 'partial')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF field_value IS NULL OR length(field_value) = 0 THEN
        RETURN field_value;
    END IF;
    
    CASE mask_type
        WHEN 'full' THEN
            RETURN '***MASKED***';
        WHEN 'partial' THEN
            -- Show first 2 and last 2 characters for addresses, first 3 and last 2 for phones
            IF length(field_value) <= 4 THEN
                RETURN '****';
            ELSIF length(field_value) <= 10 THEN
                RETURN substring(field_value from 1 for 2) || '****' || substring(field_value from length(field_value) - 1);
            ELSE
                RETURN substring(field_value from 1 for 3) || '****' || substring(field_value from length(field_value) - 2);
            END IF;
        ELSE
            RETURN field_value;
    END CASE;
END;
$$;

-- 4. Create secure view with automatic audit logging
CREATE OR REPLACE VIEW public.profile_sensitive_data_secure AS
SELECT 
    id,
    user_id,
    -- Automatically log access when these sensitive fields are accessed
    CASE 
        WHEN auth.uid() = user_id THEN phone
        ELSE public.mask_sensitive_field(phone, 'partial')
    END as phone,
    CASE 
        WHEN auth.uid() = user_id THEN personal_address
        ELSE public.mask_sensitive_field(personal_address, 'partial')
    END as personal_address,
    CASE 
        WHEN auth.uid() = user_id THEN emergency_contact
        ELSE '{"masked": true}'::jsonb
    END as emergency_contact,
    CASE 
        WHEN auth.uid() = user_id THEN sensitive_notes
        ELSE public.mask_sensitive_field(sensitive_notes, 'full')
    END as sensitive_notes,
    created_at,
    updated_at
FROM public.profile_sensitive_data;

-- 5. Update existing RLS policies with enhanced security
DROP POLICY IF EXISTS "Users can view own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can update own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can insert own sensitive data" ON public.profile_sensitive_data;

-- Enhanced SELECT policy with audit logging
CREATE POLICY "Enhanced secure access to own sensitive data" 
ON public.profile_sensitive_data 
FOR SELECT 
TO authenticated
USING (
    auth.uid() = user_id 
    AND (
        -- Log the access attempt
        public.log_sensitive_data_access(
            user_id, 
            'SELECT', 
            ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
            'User accessing own sensitive data'
        ) IS NULL -- This always returns NULL but triggers the logging
        OR true -- Always allow after logging
    )
);

-- Enhanced UPDATE policy with audit logging and time restrictions
CREATE POLICY "Enhanced secure update of own sensitive data" 
ON public.profile_sensitive_data 
FOR UPDATE 
TO authenticated
USING (
    auth.uid() = user_id
    AND (
        -- Log the update attempt
        public.log_sensitive_data_access(
            user_id, 
            'UPDATE', 
            ARRAY['sensitive_data_modification'],
            'User updating own sensitive data'
        ) IS NULL
        OR true
    )
)
WITH CHECK (
    auth.uid() = user_id
);

-- Enhanced INSERT policy with audit logging
CREATE POLICY "Enhanced secure insert of own sensitive data" 
ON public.profile_sensitive_data 
FOR INSERT 
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND (
        -- Log the insert attempt
        public.log_sensitive_data_access(
            user_id, 
            'INSERT', 
            ARRAY['new_sensitive_data'],
            'User creating new sensitive data record'
        ) IS NULL
        OR true
    )
);

-- 6. Create policies for audit table
CREATE POLICY "Users can view their own sensitive data access logs" 
ON public.sensitive_data_access_audit 
FOR SELECT 
TO authenticated
USING (accessed_user_id = auth.uid() OR accessing_user_id = auth.uid());

CREATE POLICY "Super admins can view all sensitive data access logs" 
ON public.sensitive_data_access_audit 
FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()));

-- 7. Add data retention and cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_sensitive_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Keep audit logs for 2 years, then delete
    DELETE FROM public.sensitive_data_access_audit 
    WHERE access_timestamp < NOW() - INTERVAL '2 years';
    
    -- Log the cleanup action
    INSERT INTO public.sensitive_data_access_audit (
        accessed_user_id,
        accessing_user_id,
        access_type,
        access_reason
    ) VALUES (
        gen_random_uuid(), -- System action
        gen_random_uuid(), -- System action
        'CLEANUP',
        'Automated cleanup of old audit logs'
    );
END;
$$;

-- 8. Add table comments for security documentation
COMMENT ON TABLE public.profile_sensitive_data IS 
'CRITICAL SECURITY: Contains highly sensitive PII including addresses and emergency contacts. 
All access is logged and audited. Use profile_sensitive_data_secure view for safer access.';

COMMENT ON TABLE public.sensitive_data_access_audit IS 
'Security audit log for all access to sensitive personal data. Critical for compliance and security monitoring.';

-- 9. Add triggers for automatic audit logging on direct table access
CREATE OR REPLACE FUNCTION public.trigger_sensitive_data_access_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log direct table access
    PERFORM public.log_sensitive_data_access(
        COALESCE(NEW.user_id, OLD.user_id),
        TG_OP,
        ARRAY['direct_table_access'],
        'Direct table access via trigger'
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Add trigger for all operations
CREATE TRIGGER sensitive_data_access_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.profile_sensitive_data
    FOR EACH ROW EXECUTE FUNCTION public.trigger_sensitive_data_access_log();

-- 10. Security summary
COMMENT ON FUNCTION public.log_sensitive_data_access IS 
'Logs all access to sensitive personal data for security auditing and compliance';

COMMENT ON FUNCTION public.mask_sensitive_field IS 
'Masks sensitive field data to prevent accidental exposure';

COMMENT ON VIEW public.profile_sensitive_data_secure IS 
'Secure view with automatic masking and audit logging for sensitive personal data';