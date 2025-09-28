-- Fix the existing jayduffy88@gmail.com admin account
DO $$
DECLARE
    user_uuid UUID;
    company_uuid UUID;
BEGIN
    -- Get the user ID for jayduffy88@gmail.com
    SELECT id INTO user_uuid FROM auth.users WHERE email = 'jayduffy88@gmail.com';
    
    IF user_uuid IS NOT NULL THEN
        -- Create the company first
        INSERT INTO public.broker_companies (name, domain)
        VALUES ('Duffy Insurance Company', 'duffy-insurance.com')
        RETURNING id INTO company_uuid;
        
        -- Update the user's profile to be company admin
        UPDATE public.profiles 
        SET 
            company_id = company_uuid,
            role = 'company_admin',
            first_name = 'Jay',
            last_name = 'Duffy',
            job_title = 'Managing Director',
            company_name = 'Duffy Insurance Company'
        WHERE user_id = user_uuid;
        
        RAISE NOTICE 'Successfully fixed admin account for jayduffy88@gmail.com';
    ELSE
        RAISE NOTICE 'User jayduffy88@gmail.com not found';
    END IF;
END $$;