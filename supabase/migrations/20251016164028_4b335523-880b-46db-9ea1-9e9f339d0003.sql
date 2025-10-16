-- Add subjectivities column to structured_quotes table
ALTER TABLE public.structured_quotes 
ADD COLUMN IF NOT EXISTS subjectivities text[] DEFAULT ARRAY[]::text[];

-- Add comment explaining the column
COMMENT ON COLUMN public.structured_quotes.subjectivities IS 'Pre-binding conditions that must be satisfied (e.g., subject to survey, subject to confirmation of turnover)';