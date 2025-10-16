-- Fix storage RLS for 'documents' bucket: drop+create policies

DROP POLICY IF EXISTS documents_insert_owner_or_admin ON storage.objects;
CREATE POLICY documents_insert_owner_or_admin
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS documents_select_authenticated ON storage.objects;
CREATE POLICY documents_select_authenticated
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
);

DROP POLICY IF EXISTS documents_update_owner_or_admin ON storage.objects;
CREATE POLICY documents_update_owner_or_admin
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS documents_delete_owner_or_admin ON storage.objects;
CREATE POLICY documents_delete_owner_or_admin
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);
