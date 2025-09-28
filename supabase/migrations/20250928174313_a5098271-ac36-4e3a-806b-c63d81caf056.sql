-- Add policy_type column to track different types of insurance policies
ALTER TABLE public.placement_outcomes 
ADD COLUMN policy_type text CHECK (policy_type IN (
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

-- Create index for better query performance on policy type
CREATE INDEX idx_placement_outcomes_policy_type ON public.placement_outcomes(policy_type);