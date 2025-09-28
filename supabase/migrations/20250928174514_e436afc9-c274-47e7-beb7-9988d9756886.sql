-- Add check constraint for policy_type column (only if not already exists)
DO $$ 
BEGIN
    -- Add constraint if it doesn't already exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'placement_outcomes_policy_type_check'
    ) THEN
        ALTER TABLE public.placement_outcomes 
        ADD CONSTRAINT placement_outcomes_policy_type_check 
        CHECK (policy_type IN (
          'public_liability',
          'professional_indemnity', 
          'cyber',
          'employers_liability',
          'product_liability',
          'commercial_property',
          'business_interruption',
          'directors_officers',
          'workers_compensation',
          'commercial_auto',
          'trade_credit',
          'marine_cargo',
          'general_liability'
        ));
    END IF;

    -- Add index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_placement_outcomes_policy_type'
    ) THEN
        CREATE INDEX idx_placement_outcomes_policy_type ON public.placement_outcomes(policy_type);
    END IF;
END $$;