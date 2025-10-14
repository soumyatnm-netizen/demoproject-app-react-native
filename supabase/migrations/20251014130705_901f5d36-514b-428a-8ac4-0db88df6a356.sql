-- Add category field to underwriter_appetites table
ALTER TABLE public.underwriter_appetites 
ADD COLUMN IF NOT EXISTS coverage_category text 
CHECK (coverage_category IN ('tech-life-sciences', 'commercial-combined', 'cyber', 'other'));

-- Create index for better filtering performance
CREATE INDEX IF NOT EXISTS idx_underwriter_appetites_category 
ON public.underwriter_appetites(coverage_category);

-- Add comment
COMMENT ON COLUMN public.underwriter_appetites.coverage_category 
IS 'Insurance coverage category for filtering guides';