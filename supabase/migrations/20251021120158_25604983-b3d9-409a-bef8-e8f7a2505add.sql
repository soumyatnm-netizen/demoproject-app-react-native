-- Function to generate a unique 6-character alphanumeric company code
CREATE OR REPLACE FUNCTION public.generate_unique_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    attempts INTEGER := 0;
BEGIN
    LOOP
        -- Generate a random 6-character alphanumeric code
        new_code := UPPER(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
        
        -- Check if code already exists
        SELECT EXISTS (
            SELECT 1 FROM broker_companies WHERE company_code = new_code
        ) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
        
        -- Prevent infinite loop
        attempts := attempts + 1;
        IF attempts > 100 THEN
            RAISE EXCEPTION 'Failed to generate unique company code after 100 attempts';
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$;

-- Trigger function to auto-generate company code on insert
CREATE OR REPLACE FUNCTION public.set_company_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only generate code if one wasn't provided
    IF NEW.company_code IS NULL THEN
        NEW.company_code := generate_unique_company_code();
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger on broker_companies table
DROP TRIGGER IF EXISTS trigger_set_company_code ON public.broker_companies;
CREATE TRIGGER trigger_set_company_code
    BEFORE INSERT ON public.broker_companies
    FOR EACH ROW
    EXECUTE FUNCTION set_company_code_on_insert();

-- Update any existing companies that don't have codes
UPDATE public.broker_companies
SET company_code = generate_unique_company_code()
WHERE company_code IS NULL;

COMMENT ON FUNCTION public.generate_unique_company_code() IS 'Generates a unique 6-character alphanumeric company code';
COMMENT ON FUNCTION public.set_company_code_on_insert() IS 'Trigger function to auto-generate company codes on company creation';
COMMENT ON TRIGGER trigger_set_company_code ON public.broker_companies IS 'Automatically generates company codes for new companies';