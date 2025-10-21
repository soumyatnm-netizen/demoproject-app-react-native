-- Fix the validate_company_code function to not log operations
-- since this is a public lookup without a user context
CREATE OR REPLACE FUNCTION public.validate_company_code(p_code text)
RETURNS TABLE(is_valid boolean, company_id uuid, company_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;