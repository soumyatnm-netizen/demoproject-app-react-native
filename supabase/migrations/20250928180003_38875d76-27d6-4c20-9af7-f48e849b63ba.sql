-- Add new policy types: tech and life_sciences
-- First, update the placement_policy_types table constraint
ALTER TABLE public.placement_policy_types 
DROP CONSTRAINT IF EXISTS placement_policy_types_policy_type_check;

ALTER TABLE public.placement_policy_types 
ADD CONSTRAINT placement_policy_types_policy_type_check 
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
    'general_liability',
    'tech',
    'life_sciences'
));

-- Update the placement_outcomes table constraint as well
ALTER TABLE public.placement_outcomes 
DROP CONSTRAINT IF EXISTS placement_outcomes_policy_type_check;

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
    'general_liability',
    'tech',
    'life_sciences'
));