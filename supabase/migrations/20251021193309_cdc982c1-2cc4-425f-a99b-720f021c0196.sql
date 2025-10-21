-- Add company_id to key tables for company-level access control
-- This allows company admins to see all data from their company, not just their own uploads

-- Add company_id to structured_quotes
ALTER TABLE structured_quotes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Add company_id to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Add company_id to comparisons
ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Add company_id to reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Add company_id to policy_wordings
ALTER TABLE policy_wordings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Add company_id to client_reports (if exists)
ALTER TABLE client_reports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Add company_id to gap_analyses (if exists)
ALTER TABLE gap_analyses ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES broker_companies(id);

-- Backfill company_id from user's profile for existing records
UPDATE structured_quotes sq
SET company_id = p.company_id
FROM profiles p
WHERE sq.user_id = p.user_id AND sq.company_id IS NULL;

UPDATE documents d
SET company_id = p.company_id
FROM profiles p
WHERE d.user_id = p.user_id AND d.company_id IS NULL;

UPDATE comparisons c
SET company_id = p.company_id
FROM profiles p
WHERE c.user_id = p.user_id AND c.company_id IS NULL;

UPDATE reports r
SET company_id = p.company_id
FROM profiles p
WHERE r.user_id = p.user_id AND r.company_id IS NULL;

UPDATE policy_wordings pw
SET company_id = p.company_id
FROM profiles p
WHERE pw.user_id = p.user_id AND pw.company_id IS NULL;

UPDATE client_reports cr
SET company_id = p.company_id
FROM profiles p
WHERE cr.user_id = p.user_id AND cr.company_id IS NULL;

UPDATE gap_analyses ga
SET company_id = p.company_id
FROM profiles p
WHERE ga.user_id = p.user_id AND ga.company_id IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_structured_quotes_company_id ON structured_quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_company_id ON comparisons(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_company_id ON reports(company_id);
CREATE INDEX IF NOT EXISTS idx_policy_wordings_company_id ON policy_wordings(company_id);
CREATE INDEX IF NOT EXISTS idx_client_reports_company_id ON client_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_company_id ON gap_analyses(company_id);

-- Update RLS policies for structured_quotes
DROP POLICY IF EXISTS "Users can view their own quotes" ON structured_quotes;
CREATE POLICY "Users can view their company quotes"
ON structured_quotes FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own quotes" ON structured_quotes;
CREATE POLICY "Users can insert quotes"
ON structured_quotes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own quotes" ON structured_quotes;
CREATE POLICY "Users can update their company quotes"
ON structured_quotes FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own quotes" ON structured_quotes;
CREATE POLICY "Users can delete their company quotes"
ON structured_quotes FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- Update RLS policies for documents
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
CREATE POLICY "Users can view their company documents"
ON documents FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
CREATE POLICY "Users can insert documents"
ON documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
CREATE POLICY "Users can update their company documents"
ON documents FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
CREATE POLICY "Users can delete their company documents"
ON documents FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- Update RLS policies for comparisons
DROP POLICY IF EXISTS "Users can view their own comparisons" ON comparisons;
CREATE POLICY "Users can view their company comparisons"
ON comparisons FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own comparisons" ON comparisons;
CREATE POLICY "Users can insert comparisons"
ON comparisons FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own comparisons" ON comparisons;
CREATE POLICY "Users can update their company comparisons"
ON comparisons FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own comparisons" ON comparisons;
CREATE POLICY "Users can delete their company comparisons"
ON comparisons FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- Update RLS policies for reports
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
CREATE POLICY "Users can view their company reports"
ON reports FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own reports" ON reports;
CREATE POLICY "Users can insert reports"
ON reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own reports" ON reports;
CREATE POLICY "Users can update their company reports"
ON reports FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own reports" ON reports;
CREATE POLICY "Users can delete their company reports"
ON reports FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- Update RLS policies for policy_wordings
DROP POLICY IF EXISTS "Users can view their own policy wordings" ON policy_wordings;
CREATE POLICY "Users can view their company policy wordings"
ON policy_wordings FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own policy wordings" ON policy_wordings;
CREATE POLICY "Users can insert policy wordings"
ON policy_wordings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own policy wordings" ON policy_wordings;
CREATE POLICY "Users can update their company policy wordings"
ON policy_wordings FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own policy wordings" ON policy_wordings;
CREATE POLICY "Users can delete their company policy wordings"
ON policy_wordings FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);