-- Assign CC_STAFF role to jamesanthony808@gmail.com
DO $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get the user ID for jamesanthony808@gmail.com
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'jamesanthony808@gmail.com';
    
    -- Check if user exists
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User with email jamesanthony808@gmail.com not found';
    ELSE
        -- Check if role already exists
        IF NOT EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = user_uuid AND role = 'CC_STAFF'
        ) THEN
            -- Insert CC_STAFF role
            INSERT INTO user_roles (user_id, role, org_id)
            VALUES (user_uuid, 'CC_STAFF', NULL);
            
            RAISE NOTICE 'CC_STAFF role successfully assigned to jamesanthony808@gmail.com';
        ELSE
            RAISE NOTICE 'User already has CC_STAFF role';
        END IF;
    END IF;
END $$;