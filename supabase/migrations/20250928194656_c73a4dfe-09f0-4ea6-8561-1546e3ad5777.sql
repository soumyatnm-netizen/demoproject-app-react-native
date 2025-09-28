-- Add company_code to broker_companies table for reusable company codes
ALTER TABLE public.broker_companies 
ADD COLUMN company_code TEXT UNIQUE,
ADD COLUMN company_code_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 year');

-- Create function to generate unique company codes
CREATE OR REPLACE FUNCTION public.generate_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    code TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        -- Generate 6-character alphanumeric company code
        code := upper(substring(encode(gen_random_bytes(5), 'base64') from 1 for 6));
        code := replace(code, '/', '');
        code := replace(code, '+', '');
        code := replace(code, '=', '');
        
        -- Ensure we have enough characters after cleaning
        IF length(code) >= 6 THEN
            code := substring(code from 1 for 6);
        ELSE
            CONTINUE;
        END IF;
        
        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM public.broker_companies WHERE company_code = code) THEN
            RETURN code;
        END IF;
        
        -- Safety counter to prevent infinite loops
        counter := counter + 1;
        IF counter > 1000 THEN
            RAISE EXCEPTION 'Unable to generate unique company code after 1000 attempts';
        END IF;
    END LOOP;
END;
$$;

-- Create function to validate company codes during signup
CREATE OR REPLACE FUNCTION public.validate_company_code(p_code TEXT)
RETURNS TABLE(is_valid BOOLEAN, company_id UUID, company_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (bc.id IS NOT NULL AND (bc.company_code_expires_at IS NULL OR bc.company_code_expires_at > now())) as is_valid,
        bc.id as company_id,
        bc.name as company_name
    FROM public.broker_companies bc
    WHERE bc.company_code = upper(trim(p_code))
    AND bc.company_code IS NOT NULL;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT;
    END IF;
END;
$$;