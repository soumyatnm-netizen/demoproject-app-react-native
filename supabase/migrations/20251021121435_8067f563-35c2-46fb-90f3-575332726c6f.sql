-- Create table to track processing times for various operations
CREATE TABLE IF NOT EXISTS public.processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.processing_metrics ENABLE ROW LEVEL SECURITY;

-- Only CC Staff can view metrics
CREATE POLICY "CC Staff can view processing metrics"
ON public.processing_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'CC_STAFF'
  )
);

-- Edge functions can insert metrics (using service role)
CREATE POLICY "Service role can insert metrics"
ON public.processing_metrics
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_processing_metrics_operation ON public.processing_metrics(operation_type, created_at DESC);
CREATE INDEX idx_processing_metrics_created_at ON public.processing_metrics(created_at DESC);

-- Function to get average processing times by operation type
CREATE OR REPLACE FUNCTION public.get_processing_time_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  operation_type TEXT,
  avg_duration_ms NUMERIC,
  p95_duration_ms NUMERIC,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.operation_type,
    AVG(pm.duration_ms)::NUMERIC as avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.duration_ms)::NUMERIC as p95_duration_ms,
    COUNT(*) as count
  FROM processing_metrics pm
  WHERE pm.created_at >= NOW() - (days_back || ' days')::INTERVAL
  AND pm.success = true
  GROUP BY pm.operation_type;
END;
$$;

COMMENT ON TABLE public.processing_metrics IS 'Tracks processing times for AI operations like comparisons and document processing';
COMMENT ON FUNCTION public.get_processing_time_stats IS 'Returns average and P95 processing times for each operation type';