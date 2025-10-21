-- Fix the existing user kathrynlaurahill@hotmail.co.uk to be properly assigned to TestBroker2
UPDATE profiles
SET company_id = '0af72b26-1e11-4747-b57c-a6f1294b0014'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'kathrynlaurahill@hotmail.co.uk'
)
AND company_id IS NULL;