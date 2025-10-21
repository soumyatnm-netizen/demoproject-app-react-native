-- Create policy wording cache table for storing analyzed document results
CREATE TABLE IF NOT EXISTS public.policy_wording_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_hash TEXT NOT NULL UNIQUE,
  insurer_name TEXT NOT NULL,
  policy_type TEXT,
  file_size_bytes BIGINT,
  page_count INTEGER,
  extracted_data JSONB NOT NULL,
  document_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  use_count INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_policy_wording_cache_hash ON public.policy_wording_cache(document_hash);
CREATE INDEX IF NOT EXISTS idx_policy_wording_cache_insurer ON public.policy_wording_cache(insurer_name);
CREATE INDEX IF NOT EXISTS idx_policy_wording_cache_last_used ON public.policy_wording_cache(last_used_at DESC);

-- Enable RLS
ALTER TABLE public.policy_wording_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all cached documents
CREATE POLICY "Users can read policy wording cache"
  ON public.policy_wording_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: System can insert/update cache
CREATE POLICY "System can manage policy wording cache"
  ON public.policy_wording_cache
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update cache usage statistics
CREATE OR REPLACE FUNCTION public.update_cache_usage(p_document_hash TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.policy_wording_cache
  SET 
    last_used_at = now(),
    use_count = use_count + 1
  WHERE document_hash = p_document_hash;
END;
$$;

-- Function to clean old cache entries (older than 6 months and not used recently)
CREATE OR REPLACE FUNCTION public.cleanup_old_policy_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.policy_wording_cache
  WHERE created_at < now() - interval '6 months'
  AND last_used_at < now() - interval '3 months'
  AND use_count < 5;
END;
$$;