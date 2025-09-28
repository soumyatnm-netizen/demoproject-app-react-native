-- Fix the generate_company_code function to work without pgcrypto extension
CREATE OR REPLACE FUNCTION public.generate_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    code TEXT;
    counter INTEGER := 0;
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    i INTEGER;
BEGIN
    LOOP
        -- Generate 6-character alphanumeric company code using random()
        code := '';
        FOR i IN 1..6 LOOP
            code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
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