-- Add attack_intelligence and recommended_carriers columns to gap_analyses table

ALTER TABLE public.gap_analyses 
ADD COLUMN IF NOT EXISTS attack_intelligence JSONB,
ADD COLUMN IF NOT EXISTS recommended_carriers JSONB;