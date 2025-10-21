-- Add company_id to key tables for company-level access control
-- This migration is idempotent and safe to re-run

-- Add company_id columns (IF NOT EXISTS)
ALTER TABLE structured_quotes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);
ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);
ALTER TABLE policy_wordings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);
ALTER TABLE client_reports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);
ALTER TABLE gap_analyses ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Backfill company_id for existing records
UPDATE structured_quotes sq SET company_id = p.company_id FROM profiles p WHERE sq.user_id = p.user_id AND sq.company_id IS NULL;
UPDATE documents d SET company_id = p.company_id FROM profiles p WHERE d.user_id = p.user_id AND d.company_id IS NULL;
UPDATE comparisons c SET company_id = p.company_id FROM profiles p WHERE c.user_id = p.user_id AND c.company_id IS NULL;
UPDATE reports r SET company_id = p.company_id FROM profiles p WHERE r.user_id = p.user_id AND r.company_id IS NULL;
UPDATE policy_wordings pw SET company_id = p.company_id FROM profiles p WHERE pw.user_id = p.user_id AND pw.company_id IS NULL;
UPDATE client_reports cr SET company_id = p.company_id FROM profiles p WHERE cr.user_id = p.user_id AND cr.company_id IS NULL;
UPDATE gap_analyses ga SET company_id = p.company_id FROM profiles p WHERE ga.user_id = p.user_id AND ga.company_id IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_structured_quotes_company_id ON structured_quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_company_id ON comparisons(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_company_id ON reports(company_id);
CREATE INDEX IF NOT EXISTS idx_policy_wordings_company_id ON policy_wordings(company_id);
CREATE INDEX IF NOT EXISTS idx_client_reports_company_id ON client_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_company_id ON gap_analyses(company_id);