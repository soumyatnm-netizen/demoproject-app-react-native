-- Backfill client_name for existing quotes using document filenames
UPDATE public.structured_quotes sq
SET client_name = 'Innovatek Systems Ltd'
FROM public.documents d
WHERE sq.client_name IS NULL
  AND sq.document_id = d.id
  AND d.filename ILIKE '%innovatek%';