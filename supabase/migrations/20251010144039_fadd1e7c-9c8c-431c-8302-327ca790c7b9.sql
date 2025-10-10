-- Create table for policy wording analysis
CREATE TABLE IF NOT EXISTS public.policy_wordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Document Metadata
  insurer_name TEXT NOT NULL,
  policy_version TEXT,
  policy_date DATE,
  insured_name TEXT,
  policy_period TEXT,
  jurisdiction TEXT,
  
  -- Core Insurance Sections (structured as JSONB)
  coverage_sections JSONB DEFAULT '{}',
  
  -- Key Variables for Comparison
  key_variables JSONB DEFAULT '{}',
  
  -- Specialist Emerging Risks
  emerging_risks JSONB DEFAULT '{}',
  
  -- Services & Add-Ons
  services JSONB DEFAULT '{}',
  
  -- Plain Language Summaries
  plain_language_summary JSONB DEFAULT '{}',
  
  -- Processing status
  status TEXT DEFAULT 'processing',
  processing_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.policy_wordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own policy wordings"
  ON public.policy_wordings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own policy wordings"
  ON public.policy_wordings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own policy wordings"
  ON public.policy_wordings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own policy wordings"
  ON public.policy_wordings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_policy_wordings_updated_at
  BEFORE UPDATE ON public.policy_wordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();