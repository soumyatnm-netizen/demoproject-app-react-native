-- Fix critical security vulnerability in profile_sensitive_data access
-- Simplify and strengthen consent validation to prevent unauthorized access

-- 1. Drop existing complex policies that may have loopholes
DROP POLICY IF EXISTS "HR admin with explicit consent access" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users own sensitive data access only" ON public.profile_sensitive_data;

-- 2. Create improved security definer functions for sensitive data access
CREATE OR REPLACE FUNCTION public.can_access_sensitive_data(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    -- Users can always access their own data
    WHEN auth.uid() = target_user_id THEN true
    -- HR admins need explicit, recent, valid consent
    WHEN is_hr_admin(auth.uid()) THEN (
      SELECT EXISTS (
        SELECT 1 
        FROM public.sensitive_data_consent sdc
        JOIN public.profiles p ON p.user_id = target_user_id
        WHERE sdc.user_id = target_user_id
        AND sdc.consented_by = auth.uid()
        AND sdc.consent_type IN ('hr_access', 'emergency_access')
        AND sdc.revoked_at IS NULL
        AND (sdc.expires_at IS NULL OR sdc.expires_at > now())
        AND sdc.granted_at > (now() - interval '30 days')  -- Consent must be recent
        AND p.company_id = get_user_company_id(auth.uid())
        AND p.company_id IS NOT NULL  -- Both users must be in same company
      )
    )
    ELSE false
  END;
$$;

-- 3. Create new secure policies for sensitive data access
CREATE POLICY "secure_sensitive_data_select_v2"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (
  public.can_access_sensitive_data(user_id)
);

CREATE POLICY "secure_sensitive_data_insert_v2"
ON public.profile_sensitive_data
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()  -- Users can only create their own sensitive data
);

CREATE POLICY "secure_sensitive_data_update_v2"
ON public.profile_sensitive_data
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()  -- Only users can update their own sensitive data
)
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "secure_sensitive_data_delete_v2"
ON public.profile_sensitive_data
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()  -- Only users can delete their own sensitive data
);

-- 4. Create audit trigger for sensitive data access
CREATE OR REPLACE FUNCTION public.audit_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log all sensitive data access when not accessing own data
  IF auth.uid() != COALESCE(NEW.user_id, OLD.user_id) THEN
    PERFORM public.log_sensitive_data_access(
      COALESCE(NEW.user_id, OLD.user_id),
      TG_OP,
      ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
      CASE 
        WHEN TG_OP = 'SELECT' THEN 'HR admin accessed employee sensitive data'
        WHEN TG_OP = 'INSERT' THEN 'HR admin created employee sensitive data'
        WHEN TG_OP = 'UPDATE' THEN 'HR admin updated employee sensitive data'
        WHEN TG_OP = 'DELETE' THEN 'HR admin deleted employee sensitive data'
        ELSE 'HR admin performed operation on employee sensitive data'
      END
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 5. Add audit trigger to profile_sensitive_data table
DROP TRIGGER IF EXISTS audit_sensitive_data_access_trigger ON public.profile_sensitive_data;
CREATE TRIGGER audit_sensitive_data_access_trigger
  AFTER SELECT OR INSERT OR UPDATE OR DELETE
  ON public.profile_sensitive_data
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_sensitive_data_access();

-- 6. Improve consent management - add validation for consent records  
CREATE OR REPLACE FUNCTION public.validate_consent_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure consented_by user is actually an HR admin in the same company
  IF NOT (
    is_hr_admin(NEW.consented_by) 
    AND get_user_company_id(NEW.user_id) = get_user_company_id(NEW.consented_by)
    AND get_user_company_id(NEW.user_id) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Invalid consent: consented_by must be HR admin in same company';
  END IF;
  
  -- Log consent creation
  PERFORM public.log_sensitive_data_access(
    NEW.user_id,
    'CONSENT_GRANTED',
    ARRAY['consent_management'],
    format('HR admin %s granted %s consent', NEW.consented_by, NEW.consent_type)
  );
  
  RETURN NEW;
END;
$function$;

-- 7. Add validation trigger for consent
DROP TRIGGER IF EXISTS validate_consent_trigger ON public.sensitive_data_consent;
CREATE TRIGGER validate_consent_trigger
  BEFORE INSERT OR UPDATE
  ON public.sensitive_data_consent
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_consent_request();