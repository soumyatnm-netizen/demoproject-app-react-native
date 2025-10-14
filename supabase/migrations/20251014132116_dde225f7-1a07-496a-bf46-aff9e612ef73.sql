-- Create coverage_categories table
CREATE TABLE IF NOT EXISTS public.coverage_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  company_id UUID REFERENCES public.broker_companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_predefined BOOLEAN DEFAULT false,
  CONSTRAINT coverage_categories_name_check CHECK (char_length(name) >= 2 AND char_length(name) <= 100)
);

-- Enable RLS
ALTER TABLE public.coverage_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view categories from their company or predefined"
  ON public.coverage_categories
  FOR SELECT
  USING (
    is_predefined = true 
    OR company_id = get_user_company_id(auth.uid())
    OR company_id IS NULL
  );

CREATE POLICY "Company admins can create categories"
  ON public.coverage_categories
  FOR INSERT
  WITH CHECK (
    is_company_admin(auth.uid())
    AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
    AND created_by = auth.uid()
  );

CREATE POLICY "Company admins can delete their company's categories"
  ON public.coverage_categories
  FOR DELETE
  USING (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND is_predefined = false
  );

-- Insert predefined categories
INSERT INTO public.coverage_categories (name, is_predefined, created_by)
VALUES 
  ('Tech and Life Sciences', true, '00000000-0000-0000-0000-000000000000'),
  ('Commercial Combined', true, '00000000-0000-0000-0000-000000000000'),
  ('Cyber', true, '00000000-0000-0000-0000-000000000000'),
  ('Other', true, '00000000-0000-0000-0000-000000000000')
ON CONFLICT (name) DO NOTHING;

-- Remove the CHECK constraint from underwriter_appetites.coverage_category
-- to allow custom categories
ALTER TABLE public.underwriter_appetites 
DROP CONSTRAINT IF EXISTS underwriter_appetites_coverage_category_check;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_coverage_categories_company 
ON public.coverage_categories(company_id);

CREATE INDEX IF NOT EXISTS idx_coverage_categories_predefined 
ON public.coverage_categories(is_predefined);

-- Add comment
COMMENT ON TABLE public.coverage_categories IS 'Stores both predefined and custom coverage categories for appetite guides';