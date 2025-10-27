-- Add storage policy for CC Staff to download all company documents
CREATE POLICY "cc_staff_access_all_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND is_cc_staff(auth.uid())
);

-- Add storage policy for CC Staff to download all company reports
CREATE POLICY "cc_staff_access_all_reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports' 
  AND is_cc_staff(auth.uid())
);