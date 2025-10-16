-- Enhance underwriter_appetite_data table for comprehensive appetite matching
-- Add missing fields for the appetite matching system

-- Add new columns for detailed appetite criteria
ALTER TABLE public.underwriter_appetite_data
ADD COLUMN IF NOT EXISTS coverage_amount_min NUMERIC,
ADD COLUMN IF NOT EXISTS coverage_amount_max NUMERIC,
ADD COLUMN IF NOT EXISTS jurisdictions TEXT[],
ADD COLUMN IF NOT EXISTS revenue_range_min NUMERIC,
ADD COLUMN IF NOT EXISTS revenue_range_max NUMERIC,
ADD COLUMN IF NOT EXISTS employee_range_min INTEGER,
ADD COLUMN IF NOT EXISTS employee_range_max INTEGER,
ADD COLUMN IF NOT EXISTS security_requirements TEXT[],
ADD COLUMN IF NOT EXISTS industry_classes TEXT[],
ADD COLUMN IF NOT EXISTS segments TEXT[],
ADD COLUMN IF NOT EXISTS placement_notes TEXT,
ADD COLUMN IF NOT EXISTS minimum_premium NUMERIC,
ADD COLUMN IF NOT EXISTS distribution_type TEXT,
ADD COLUMN IF NOT EXISTS product_type TEXT;

-- Create appetite_match_results table to store matching outcomes
CREATE TABLE IF NOT EXISTS public.appetite_match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_document_id UUID REFERENCES public.structured_quotes(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES public.underwriter_appetites(id),
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  coverage_fit TEXT,
  jurisdiction_fit BOOLEAN,
  industry_fit TEXT,
  capacity_fit_diff NUMERIC,
  exclusions_hit TEXT[],
  primary_reasons TEXT[],
  explanation TEXT,
  score_breakdown JSONB,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on appetite_match_results
ALTER TABLE public.appetite_match_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view matches for their own documents
CREATE POLICY "Users can view their own appetite matches"
ON public.appetite_match_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.structured_quotes sq
    WHERE sq.id = appetite_match_results.client_document_id
    AND sq.user_id = auth.uid()
  )
);

-- Policy: System can insert match results
CREATE POLICY "System can insert appetite match results"
ON public.appetite_match_results
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.structured_quotes sq
    WHERE sq.id = appetite_match_results.client_document_id
    AND sq.user_id = auth.uid()
  )
);

-- Create index for faster matching queries
CREATE INDEX IF NOT EXISTS idx_appetite_data_product ON public.underwriter_appetite_data(product_type);
CREATE INDEX IF NOT EXISTS idx_appetite_data_jurisdictions ON public.underwriter_appetite_data USING GIN(jurisdictions);
CREATE INDEX IF NOT EXISTS idx_appetite_match_results_client ON public.appetite_match_results(client_document_id);
CREATE INDEX IF NOT EXISTS idx_appetite_match_results_score ON public.appetite_match_results(confidence_score DESC);