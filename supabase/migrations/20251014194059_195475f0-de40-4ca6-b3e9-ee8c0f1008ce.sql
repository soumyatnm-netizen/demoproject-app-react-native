-- Update RLS to allow super admins to manage underwriter_appetites even without a company
-- and keep company admins restricted to having a company_id set

-- Drop existing manage policy
DROP POLICY IF EXISTS "secure_underwriter_appetites_manage_v2" ON public.underwriter_appetites;

-- Create new manage policy permitting super admins or company admins with company
CREATE POLICY "secure_underwriter_appetites_manage_v3"
ON public.underwriter_appetites
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (
    is_company_admin(auth.uid()) AND get_user_company_id(auth.uid()) IS NOT NULL
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (
    is_company_admin(auth.uid()) AND get_user_company_id(auth.uid()) IS NOT NULL
  )
  OR is_super_admin(auth.uid())
);

-- Drop old select policy if exists to avoid conflicts
DROP POLICY IF EXISTS "secure_underwriter_appetites_select_v2" ON public.underwriter_appetites;

-- Ensure super admins can also SELECT regardless of company
CREATE POLICY "secure_underwriter_appetites_select_v3"
ON public.underwriter_appetites
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (company_id = get_user_company_id(auth.uid()) AND get_user_company_id(auth.uid()) IS NOT NULL)
  OR is_super_admin(auth.uid())
);