-- Add client_name column to structured_quotes table to link quotes with clients
ALTER TABLE public.structured_quotes ADD COLUMN client_name text;