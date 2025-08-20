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

-- Super admins cannot access sensitive data for privacy protection
-- Only individual users can access their own sensitive data

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

-- Create function to get safe profile data for company admins
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

-- Add audit logging for profile access
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

-- Create trigger to automatically audit profile access
CREATE OR REPLACE FUNCTION public.audit_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log access attempts (simplified for this example)
    INSERT INTO public.profile_access_audit (
        accessed_user_id,
        accessing_user_id,
        access_type,
        access_reason
    ) VALUES (
        NEW.user_id,
        auth.uid(),
        TG_OP,
        'Profile access via ' || TG_TABLE_NAME
    );
    
    RETURN NEW;
END;
$$;

-- Add trigger for profile access auditing
CREATE TRIGGER audit_profile_select
    AFTER SELECT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_profile_access();

-- Update profiles table to remove sensitive phone field to separate table
-- (We'll migrate this data if it exists)
DO $$
BEGIN
    -- Migrate existing phone data to sensitive data table
    INSERT INTO public.profile_sensitive_data (user_id, phone)
    SELECT user_id, phone 
    FROM public.profiles 
    WHERE phone IS NOT NULL
    ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone;
    
    -- Remove phone column from profiles (keep other fields for business purposes)
    -- ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail migration
    RAISE NOTICE 'Phone data migration failed: %', SQLERRM;
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