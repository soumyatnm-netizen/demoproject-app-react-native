-- First, make document_id nullable temporarily for sample data
ALTER TABLE public.structured_quotes ALTER COLUMN document_id DROP NOT NULL;

-- Add sample client data using the first available document ID
WITH sample_user AS (
  SELECT user_id FROM public.structured_quotes LIMIT 1
),
sample_doc AS (
  SELECT id as doc_id FROM public.documents LIMIT 1
)
INSERT INTO public.structured_quotes (
  user_id, 
  document_id, 
  client_name, 
  insurer_name, 
  product_type, 
  premium_amount, 
  industry, 
  quote_date, 
  created_at
) 
SELECT 
  sample_user.user_id,
  sample_doc.doc_id,
  client_data.client_name,
  client_data.insurer_name,
  client_data.product_type,
  client_data.premium_amount,
  client_data.industry,
  client_data.quote_date::date,
  client_data.created_at::timestamp
FROM sample_user, sample_doc,
(VALUES 
  ('Acme Manufacturing Ltd', 'AXA Insurance UK', 'Commercial Combined', 4500.00, 'Manufacturing', '2024-01-15', '2024-01-15 10:00:00'),
  ('Acme Manufacturing Ltd', 'Zurich Insurance', 'Commercial Combined', 4750.00, 'Manufacturing', '2024-01-20', '2024-01-20 14:30:00'),
  ('TechStart Solutions', 'RSA Insurance Group', 'Professional Indemnity', 2800.00, 'Technology', '2024-02-10', '2024-02-10 09:15:00'),
  ('TechStart Solutions', 'Chubb Insurance', 'Professional Indemnity', 3200.00, 'Technology', '2024-02-12', '2024-02-12 11:45:00'),
  ('GreenFields Consulting', 'Allianz Commercial', 'Professional Indemnity', 1900.00, 'Consulting', '2024-03-05', '2024-03-05 16:20:00'),
  ('Bristol Logistics Co', 'QBE European Operations', 'Motor Fleet', 8900.00, 'Transport & Logistics', '2024-03-18', '2024-03-18 13:10:00')
) AS client_data(client_name, insurer_name, product_type, premium_amount, industry, quote_date, created_at);