-- Assign CC_STAFF role to dan@covercompass.co.uk
DO $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get the user ID for dan@covercompass.co.uk
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'dan@covercompass.co.uk';
    
    -- Check if user exists
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'User with email dan@covercompass.co.uk not found';
    ELSE
        -- Check if role already exists
        IF NOT EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = user_uuid AND role = 'CC_STAFF'
        ) THEN
            -- Insert CC_STAFF role
            INSERT INTO user_roles (user_id, role, org_id)
            VALUES (user_uuid, 'CC_STAFF', NULL);
            
            RAISE NOTICE 'CC_STAFF role assigned to dan@covercompass.co.uk';
        ELSE
            RAISE NOTICE 'User already has CC_STAFF role';
        END IF;
    END IF;
END $$;