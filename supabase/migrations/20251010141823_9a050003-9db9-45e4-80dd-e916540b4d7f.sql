-- Add new fields to client_reports table for enhanced client data
ALTER TABLE public.client_reports 
ADD COLUMN IF NOT EXISTS current_broker text,
ADD COLUMN IF NOT EXISTS current_carrier text,
ADD COLUMN IF NOT EXISTS current_premium_total numeric,
ADD COLUMN IF NOT EXISTS claims_free boolean,
ADD COLUMN IF NOT EXISTS recent_claims_details text,
ADD COLUMN IF NOT EXISTS revenue_split_geography jsonb,
ADD COLUMN IF NOT EXISTS activity_split jsonb,
ADD COLUMN IF NOT EXISTS sells_in_us boolean;

COMMENT ON COLUMN public.client_reports.current_broker IS 'Name of the current insurance broker';
COMMENT ON COLUMN public.client_reports.current_carrier IS 'Name of the current insurance carrier/underwriter';
COMMENT ON COLUMN public.client_reports.current_premium_total IS 'Total current premium across all policies';
COMMENT ON COLUMN public.client_reports.claims_free IS 'Whether the client is claims-free';
COMMENT ON COLUMN public.client_reports.recent_claims_details IS 'Details about any recent claims';
COMMENT ON COLUMN public.client_reports.revenue_split_geography IS 'Revenue/turnover split by geography (UK/EU/US/APAC etc) as percentages';
COMMENT ON COLUMN public.client_reports.activity_split IS 'Activity split by sector (e-commerce, retail, etc) as percentages';
COMMENT ON COLUMN public.client_reports.sells_in_us IS 'Whether the client sells products in the US market';