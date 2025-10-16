import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';

interface ComparisonDocument {
  file_name: string;
  insurer_name: string;
  policy_type: string;
  total_annual_premium: string;
  voluntary_excess: string;
  public_liability_limit: string;
  policy_term_start: string;
  policy_term_end: string;
}

interface ComparisonReport {
  summary: string;
  documents: ComparisonDocument[];
}

export const InsuranceDocumentComparison = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonReport | null>(null);
  const { toast } = useToast();

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length + uploadedFiles.length > 10) {
      toast({
        title: "Too many files",
        description: "Maximum 10 documents can be compared at once",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    const newDocIds: string[] = [];

    for (const file of acceptedFiles) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_type: file.type,
            storage_path: filePath,
            file_size: file.size,
            status: 'uploaded'
          })
          .select()
          .single();

        if (docError) throw docError;
        newDocIds.push(docData.id);

      } catch (error) {
        console.error('Upload error:', error);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        });
      }
    }

    setUploadedFiles([...uploadedFiles, ...acceptedFiles]);
    setDocumentIds([...documentIds, ...newDocIds]);
    setIsUploading(false);

    toast({
      title: "Files uploaded",
      description: `${acceptedFiles.length} file(s) uploaded successfully`
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxSize: 20 * 1024 * 1024 // 20MB
  });

  const compareDocuments = async () => {
    if (documentIds.length < 2) {
      toast({
        title: "Not enough documents",
        description: "Please upload at least 2 documents to compare",
        variant: "destructive"
      });
      return;
    }

    setIsComparing(true);
    try {
      const { data, error } = await supabase.functions.invoke('compare-insurance-docs', {
        body: { documentIds }
      });

      if (error) throw error;

      if (data.ok && data.result?.comparison_report) {
        setComparisonResult(data.result.comparison_report);
        toast({
          title: "Comparison complete",
          description: `Successfully compared ${data.meta.documentsProcessed} documents`
        });
      } else {
        throw new Error(data.error || 'Comparison failed');
      }

    } catch (error: any) {
      console.error('Comparison error:', error);
      toast({
        title: "Comparison failed",
        description: error.message || 'Failed to compare documents',
        variant: "destructive"
      });
    } finally {
      setIsComparing(false);
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? value : `£${num.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Insurance Document Comparison</CardTitle>
          <CardDescription>
            Upload 2-10 insurance quotes or policy wordings to compare key terms side-by-side
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              {isDragActive ? 'Drop files here' : 'Drag and drop files here, or click to select'}
            </p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, PNG, JPG • Max 20MB per file • Up to 10 files
            </p>
          </div>

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Uploaded Documents ({uploadedFiles.length})</h4>
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <FileCheck className="h-4 w-4 text-green-600" />
                  <span className="text-sm flex-1">{file.name}</span>
                  <Badge variant="secondary">{(file.size / 1024).toFixed(0)} KB</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Compare Button */}
          <Button
            onClick={compareDocuments}
            disabled={isComparing || isUploading || uploadedFiles.length < 2}
            className="w-full"
          >
            {isComparing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Comparing Documents...
              </>
            ) : (
              `Compare ${uploadedFiles.length} Document${uploadedFiles.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparisonResult && (
        <>
          {/* Summary */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              {comparisonResult.summary}
            </AlertDescription>
          </Alert>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Side-by-Side Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">Field</TableHead>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableHead key={idx} className="font-bold">
                          {doc.file_name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Insurer</TableCell>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableCell key={idx}>{doc.insurer_name}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Policy Type</TableCell>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableCell key={idx}>{doc.policy_type}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-accent/50">
                      <TableCell className="font-medium">Annual Premium</TableCell>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableCell key={idx} className="font-semibold">
                          {formatCurrency(doc.total_annual_premium)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Excess / Deductible</TableCell>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableCell key={idx}>{formatCurrency(doc.voluntary_excess)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Public Liability Limit</TableCell>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableCell key={idx}>{formatCurrency(doc.public_liability_limit)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Policy Start</TableCell>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableCell key={idx}>{doc.policy_term_start}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Policy End</TableCell>
                      {comparisonResult.documents.map((doc, idx) => (
                        <TableCell key={idx}>{doc.policy_term_end}</TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
