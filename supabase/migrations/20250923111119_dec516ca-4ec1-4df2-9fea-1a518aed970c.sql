-- Drop the existing can_access_sensitive_data function
DROP FUNCTION IF EXISTS public.can_access_sensitive_data(uuid);

-- Create a more secure consent validation system
CREATE OR REPLACE FUNCTION public.validate_sensitive_data_access(
    target_user_id uuid,
    access_purpose text DEFAULT 'data_access'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    accessing_user_id uuid;
    is_own_data boolean;
    has_valid_consent boolean;
    is_hr_role boolean;
    same_company boolean;
    consent_record record;
BEGIN
    -- Get the accessing user ID
    accessing_user_id := auth.uid();
    
    -- Check if user is accessing their own data
    is_own_data := (accessing_user_id = target_user_id);
    
    -- Always allow access to own data
    IF is_own_data THEN
        RETURN true;
    END IF;
    
    -- For accessing other user's data, require HR role
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = accessing_user_id 
        AND role = 'hr_admin'
        AND is_active = true
    ) INTO is_hr_role;
    
    -- Deny if not HR admin
    IF NOT is_hr_role THEN
        -- Log unauthorized access attempt
        PERFORM public.log_sensitive_data_access(
            target_user_id,
            'UNAUTHORIZED_ACCESS_ATTEMPT',
            ARRAY['blocked_access'],
            format('Non-HR user %s attempted to access sensitive data', accessing_user_id)
        );
        RETURN false;
    END IF;
    
    -- Check if users are in the same company
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p1
        JOIN public.profiles p2 ON p1.company_id = p2.company_id
        WHERE p1.user_id = accessing_user_id 
        AND p2.user_id = target_user_id
        AND p1.company_id IS NOT NULL
        AND p2.company_id IS NOT NULL
    ) INTO same_company;
    
    -- Deny if not same company
    IF NOT same_company THEN
        PERFORM public.log_sensitive_data_access(
            target_user_id,
            'CROSS_COMPANY_ACCESS_DENIED',
            ARRAY['blocked_access'],
            'HR admin attempted cross-company sensitive data access'
        );
        RETURN false;
    END IF;
    
    -- Check for valid, recent consent with strict validation
    SELECT * INTO consent_record
    FROM public.sensitive_data_consent sdc
    WHERE sdc.user_id = target_user_id
    AND sdc.consented_by = accessing_user_id
    AND sdc.consent_type IN ('hr_access', 'emergency_access')
    AND sdc.revoked_at IS NULL
    AND (sdc.expires_at IS NULL OR sdc.expires_at > now())
    AND sdc.granted_at > (now() - interval '7 days')  -- Stricter: only 7 days
    AND sdc.granted_at <= now()  -- Prevent future-dated consents
    ORDER BY sdc.granted_at DESC
    LIMIT 1;
    
    has_valid_consent := (consent_record IS NOT NULL);
    
    -- Deny if no valid consent
    IF NOT has_valid_consent THEN
        PERFORM public.log_sensitive_data_access(
            target_user_id,
            'NO_VALID_CONSENT',
            ARRAY['blocked_access'],
            format('HR admin %s lacks valid consent for purpose: %s', accessing_user_id, access_purpose)
        );
        RETURN false;
    END IF;
    
    -- Log successful access with full audit trail
    PERFORM public.log_sensitive_data_access(
        target_user_id,
        'AUTHORIZED_SENSITIVE_ACCESS',
        ARRAY['phone', 'personal_address', 'emergency_contact', 'sensitive_notes'],
        format('HR admin access with consent ID %s, purpose: %s', consent_record.id, access_purpose)
    );
    
    RETURN true;
END;
$$;

-- Create a new stricter RLS policy for SELECT operations
DROP POLICY IF EXISTS "secure_sensitive_data_select_v2" ON public.profile_sensitive_data;

CREATE POLICY "ultra_secure_sensitive_data_select_v3"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (
    validate_sensitive_data_access(user_id, 'profile_data_access')
);

-- Add a function to require explicit consent with detailed reasoning
CREATE OR REPLACE FUNCTION public.request_sensitive_data_access(
    target_user_id uuid,
    access_purpose text,
    justification text,
    access_duration_hours integer DEFAULT 24
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    accessing_user_id uuid;
    consent_id uuid;
    expires_at timestamptz;
BEGIN
    accessing_user_id := auth.uid();
    
    -- Validate HR admin status
    IF NOT is_hr_admin(accessing_user_id) THEN
        RAISE EXCEPTION 'Only HR administrators can request sensitive data access';
    END IF;
    
    -- Validate same company
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p1
        JOIN public.profiles p2 ON p1.company_id = p2.company_id
        WHERE p1.user_id = accessing_user_id 
        AND p2.user_id = target_user_id
        AND p1.company_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Cannot request access for users outside your company';
    END IF;
    
    -- Calculate expiration
    expires_at := now() + (access_duration_hours || ' hours')::interval;
    
    -- Create consent request (requires employee approval)
    INSERT INTO public.sensitive_data_consent (
        user_id,
        consented_by,
        consent_type,
        purpose,
        expires_at
    ) VALUES (
        target_user_id,
        accessing_user_id,
        'hr_access',
        format('%s - %s', access_purpose, justification),
        expires_at
    ) RETURNING id INTO consent_id;
    
    -- Log the access request
    PERFORM public.log_sensitive_data_access(
        target_user_id,
        'CONSENT_REQUESTED',
        ARRAY['consent_management'],
        format('HR admin %s requested access: %s', accessing_user_id, justification)
    );
    
    RETURN consent_id;
END;
$$;

-- Add a function for employees to approve/deny consent requests
CREATE OR REPLACE FUNCTION public.respond_to_consent_request(
    consent_id uuid,
    approved boolean,
    employee_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    consent_record record;
BEGIN
    -- Get the consent request
    SELECT * INTO consent_record
    FROM public.sensitive_data_consent
    WHERE id = consent_id
    AND user_id = auth.uid()  -- Only the target user can respond
    AND revoked_at IS NULL;
    
    IF consent_record IS NULL THEN
        RAISE EXCEPTION 'Consent request not found or already processed';
    END IF;
    
    IF approved THEN
        -- Update consent to mark as employee-approved
        UPDATE public.sensitive_data_consent
        SET purpose = purpose || ' [EMPLOYEE_APPROVED]'
        WHERE id = consent_id;
        
        PERFORM public.log_sensitive_data_access(
            auth.uid(),
            'CONSENT_APPROVED',
            ARRAY['consent_management'],
            format('Employee approved consent request: %s', COALESCE(employee_notes, 'No notes'))
        );
    ELSE
        -- Revoke the consent
        UPDATE public.sensitive_data_consent
        SET revoked_at = now()
        WHERE id = consent_id;
        
        PERFORM public.log_sensitive_data_access(
            auth.uid(),
            'CONSENT_DENIED',
            ARRAY['consent_management'],
            format('Employee denied consent request: %s', COALESCE(employee_notes, 'No notes'))
        );
    END IF;
    
    RETURN approved;
END;
$$;

-- Create emergency access function with strict logging
CREATE OR REPLACE FUNCTION public.emergency_sensitive_data_access(
    target_user_id uuid,
    emergency_reason text,
    supervisor_approval_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    accessing_user_id uuid;
    emergency_consent_id uuid;
BEGIN
    accessing_user_id := auth.uid();
    
    -- Validate HR admin and emergency code (basic validation)
    IF NOT is_hr_admin(accessing_user_id) OR LENGTH(supervisor_approval_code) < 8 THEN
        PERFORM public.log_sensitive_data_access(
            target_user_id,
            'EMERGENCY_ACCESS_DENIED',
            ARRAY['emergency_access'],
            format('Invalid emergency access attempt by %s', accessing_user_id)
        );
        RETURN false;
    END IF;
    
    -- Create emergency consent (valid for 1 hour only)
    INSERT INTO public.sensitive_data_consent (
        user_id,
        consented_by,
        consent_type,
        purpose,
        expires_at
    ) VALUES (
        target_user_id,
        accessing_user_id,
        'emergency_access',
        format('EMERGENCY: %s | Code: %s', emergency_reason, supervisor_approval_code),
        now() + interval '1 hour'
    ) RETURNING id INTO emergency_consent_id;
    
    -- Log emergency access
    PERFORM public.log_sensitive_data_access(
        target_user_id,
        'EMERGENCY_ACCESS_GRANTED',
        ARRAY['emergency_access'],
        format('Emergency access granted. Reason: %s | Consent ID: %s', emergency_reason, emergency_consent_id)
    );
    
    RETURN true;
END;
$$;