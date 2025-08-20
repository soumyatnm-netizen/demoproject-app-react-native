-- Add logo_url column to underwriter_appetites table
ALTER TABLE public.underwriter_appetites 
ADD COLUMN logo_url TEXT;

-- Add some default underwriter appetite URLs
INSERT INTO public.underwriter_appetites (
    underwriter_name, 
    document_type, 
    filename, 
    storage_path, 
    source_url, 
    file_type, 
    uploaded_by,
    logo_url,
    status
) VALUES 
(
    'Hiscox', 
    'appetite_guide', 
    'Professional Indemnity Appetite Guide', 
    '', 
    'https://www.hiscox.co.uk/broker/commercial-insurance/professional-indemnity', 
    'web/url', 
    '00000000-0000-0000-0000-000000000000',
    'https://www.hiscox.co.uk/sites/default/files/styles/social_share/public/2021-11/hiscox-logo-facebook_0.png',
    'uploaded'
),
(
    'Markel', 
    'product_brochure', 
    'Professional Indemnity Combined Product Guide', 
    '', 
    'https://uk.markel.com/insurance/insurance-products/professional-indemnity-combined?utm_source=chatgpt.com', 
    'web/url', 
    '00000000-0000-0000-0000-000000000000',
    'https://uk.markel.com/themes/custom/markel_uk/logo.svg',
    'uploaded'
),
(
    'Talbot (AIG)', 
    'appetite_guide', 
    'Professional Indemnity Value Proposition', 
    '', 
    'https://talbot.aig.com/content/dam/talbot/new-documents/value-propositions/talbot_value-proposition_professional-indemnity.pdf.coredownload.pdf', 
    'web/url', 
    '00000000-0000-0000-0000-000000000000',
    'https://www.aig.com/content/dam/aig/america-canada/us/images/logo/aig-logo.svg',
    'uploaded'
),
(
    'Allianz', 
    'product_brochure', 
    'Professional Indemnity Product Brochure', 
    '', 
    'https://www.allianz.co.uk/content/dam/onemarketing/azuk/allianzcouk/broker/docs/products/professional-indemnity-select/general-documents/professional-indemnity-product-brochure_acom9849.pdf', 
    'web/url', 
    '00000000-0000-0000-0000-000000000000',
    'https://www.allianz.com/content/dam/onemarketing/azcom/Allianz_com/press/Allianz-logo-2021.jpg',
    'uploaded'
);

-- Add logo_url to underwriter_appetite_data table as well
ALTER TABLE public.underwriter_appetite_data 
ADD COLUMN logo_url TEXT;