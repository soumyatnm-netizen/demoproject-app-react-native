-- Create table for underwriter appetite documents
CREATE TABLE public.underwriter_appetites (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    underwriter_name TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'appetite_guide', -- 'appetite_guide', 'product_brochure', 'terms_conditions'
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    source_url TEXT, -- For documents scraped from URLs
    file_size INTEGER,
    file_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'processing', 'processed', 'error'
    processing_error TEXT,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for structured underwriter appetite data
CREATE TABLE public.underwriter_appetite_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    appetite_document_id UUID NOT NULL REFERENCES public.underwriter_appetites(id) ON DELETE CASCADE,
    underwriter_name TEXT NOT NULL,
    financial_ratings JSONB, -- S&P, AM Best, Fitch ratings
    coverage_limits JSONB, -- Professional Indemnity limits, other coverage limits
    target_sectors TEXT[], -- IT, Media, Consultants, etc.
    geographic_coverage TEXT[], -- UK-wide, Worldwide, specific regions
    policy_features JSONB, -- Nil excess, worldwide coverage, direct debit, etc.
    exclusions TEXT[],
    minimum_premium NUMERIC,
    maximum_premium NUMERIC,
    specialty_focus TEXT[], -- SME, Large Corporate, etc.
    broker_features JSONB, -- Online portal, quick quotes, etc.
    risk_appetite TEXT, -- 'conservative', 'moderate', 'aggressive'
    additional_products TEXT[], -- Management Liability, Cyber, etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.underwriter_appetites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.underwriter_appetite_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for underwriter_appetites
CREATE POLICY "Company admins can manage underwriter appetites"
ON public.underwriter_appetites
FOR ALL
USING (is_company_admin(auth.uid()));

CREATE POLICY "All authenticated users can view underwriter appetites"
ON public.underwriter_appetites
FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS Policies for underwriter_appetite_data
CREATE POLICY "Company admins can manage underwriter appetite data"
ON public.underwriter_appetite_data
FOR ALL
USING (is_company_admin(auth.uid()));

CREATE POLICY "All authenticated users can view underwriter appetite data"
ON public.underwriter_appetite_data
FOR SELECT
USING (auth.role() = 'authenticated');

-- Create updated_at triggers
CREATE TRIGGER update_underwriter_appetites_updated_at
    BEFORE UPDATE ON public.underwriter_appetites
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_underwriter_appetite_data_updated_at  
    BEFORE UPDATE ON public.underwriter_appetite_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();