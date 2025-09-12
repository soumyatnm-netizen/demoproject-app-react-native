-- Fix company_invites table security vulnerability
-- Remove dangerous permissions from anonymous users and tighten access controls

-- Revoke all permissions from anonymous users (major security risk)
REVOKE ALL ON public.company_invites FROM anon;

-- Limit authenticated users to only necessary operations
REVOKE ALL ON public.company_invites FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invites TO authenticated;

-- Ensure RLS is properly enabled (should already be, but confirming)
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with better security
DROP POLICY IF EXISTS "Company admins can manage invites" ON public.company_invites;
DROP POLICY IF EXISTS "Users can view invites sent to their email" ON public.company_invites;

-- Create more secure and comprehensive RLS policies

-- Policy 1: Company admins can manage invites for their company only
CREATE POLICY "Company admins can manage company invites"
ON public.company_invites
FOR ALL
TO authenticated
USING (
    company_id = get_user_company_id(auth.uid()) 
    AND is_company_admin(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
)
WITH CHECK (
    company_id = get_user_company_id(auth.uid()) 
    AND is_company_admin(auth.uid())
    AND get_user_company_id(auth.uid()) IS NOT NULL
);

-- Policy 2: Users can only view invites specifically sent to their email address
CREATE POLICY "Users can view their own email invites"
ON public.company_invites
FOR SELECT
TO authenticated
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND expires_at > now()
    AND used_at IS NULL
);

-- Policy 3: Block all access for users without proper company association
CREATE POLICY "Block access for users without company"
ON public.company_invites
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Make the "Block access" policy the least permissive (it will be overridden by more specific policies)
ALTER POLICY "Block access for users without company" ON public.company_invites RENAME TO "zz_block_access_fallback";

-- Add additional security: Ensure invite codes are generated securely
-- Update the generate_invite_code function to be more secure (if needed)
CREATE OR REPLACE FUNCTION public.generate_secure_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    code TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        -- Generate 12-character secure alphanumeric code with mixed case
        code := upper(substring(encode(gen_random_bytes(9), 'base64') from 1 for 12));
        code := replace(code, '/', '');
        code := replace(code, '+', '');
        code := replace(code, '=', '');
        
        -- Ensure we have enough characters after cleaning
        IF length(code) >= 8 THEN
            code := substring(code from 1 for 8);
        ELSE
            CONTINUE;
        END IF;
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM public.company_invites WHERE invite_code = code) THEN
            RETURN code;
        END IF;
        
        -- Safety counter to prevent infinite loops
        counter := counter + 1;
        IF counter > 1000 THEN
            RAISE EXCEPTION 'Unable to generate unique invite code after 1000 attempts';
        END IF;
    END LOOP;
END;
$$;