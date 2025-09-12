-- Step 1: Add HR role to app_role enum
-- This must be committed before it can be used in functions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hr_admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
        ALTER TYPE public.app_role ADD VALUE 'hr_admin';
    END IF;
END $$;

-- Log the enum addition
INSERT INTO public.profile_access_audit (
    accessed_user_id,
    accessing_user_id,
    access_type,
    access_reason
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    'SECURITY_PREPARATION',
    'Added HR admin role to app_role enum for enhanced sensitive data access controls'
);