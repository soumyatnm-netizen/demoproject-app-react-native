-- Update existing quotes to link them to clients based on document filenames
-- Link Innovatek documents to "Innovatek Systems Ltd"
UPDATE public.structured_quotes 
SET client_name = 'Innovatek Systems Ltd'
WHERE client_name IS NULL 
AND document_id IN (
    SELECT id FROM public.documents 
    WHERE filename ILIKE '%innovatek%'
    AND user_id = auth.uid()
);

-- You can add similar updates for other clients as needed
-- UPDATE public.structured_quotes 
-- SET client_name = 'ICT Consulting 2'
-- WHERE client_name IS NULL 
-- AND document_id IN (
--     SELECT id FROM public.documents 
--     WHERE filename ILIKE '%ict%'
--     AND user_id = auth.uid()
-- );