-- Create profiles table for broker information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT,
  broker_type TEXT CHECK (broker_type IN ('independent', 'regional', 'growth-oriented')),
  subscription_tier TEXT CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')) DEFAULT 'basic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table for uploaded files
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT CHECK (status IN ('uploaded', 'processing', 'processed', 'error')) DEFAULT 'uploaded',
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create structured_quotes table for AI-extracted data
CREATE TABLE public.structured_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  insurer_name TEXT NOT NULL,
  product_type TEXT,
  industry TEXT,
  revenue_band TEXT,
  premium_amount DECIMAL(15,2),
  premium_currency TEXT DEFAULT 'GBP',
  deductible_amount DECIMAL(15,2),
  coverage_limits JSONB,
  inner_limits JSONB,
  inclusions TEXT[],
  exclusions TEXT[],
  policy_terms JSONB,
  quote_status TEXT CHECK (quote_status IN ('quoted', 'declined', 'bound')) DEFAULT 'quoted',
  quote_date DATE,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create comparisons table for storing comparison sessions
CREATE TABLE public.comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quote_ids UUID[] NOT NULL,
  comparison_data JSONB,
  client_name TEXT,
  risk_profile JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reports table for generated client reports
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comparison_id UUID NOT NULL REFERENCES public.comparisons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  report_type TEXT CHECK (report_type IN ('comparison', 'market_analysis', 'recommendation')) DEFAULT 'comparison',
  report_data JSONB NOT NULL,
  export_format TEXT CHECK (export_format IN ('pdf', 'excel', 'html')) DEFAULT 'pdf',
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market_intelligence table for appetite mapping
CREATE TABLE public.market_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  industry TEXT,
  revenue_band_min DECIMAL(15,2),
  revenue_band_max DECIMAL(15,2),
  appetite_score INTEGER CHECK (appetite_score >= 0 AND appetite_score <= 100),
  win_rate DECIMAL(5,2),
  avg_premium_rate DECIMAL(10,4),
  typical_limits JSONB,
  preferences JSONB,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_points INTEGER DEFAULT 1
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structured_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intelligence ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for documents
CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for structured_quotes
CREATE POLICY "Users can view their own quotes" ON public.structured_quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own quotes" ON public.structured_quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own quotes" ON public.structured_quotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own quotes" ON public.structured_quotes FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for comparisons
CREATE POLICY "Users can view their own comparisons" ON public.comparisons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own comparisons" ON public.comparisons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comparisons" ON public.comparisons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comparisons" ON public.comparisons FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for reports
CREATE POLICY "Users can view their own reports" ON public.reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for market_intelligence (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view market intelligence" ON public.market_intelligence FOR SELECT USING (auth.role() = 'authenticated');

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('documents', 'documents', false),
  ('reports', 'reports', false);

-- Create storage policies for documents
CREATE POLICY "Users can view their own documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload their own documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own documents" ON storage.objects FOR UPDATE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for reports
CREATE POLICY "Users can view their own reports" ON storage.objects FOR SELECT USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload their own reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for better performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_structured_quotes_user_id ON public.structured_quotes(user_id);
CREATE INDEX idx_structured_quotes_insurer ON public.structured_quotes(insurer_name);
CREATE INDEX idx_structured_quotes_product_type ON public.structured_quotes(product_type);
CREATE INDEX idx_market_intelligence_lookup ON public.market_intelligence(insurer_name, product_type, industry);
CREATE INDEX idx_comparisons_user_id ON public.comparisons(user_id);
CREATE INDEX idx_reports_user_id ON public.reports(user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_structured_quotes_updated_at BEFORE UPDATE ON public.structured_quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comparisons_updated_at BEFORE UPDATE ON public.comparisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();