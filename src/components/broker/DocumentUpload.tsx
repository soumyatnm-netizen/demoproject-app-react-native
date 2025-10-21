import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientExtracted: (clientData: any) => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  id?: string;
  error?: string;
  extractedData?: any;
}

export const DocumentUpload = ({ open, onOpenChange, onClientExtracted }: DocumentUploadProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [allFilesProcessed, setAllFilesProcessed] = useState(false);
  const { toast } = useToast();

  // Merge extracted data from multiple documents
  const mergeClientData = useCallback((dataArray: any[]) => {
    const merged: any = {
      client_name: "",
      industry: "",
      revenue_band: "",
      employee_count: "",
      coverage_requirements: "",
      contact_email: "",
      contact_phone: "",
      notes: "",
      main_address: "",
      postcode: "",
      date_established: "",
      organisation_type: "",
      website: "",
      wage_roll: "",
      policy_renewal_date: ""
    };

    // Helper to prioritize non-empty values
    const pickBestValue = (values: any[]) => {
      return values.find(v => v && v !== "" && v !== "N/A" && v !== null) || "";
    };

    // Merge each field, prioritizing populated data (now using snake_case from API)
    merged.client_name = pickBestValue(dataArray.map(d => d.client_name));
    merged.industry = pickBestValue(dataArray.map(d => d.industry));
    merged.revenue_band = pickBestValue(dataArray.map(d => d.revenue_band));
    merged.employee_count = pickBestValue(dataArray.map(d => d.employee_count));
    merged.contact_email = pickBestValue(dataArray.map(d => d.contact_email));
    merged.contact_phone = pickBestValue(dataArray.map(d => d.contact_phone));
    merged.main_address = pickBestValue(dataArray.map(d => d.main_address));
    merged.postcode = pickBestValue(dataArray.map(d => d.postcode));
    merged.date_established = pickBestValue(dataArray.map(d => d.date_established));
    merged.organisation_type = pickBestValue(dataArray.map(d => d.organisation_type));
    merged.website = pickBestValue(dataArray.map(d => d.website));
    merged.wage_roll = pickBestValue(dataArray.map(d => d.wage_roll));
    merged.policy_renewal_date = pickBestValue(dataArray.map(d => d.policy_renewal_date));

    // Merge coverage requirements arrays
    const allCoverages = dataArray.flatMap(d => {
      const coverage = d.coverage_requirements || [];
      if (Array.isArray(coverage)) return coverage;
      if (typeof coverage === 'string') return coverage.split(',').map(s => s.trim());
      return [];
    });
    merged.coverage_requirements = [...new Set(allCoverages)].filter(Boolean).join(', ');

    // Combine notes from all documents
    const allNotes = dataArray
      .map((d, i) => {
        const notes = d.notes || "";
        if (notes) return `Document ${i + 1}: ${notes}`;
        return "";
      })
      .filter(Boolean);
    merged.notes = allNotes.join('\n\n');

    return merged;
  }, []);

  // Check if all files are completed and merge data
  const checkAndMergeData = useCallback(() => {
    const allCompleted = uploadingFiles.every(f => 
      f.status === 'completed' || f.status === 'error'
    );

    if (allCompleted && uploadingFiles.length > 0 && !allFilesProcessed) {
      const completedFiles = uploadingFiles.filter(f => f.status === 'completed' && f.extractedData);
      
      if (completedFiles.length > 0) {
        const mergedData = mergeClientData(completedFiles.map(f => f.extractedData));
        onClientExtracted(mergedData);
        setAllFilesProcessed(true);
        
        toast({
          title: "Success",
          description: `Processed ${completedFiles.length} document(s) and merged client data!`,
        });
      }
    }
  }, [uploadingFiles, allFilesProcessed, mergeClientData, onClientExtracted, toast]);

  const uploadFile = useCallback(async (file: File) => {
    const fileId = Math.random().toString(36).substring(7);
    
    // Add file to uploading list
    const uploadingFile: UploadingFile = {
      file,
      progress: 0,
      status: 'uploading'
    };
    
    setUploadingFiles(prev => [...prev, uploadingFile]);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get user's company_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.company_id) {
        throw new Error('User profile or company not found');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Update progress
      setUploadingFiles(prev => 
        prev.map(f => 
          f.file === file 
            ? { ...f, progress: 50, status: 'processing' } 
            : f
        )
      );

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          company_id: profile.company_id,
          filename: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: filePath,
          status: 'uploaded'
        })
        .select()
        .single();

      if (docError || !document) {
        throw docError || new Error('Failed to create document record');
      }

      // Update progress
      setUploadingFiles(prev => 
        prev.map(f => 
          f.file === file 
            ? { ...f, progress: 75, id: document.id } 
            : f
        )
      );

      // Call the scan function
      const { data: scanResult, error: scanError } = await supabase.functions.invoke(
        'scan-client-document',
        {
          body: { documentId: document.id }
        }
      );

      if (scanError) {
        throw scanError;
      }

      if (!scanResult.success) {
        throw new Error(scanResult.error || 'Failed to scan document');
      }

      // Update progress to complete and store extracted data
      setUploadingFiles(prev => 
        prev.map(f => 
          f.file === file 
            ? { ...f, progress: 100, status: 'completed', extractedData: scanResult.extractedData } 
            : f
        )
      );

    } catch (error: any) {
      console.error('Upload/scan error:', error);
      
      setUploadingFiles(prev => 
        prev.map(f => 
          f.file === file 
            ? { ...f, status: 'error', error: error.message } 
            : f
        )
      );

      toast({
        title: "Error",
        description: error.message || "Failed to process document",
        variant: "destructive",
      });
    }
  }, [onClientExtracted, toast]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Reset state for new batch of files
    setAllFilesProcessed(false);
    setUploadingFiles([]);
    
    acceptedFiles.forEach(file => {
      uploadFile(file);
    });
  }, [uploadFile]);

  // Check for completion whenever uploadingFiles changes
  useEffect(() => {
    checkAndMergeData();
  }, [uploadingFiles, checkAndMergeData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const reasons = fileRejections.flatMap(r => r.errors.map(e => e.message));
      toast({
        title: "File not accepted",
        description: reasons.join(' ') || "Only JPG, PNG, GIF up to 10MB are supported.",
        variant: "destructive",
      });
    },
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    multiple: true,
    noClick: false,
    noKeyboard: false,
    noDragEventsBubbling: true
  });

  const removeFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Client Document</DialogTitle>
          <DialogDescription>
            Quickly create client profiles by uploading business forms, insurance documents, handwritten notes, quotes or photos to automatically extract client information using AI-powered OCR and handwriting recognition
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
            }`}
          >
            <input {...getInputProps()} multiple />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? 'Drop the files here...' : 'Drag & drop multiple client documents here'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Upload multiple documents to extract complete client information - all data will be automatically merged
            </p>
            <Button variant="outline" type="button">
              Select Multiple Files
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Supports: PDF, Handwritten notes (JPG, PNG), DOCX documents (max 20MB per file).<br />
              <strong>Tip:</strong> Hold Ctrl (Windows) or Cmd (Mac) to select multiple files at once.
            </p>
          </div>

          {uploadingFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Processing {uploadingFiles.length} File(s)</h3>
              <p className="text-sm text-muted-foreground">
                Data from all completed documents will be automatically merged
              </p>
              {uploadingFiles.map((uploadingFile, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uploadingFile.file.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress value={uploadingFile.progress} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground">
                        {uploadingFile.progress}%
                      </span>
                    </div>
                    {uploadingFile.error && (
                      <p className="text-xs text-destructive mt-1">{uploadingFile.error}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {uploadingFile.status === 'processing' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {uploadingFile.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {uploadingFile.status === 'error' && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFile(uploadingFile.file)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};