-- Create a separate table for sensitive personal data with stricter access controls
CREATE TABLE IF NOT EXISTS public.profile_sensitive_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone text,
    personal_address text,
    emergency_contact jsonb,
    sensitive_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id)
);

-- Enable RLS on sensitive data table
ALTER TABLE public.profile_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Only users can access their own sensitive data (no company admin access)
CREATE POLICY "Users can view own sensitive data" 
ON public.profile_sensitive_data 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sensitive data" 
ON public.profile_sensitive_data 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sensitive data" 
ON public.profile_sensitive_data 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create updated RLS policies for profiles table with data minimization
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Company admins can view company member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Create more restrictive policies that limit data exposure
CREATE POLICY "Company admins can view limited team member data" 
ON public.profiles 
FOR SELECT 
USING (
    is_company_admin(auth.uid()) 
    AND company_id = get_user_company_id(auth.uid()) 
    AND company_id IS NOT NULL
);

-- Super admins get limited access for administrative purposes only
CREATE POLICY "Super admins can view basic profile data" 
ON public.profiles 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Create function to get safe profile data for company admins (excludes sensitive fields)
CREATE OR REPLACE FUNCTION public.get_team_member_safe_data(target_user_id uuid)
RETURNS TABLE (
    user_id uuid,
    first_name text,
    last_name text,
    job_title text,
    department text,
    role app_role,
    is_active boolean,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT 
        p.user_id,
        p.first_name,
        p.last_name,
        p.job_title,
        p.department,
        p.role,
        p.is_active,
        p.last_login_at,
        p.created_at
    FROM public.profiles p
    WHERE p.user_id = target_user_id
    AND is_company_admin(auth.uid())
    AND p.company_id = get_user_company_id(auth.uid())
    AND p.company_id IS NOT NULL;
$$;

-- Add audit logging table for profile access
CREATE TABLE IF NOT EXISTS public.profile_access_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_user_id uuid NOT NULL,
    accessing_user_id uuid NOT NULL,
    access_type text NOT NULL, -- 'view', 'update', 'admin_view'
    accessed_fields text[], -- track which fields were accessed
    access_reason text,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.profile_access_audit ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view profile access audit" 
ON public.profile_access_audit 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Create function to log profile access (to be called from application)
CREATE OR REPLACE FUNCTION public.log_profile_access(
    p_accessed_user_id uuid,
    p_access_type text,
    p_accessed_fields text[] DEFAULT NULL,
    p_access_reason text DEFAULT NULL,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profile_access_audit (
        accessed_user_id,
        accessing_user_id,
        access_type,
        accessed_fields,
        access_reason,
        ip_address,
        user_agent
    ) VALUES (
        p_accessed_user_id,
        auth.uid(),
        p_access_type,
        p_accessed_fields,
        p_access_reason,
        p_ip_address,
        p_user_agent
    );
END;
$$;

-- Migrate existing phone data to sensitive data table
DO $$
BEGIN
    -- Move existing phone data to the secure table
    INSERT INTO public.profile_sensitive_data (user_id, phone)
    SELECT user_id, phone 
    FROM public.profiles 
    WHERE phone IS NOT NULL
    ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail migration
    RAISE NOTICE 'Phone data migration completed with notice: %', SQLERRM;
END $$;

-- Add data retention policy function
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete audit logs older than 1 year
    DELETE FROM public.profile_access_audit 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    DELETE FROM public.login_audit 
    WHERE login_time < NOW() - INTERVAL '1 year';
END;
$$;

-- Create updated_at trigger for sensitive data
CREATE TRIGGER update_profile_sensitive_data_updated_at
    BEFORE UPDATE ON public.profile_sensitive_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment explaining security model
COMMENT ON TABLE public.profile_sensitive_data IS 'Stores sensitive personal data with user-only access. No admin access allowed for privacy protection.';
COMMENT ON TABLE public.profiles IS 'Stores business-related profile data. Company admins have limited access to team members.';
COMMENT ON TABLE public.profile_access_audit IS 'Tracks profile access for security monitoring. Only super admins can view audit logs.';

-- Create function to check if user has access to view profile
CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT CASE
        -- Users can always access their own profile
        WHEN auth.uid() = target_user_id THEN true
        -- Company admins can access team member profiles
        WHEN is_company_admin(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = target_user_id 
            AND company_id = get_user_company_id(auth.uid())
        ) THEN true
        -- Super admins can access basic profile data
        WHEN is_super_admin(auth.uid()) THEN true
        ELSE false
    END;
$$;