-- Add business_type column to track new business vs existing client
ALTER TABLE public.placement_outcomes 
ADD COLUMN business_type text CHECK (business_type IN ('new_business', 'existing_client'));

-- Create index for better query performance on business type
CREATE INDEX idx_placement_outcomes_business_type ON public.placement_outcomes(business_type);

-- Update existing records to have a default business type (optional)
-- You can uncomment this if you want to set existing records to a default value
-- UPDATE public.placement_outcomes SET business_type = 'existing_client' WHERE business_type IS NULL;