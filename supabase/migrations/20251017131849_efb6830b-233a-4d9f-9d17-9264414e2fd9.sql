-- Create table to store insurer matching results
CREATE TABLE public.insurer_matching_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_report_id UUID NOT NULL,
  matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.insurer_matching_cache ENABLE ROW LEVEL SECURITY;

-- Users can view their own cached matches
CREATE POLICY "Users can view their own insurer matches"
ON public.insurer_matching_cache
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own cached matches
CREATE POLICY "Users can insert their own insurer matches"
ON public.insurer_matching_cache
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own cached matches
CREATE POLICY "Users can update their own insurer matches"
ON public.insurer_matching_cache
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own cached matches
CREATE POLICY "Users can delete their own insurer matches"
ON public.insurer_matching_cache
FOR DELETE
USING (auth.uid() = user_id);

-- Deny anonymous access
CREATE POLICY "deny_anonymous_insurer_matching"
ON public.insurer_matching_cache
FOR ALL
USING (false);

-- Add updated_at trigger
CREATE TRIGGER update_insurer_matching_cache_updated_at
BEFORE UPDATE ON public.insurer_matching_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_insurer_matching_cache_user_client 
ON public.insurer_matching_cache(user_id, client_report_id);