-- Update RLS policies to enable company-level access for company admins
-- Company admins can now see all data from their company, not just their own

-- ============= STRUCTURED QUOTES =============
DROP POLICY IF EXISTS "Users can view their company quotes" ON structured_quotes;
DROP POLICY IF EXISTS "Users can view their own quotes" ON structured_quotes;

CREATE POLICY "Users can view their company quotes"
ON structured_quotes FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert quotes" ON structured_quotes;
DROP POLICY IF EXISTS "Users can insert their own quotes" ON structured_quotes;

CREATE POLICY "Users can insert quotes"
ON structured_quotes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their company quotes" ON structured_quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON structured_quotes;

CREATE POLICY "Users can update their company quotes"
ON structured_quotes FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their company quotes" ON structured_quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON structured_quotes;

CREATE POLICY "Users can delete their company quotes"
ON structured_quotes FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- ============= DOCUMENTS =============
DROP POLICY IF EXISTS "Users can view their company documents" ON documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;

CREATE POLICY "Users can view their company documents"
ON documents FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;

CREATE POLICY "Users can insert documents"
ON documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their company documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;

CREATE POLICY "Users can update their company documents"
ON documents FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their company documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

CREATE POLICY "Users can delete their company documents"
ON documents FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- ============= COMPARISONS =============
DROP POLICY IF EXISTS "Users can view their company comparisons" ON comparisons;
DROP POLICY IF EXISTS "Users can view their own comparisons" ON comparisons;

CREATE POLICY "Users can view their company comparisons"
ON comparisons FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert comparisons" ON comparisons;
DROP POLICY IF EXISTS "Users can insert their own comparisons" ON comparisons;

CREATE POLICY "Users can insert comparisons"
ON comparisons FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their company comparisons" ON comparisons;
DROP POLICY IF EXISTS "Users can update their own comparisons" ON comparisons;

CREATE POLICY "Users can update their company comparisons"
ON comparisons FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their company comparisons" ON comparisons;
DROP POLICY IF EXISTS "Users can delete their own comparisons" ON comparisons;

CREATE POLICY "Users can delete their company comparisons"
ON comparisons FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- ============= REPORTS =============
DROP POLICY IF EXISTS "Users can view their company reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;

CREATE POLICY "Users can view their company reports"
ON reports FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert reports" ON reports;
DROP POLICY IF EXISTS "Users can insert their own reports" ON reports;

CREATE POLICY "Users can insert reports"
ON reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their company reports" ON reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON reports;

CREATE POLICY "Users can update their company reports"
ON reports FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their company reports" ON reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON reports;

CREATE POLICY "Users can delete their company reports"
ON reports FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

-- ============= POLICY WORDINGS =============
DROP POLICY IF EXISTS "Users can view their company policy wordings" ON policy_wordings;
DROP POLICY IF EXISTS "Users can view their own policy wordings" ON policy_wordings;

CREATE POLICY "Users can view their company policy wordings"
ON policy_wordings FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
  OR is_cc_staff(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert policy wordings" ON policy_wordings;
DROP POLICY IF EXISTS "Users can insert their own policy wordings" ON policy_wordings;

CREATE POLICY "Users can insert policy wordings"
ON policy_wordings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update their company policy wordings" ON policy_wordings;
DROP POLICY IF EXISTS "Users can update their own policy wordings" ON policy_wordings;

CREATE POLICY "Users can update their company policy wordings"
ON policy_wordings FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their company policy wordings" ON policy_wordings;
DROP POLICY IF EXISTS "Users can delete their own policy wordings" ON policy_wordings;

CREATE POLICY "Users can delete their company policy wordings"
ON policy_wordings FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR (company_id = get_user_company_id(auth.uid()) AND is_company_admin(auth.uid()))
);