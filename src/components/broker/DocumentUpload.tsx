import { useState, useCallback } from 'react';
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
}

export const DocumentUpload = ({ open, onOpenChange, onClientExtracted }: DocumentUploadProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { toast } = useToast();

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

      // Update progress to complete
      setUploadingFiles(prev => 
        prev.map(f => 
          f.file === file 
            ? { ...f, progress: 100, status: 'completed' } 
            : f
        )
      );

      // Call the callback with extracted data
      onClientExtracted(scanResult.extractedData);

      toast({
        title: "Success",
        description: "Document scanned successfully. Client data extracted!",
      });

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
    acceptedFiles.forEach(file => {
      uploadFile(file);
    });
  }, [uploadFile]);

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
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
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
            Upload a policy or quote document to automatically extract client information
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
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? 'Drop the files here...' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to select files
            </p>
            <Button variant="outline" type="button">
              Select Files
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Supports: JPG, PNG, GIF (max 10MB). DOCX/PDF support coming soon.
            </p>
          </div>

          {uploadingFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Processing Files</h3>
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