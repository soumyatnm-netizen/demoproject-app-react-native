-- Add tables for placement intelligence and analytics

-- 1. Client Reports table
CREATE TABLE public.client_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    comparison_id UUID REFERENCES public.comparisons(id) ON DELETE CASCADE,
    report_title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    broker_company_name TEXT,
    broker_logo_url TEXT,
    report_data JSONB NOT NULL, -- Contains formatted comparison data
    key_changes JSONB, -- What's changed highlights
    recommendations TEXT[],
    report_status TEXT DEFAULT 'draft', -- 'draft', 'finalized', 'sent'
    pdf_storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Market Intelligence table for tracking placements
CREATE TABLE public.placement_outcomes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    quote_id UUID REFERENCES public.structured_quotes(id) ON DELETE CASCADE,
    underwriter_name TEXT NOT NULL,
    industry TEXT,
    product_type TEXT,
    premium_amount NUMERIC,
    coverage_limits JSONB,
    outcome TEXT NOT NULL, -- 'quoted', 'declined', 'won', 'lost', 'no_response'
    win_reason TEXT, -- Why they won/lost
    response_time_days INTEGER,
    competitiveness_score INTEGER, -- 1-10 rating
    notes TEXT,
    placed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Gap Analysis results
CREATE TABLE public.gap_analyses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    incumbent_quote_id UUID REFERENCES public.structured_quotes(id),
    comparison_id UUID REFERENCES public.comparisons(id),
    coverage_gaps JSONB NOT NULL, -- Areas where incumbent falls short
    opportunity_score INTEGER NOT NULL, -- 1-100 likelihood of winning
    key_weaknesses TEXT[],
    competitive_advantages TEXT[],
    switch_evidence JSONB, -- Reasons client should switch
    attack_strategy TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Predictive Analytics data
CREATE TABLE public.market_predictions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    underwriter_name TEXT NOT NULL,
    industry TEXT,
    product_type TEXT,
    revenue_band TEXT,
    win_probability NUMERIC(5,2), -- Percentage likelihood of winning
    quote_probability NUMERIC(5,2), -- Percentage likelihood of quoting
    average_response_days INTEGER,
    typical_premium_adjustment NUMERIC(5,2), -- % above/below market
    capacity_status TEXT, -- 'high', 'medium', 'low', 'restricted'
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    data_points_count INTEGER DEFAULT 1, -- Number of placements this is based on
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_outcomes ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.gap_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_reports
CREATE POLICY "Users can manage their own client reports"
ON public.client_reports
FOR ALL
USING (auth.uid() = user_id);

-- RLS Policies for placement_outcomes
CREATE POLICY "Users can manage their own placement outcomes"  
ON public.placement_outcomes
FOR ALL
USING (auth.uid() = user_id);

-- RLS Policies for gap_analyses
CREATE POLICY "Users can manage their own gap analyses"
ON public.gap_analyses  
FOR ALL
USING (auth.uid() = user_id);

-- RLS Policies for market_predictions (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view market predictions"
ON public.market_predictions
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Company admins can update market predictions"
ON public.market_predictions
FOR ALL  
USING (is_company_admin(auth.uid()));

-- Add update triggers
CREATE TRIGGER update_client_reports_updated_at
    BEFORE UPDATE ON public.client_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_placement_outcomes_updated_at
    BEFORE UPDATE ON public.placement_outcomes  
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gap_analyses_updated_at
    BEFORE UPDATE ON public.gap_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();