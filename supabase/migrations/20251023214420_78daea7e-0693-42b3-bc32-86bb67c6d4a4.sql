-- Fix storage RLS for documents bucket to allow company folder uploads
-- Users should be able to upload to their company's folder

DROP POLICY IF EXISTS documents_insert_owner_or_admin ON storage.objects;

CREATE POLICY documents_insert_company_member
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    -- Allow super admins
    is_super_admin(auth.uid())
    OR 
    -- Allow company admins
    is_company_admin(auth.uid())
    OR 
    -- Allow users to upload to their own user folder
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Allow users to upload to their company folder
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND company_id::text = (storage.foldername(name))[1]
    )
  )
);