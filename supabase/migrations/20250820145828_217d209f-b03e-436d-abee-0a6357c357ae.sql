-- Create broker companies and user profiles system with invite functionality

-- 1. Create app roles enum
CREATE TYPE public.app_role AS ENUM ('company_admin', 'broker', 'viewer');

-- 2. Create broker companies table
CREATE TABLE public.broker_companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT, -- Optional: company email domain for auto-verification
    website TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'United Kingdom',
    logo_url TEXT,
    subscription_tier TEXT DEFAULT 'basic',
    max_users INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Update profiles table to link to companies and add role system
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.broker_companies(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN role public.app_role DEFAULT 'broker';
ALTER TABLE public.profiles ADD COLUMN first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN job_title TEXT;
ALTER TABLE public.profiles ADD COLUMN phone TEXT;
ALTER TABLE public.profiles ADD COLUMN department TEXT;
ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN invited_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE;

-- 4. Create company invites table
CREATE TABLE public.company_invites (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.broker_companies(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.app_role DEFAULT 'broker',
    invite_code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_pending_invite UNIQUE (company_id, email)
);

-- 5. Enable RLS on all tables
ALTER TABLE public.broker_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- 6. Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT company_id FROM public.profiles WHERE user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.profiles WHERE user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = $1 AND role = 'company_admin'
    );
$$;

-- 7. RLS Policies for broker_companies
CREATE POLICY "Users can view their own company" 
ON public.broker_companies 
FOR SELECT 
USING (id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company admins can update their company" 
ON public.broker_companies 
FOR UPDATE 
USING (
    id = public.get_user_company_id(auth.uid()) 
    AND public.is_company_admin(auth.uid())
);

CREATE POLICY "Anyone can create a company" 
ON public.broker_companies 
FOR INSERT 
WITH CHECK (true); -- Will be restricted by application logic

-- 8. RLS Policies for company_invites
CREATE POLICY "Company admins can manage invites" 
ON public.company_invites 
FOR ALL 
USING (
    company_id = public.get_user_company_id(auth.uid()) 
    AND public.is_company_admin(auth.uid())
);

CREATE POLICY "Users can view invites sent to their email" 
ON public.company_invites 
FOR SELECT 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 9. Update profiles RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their company" 
ON public.profiles 
FOR SELECT 
USING (
    user_id = auth.uid() 
    OR company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Company admins can update team profiles" 
ON public.profiles 
FOR UPDATE 
USING (
    company_id = public.get_user_company_id(auth.uid()) 
    AND public.is_company_admin(auth.uid())
);

-- 10. Function to generate unique invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
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

-- 11. Trigger for updated_at timestamps
CREATE TRIGGER update_broker_companies_updated_at
BEFORE UPDATE ON public.broker_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Create indexes for performance
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_company_invites_code ON public.company_invites(invite_code);
CREATE INDEX idx_company_invites_email ON public.company_invites(email);
CREATE INDEX idx_company_invites_company_id ON public.company_invites(company_id);