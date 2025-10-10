-- First, update any existing quotes without client_name to have a placeholder
-- This ensures the migration doesn't fail on existing data
UPDATE structured_quotes 
SET client_name = 'Uncategorized Client - Please Update'
WHERE client_name IS NULL;

-- Now make client_name required (NOT NULL)
ALTER TABLE structured_quotes 
ALTER COLUMN client_name SET NOT NULL;

-- Add an index on client_name for efficient filtering
CREATE INDEX IF NOT EXISTS idx_structured_quotes_client_name 
ON structured_quotes(client_name);

-- Add a check to ensure client_name is not empty
ALTER TABLE structured_quotes 
ADD CONSTRAINT check_client_name_not_empty 
CHECK (length(trim(client_name)) > 0);