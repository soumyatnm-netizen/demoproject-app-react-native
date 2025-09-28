-- Create junction table for multiple policy types per placement
CREATE TABLE IF NOT EXISTS public.placement_policy_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    placement_outcome_id UUID NOT NULL REFERENCES public.placement_outcomes(id) ON DELETE CASCADE,
    policy_type TEXT NOT NULL CHECK (policy_type IN (
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
    )),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(placement_outcome_id, policy_type)
);

-- Enable RLS
ALTER TABLE public.placement_policy_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for placement policy types
CREATE POLICY "Users can manage their own placement policy types"
ON public.placement_policy_types
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.placement_outcomes po
        WHERE po.id = placement_policy_types.placement_outcome_id
        AND po.user_id = auth.uid()
    )
);

-- Create market intelligence aggregation view
CREATE OR REPLACE VIEW public.market_intelligence_aggregated AS
SELECT 
    po.underwriter_name,
    ppt.policy_type,
    po.industry,
    po.product_type,
    COUNT(*) as total_placements,
    COUNT(CASE WHEN po.outcome = 'won' THEN 1 END) as wins,
    COUNT(CASE WHEN po.outcome = 'quoted' THEN 1 END) as quotes,
    COUNT(CASE WHEN po.outcome = 'declined' THEN 1 END) as declines,
    AVG(po.premium_amount) as avg_premium,
    MIN(po.premium_amount) as min_premium,
    MAX(po.premium_amount) as max_premium,
    ROUND(
        (COUNT(CASE WHEN po.outcome = 'won' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as win_rate_percentage,
    ROUND(
        (COUNT(CASE WHEN po.outcome = 'quoted' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as quote_rate_percentage,
    AVG(po.response_time_days) as avg_response_time,
    AVG(po.competitiveness_score) as avg_competitiveness_score,
    MAX(po.created_at) as last_placement_date,
    p.company_id,
    -- Anonymous market data (no client info)
    'market_data' as data_source
FROM public.placement_outcomes po
LEFT JOIN public.placement_policy_types ppt ON po.id = ppt.placement_outcome_id
LEFT JOIN public.profiles p ON po.user_id = p.user_id
WHERE po.created_at >= NOW() - INTERVAL '24 months' -- Last 2 years of data
GROUP BY 
    po.underwriter_name, 
    ppt.policy_type, 
    po.industry, 
    po.product_type,
    p.company_id
HAVING COUNT(*) >= 3; -- Only show patterns with at least 3 data points

-- Create function to get competitive intelligence for policy types
CREATE OR REPLACE FUNCTION public.get_policy_type_intelligence(
    p_policy_types TEXT[],
    p_industry TEXT DEFAULT NULL,
    p_min_premium NUMERIC DEFAULT NULL,
    p_max_premium NUMERIC DEFAULT NULL
)
RETURNS TABLE(
    underwriter_name TEXT,
    policy_type TEXT,
    industry TEXT,
    total_placements BIGINT,
    win_rate_percentage NUMERIC,
    quote_rate_percentage NUMERIC,
    avg_premium NUMERIC,
    avg_response_time NUMERIC,
    competitiveness_ranking INTEGER
) 
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        mia.underwriter_name,
        mia.policy_type,
        mia.industry,
        mia.total_placements,
        mia.win_rate_percentage,
        mia.quote_rate_percentage,
        mia.avg_premium,
        mia.avg_response_time,
        ROW_NUMBER() OVER (
            PARTITION BY mia.policy_type 
            ORDER BY 
                mia.win_rate_percentage DESC, 
                mia.quote_rate_percentage DESC,
                mia.total_placements DESC
        )::INTEGER as competitiveness_ranking
    FROM public.market_intelligence_aggregated mia
    WHERE 
        (p_policy_types IS NULL OR mia.policy_type = ANY(p_policy_types))
        AND (p_industry IS NULL OR mia.industry ILIKE '%' || p_industry || '%')
        AND (p_min_premium IS NULL OR mia.avg_premium >= p_min_premium)
        AND (p_max_premium IS NULL OR mia.avg_premium <= p_max_premium)
        AND mia.total_placements >= 3
    ORDER BY 
        mia.policy_type,
        competitiveness_ranking,
        mia.win_rate_percentage DESC;
$$;

-- Create index for better performance
CREATE INDEX idx_placement_policy_types_policy_type ON public.placement_policy_types(policy_type);
CREATE INDEX idx_placement_policy_types_placement_id ON public.placement_policy_types(placement_outcome_id);

-- Grant necessary permissions
GRANT SELECT ON public.market_intelligence_aggregated TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_policy_type_intelligence TO authenticated;