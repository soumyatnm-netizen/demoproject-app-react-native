-- Fix the foreign key constraint on company_invites.invited_by
-- The constraint is preventing inserts, so we'll drop and recreate it with proper ON DELETE CASCADE

DO $$
BEGIN
  -- Drop the existing foreign key if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'company_invites_invited_by_fkey'
    AND table_name = 'company_invites'
  ) THEN
    ALTER TABLE public.company_invites 
    DROP CONSTRAINT company_invites_invited_by_fkey;
  END IF;

  -- Recreate the foreign key with proper cascade
  ALTER TABLE public.company_invites
  ADD CONSTRAINT company_invites_invited_by_fkey 
  FOREIGN KEY (invited_by) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
END $$;
