-- Create audit tables with proper structure (Fixed Parameter Order)
CREATE TABLE IF NOT EXISTS public.file_access_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    file_id UUID,
    file_path TEXT,
    action_type TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.file_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own file audit logs"
    ON public.file_access_audit FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "System can insert file audit logs"
    ON public.file_access_audit FOR INSERT
    WITH CHECK (true);

-- Create PII audit table
CREATE TABLE IF NOT EXISTS public.pii_access_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_user_id UUID NOT NULL,
    accessing_user_id UUID NOT NULL,
    data_type TEXT NOT NULL,
    access_method TEXT NOT NULL,
    fields_accessed TEXT[],
    purpose TEXT,
    consent_required BOOLEAN DEFAULT false,
    consent_given BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    risk_score INTEGER DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    blocked_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pii_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own PII access logs"
    ON public.pii_access_audit FOR SELECT
    USING (accessed_user_id = auth.uid() OR accessing_user_id = auth.uid());

CREATE POLICY "System can insert PII audit logs"
    ON public.pii_access_audit FOR INSERT
    WITH CHECK (true);

-- Fixed function with proper parameter ordering
CREATE OR REPLACE FUNCTION public.log_file_access(
    p_user_id UUID,
    p_action_type TEXT,
    p_file_id UUID DEFAULT NULL,
    p_file_path TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.file_access_audit (
        user_id, action_type, file_id, file_path, ip_address,
        user_agent, success, error_message, metadata
    ) VALUES (
        p_user_id, p_action_type, p_file_id, p_file_path, p_ip_address,
        p_user_agent, p_success, p_error_message, p_metadata
    );
END;
$$;

-- Fixed PII logging function
CREATE OR REPLACE FUNCTION public.log_pii_access(
    p_accessed_user_id UUID,
    p_accessing_user_id UUID,
    p_data_type TEXT,
    p_access_method TEXT,
    p_fields_accessed TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_purpose TEXT DEFAULT NULL,
    p_consent_required BOOLEAN DEFAULT false,
    p_consent_given BOOLEAN DEFAULT false,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_risk_score INTEGER DEFAULT 0,
    p_success BOOLEAN DEFAULT true,
    p_blocked_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.pii_access_audit (
        accessed_user_id, accessing_user_id, data_type, access_method,
        fields_accessed, purpose, consent_required, consent_given,
        ip_address, user_agent, session_id, risk_score, success,
        blocked_reason, metadata
    ) VALUES (
        p_accessed_user_id, p_accessing_user_id, p_data_type, p_access_method,
        p_fields_accessed, p_purpose, p_consent_required, p_consent_given,
        p_ip_address, p_user_agent, p_session_id, p_risk_score, p_success,
        p_blocked_reason, p_metadata
    );
END;
$$;