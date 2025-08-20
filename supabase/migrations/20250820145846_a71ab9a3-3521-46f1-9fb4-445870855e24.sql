-- Fix function search path security issues

-- Update security definer functions with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT company_id FROM public.profiles WHERE user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = $1 AND role = 'company_admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    code TEXT;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM public.company_invites WHERE invite_code = code) THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$;