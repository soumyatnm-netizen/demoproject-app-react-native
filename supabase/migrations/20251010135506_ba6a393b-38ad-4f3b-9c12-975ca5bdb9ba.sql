-- Add renewal_date column to client_reports table
ALTER TABLE public.client_reports 
ADD COLUMN renewal_date DATE;

-- Add index for efficient renewal date queries
CREATE INDEX idx_client_reports_renewal_date ON public.client_reports(renewal_date);

-- Add comment for documentation
COMMENT ON COLUMN public.client_reports.renewal_date IS 'Policy renewal date for tracking upcoming renewals';