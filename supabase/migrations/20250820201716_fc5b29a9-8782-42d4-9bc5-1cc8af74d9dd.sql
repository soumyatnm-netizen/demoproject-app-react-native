-- Create table to store underwriter matching results
CREATE TABLE IF NOT EXISTS public.underwriter_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES public.structured_quotes(id) ON DELETE CASCADE,
    appetite_document_id uuid NOT NULL REFERENCES public.underwriter_appetites(id) ON DELETE CASCADE,
    underwriter_name text NOT NULL,
    match_score numeric NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    match_rank integer NOT NULL CHECK (match_rank > 0),
    match_reasoning jsonb NOT NULL,
    compatibility_factors jsonb,
    risk_assessment text,
    recommended_premium_range jsonb,
    coverage_gaps jsonb,
    competitive_advantages text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(document_id, appetite_document_id)
);

-- Enable RLS
ALTER TABLE public.underwriter_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies for underwriter matches
CREATE POLICY "Users can view their own underwriter matches"
ON public.underwriter_matches
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.structured_quotes sq
        WHERE sq.id = underwriter_matches.document_id
        AND sq.user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their own underwriter matches"
ON public.underwriter_matches
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.structured_quotes sq
        WHERE sq.id = underwriter_matches.document_id
        AND sq.user_id = auth.uid()
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_underwriter_matches_document_id ON public.underwriter_matches(document_id);
CREATE INDEX IF NOT EXISTS idx_underwriter_matches_score ON public.underwriter_matches(document_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_underwriter_matches_rank ON public.underwriter_matches(document_id, match_rank);

-- Add trigger for updated_at
CREATE TRIGGER update_underwriter_matches_updated_at
    BEFORE UPDATE ON public.underwriter_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get best matches for a document
CREATE OR REPLACE FUNCTION public.get_best_underwriter_matches(p_document_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE (
    id uuid,
    appetite_document_id uuid,
    underwriter_name text,
    match_score numeric,
    match_rank integer,
    match_reasoning jsonb,
    compatibility_factors jsonb,
    risk_assessment text,
    recommended_premium_range jsonb,
    coverage_gaps jsonb,
    competitive_advantages text[],
    logo_url text,
    financial_ratings jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT 
        um.id,
        um.appetite_document_id,
        um.underwriter_name,
        um.match_score,
        um.match_rank,
        um.match_reasoning,
        um.compatibility_factors,
        um.risk_assessment,
        um.recommended_premium_range,
        um.coverage_gaps,
        um.competitive_advantages,
        uad.logo_url,
        uad.financial_ratings
    FROM public.underwriter_matches um
    LEFT JOIN public.underwriter_appetite_data uad ON um.appetite_document_id = uad.appetite_document_id
    WHERE um.document_id = p_document_id
    AND EXISTS (
        SELECT 1 FROM public.structured_quotes sq
        WHERE sq.id = p_document_id
        AND sq.user_id = auth.uid()
    )
    ORDER BY um.match_rank ASC, um.match_score DESC
    LIMIT p_limit;
$$;

-- Create function to trigger matching analysis
CREATE OR REPLACE FUNCTION public.trigger_underwriter_matching(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the user_id for the document
    SELECT user_id INTO v_user_id
    FROM public.structured_quotes
    WHERE id = p_document_id;
    
    -- Only allow users to trigger matching for their own documents
    IF v_user_id != auth.uid() THEN
        RETURN false;
    END IF;
    
    -- This will be called by the edge function
    -- For now, just return true to indicate the request is valid
    RETURN true;
END;
$$;

COMMENT ON TABLE public.underwriter_matches IS 'Stores AI-generated matching results between uploaded documents and underwriter appetite guides';
COMMENT ON FUNCTION public.get_best_underwriter_matches IS 'Returns the best underwriter matches for a document, ordered by rank and score';
COMMENT ON FUNCTION public.trigger_underwriter_matching IS 'Validates user permissions before triggering underwriter matching analysis';