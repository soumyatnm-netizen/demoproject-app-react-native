import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { SecurityLogger } from "@/lib/security";
import { SecurityVulnerabilityReport } from "@/components/SecurityVulnerabilityReport";

interface FileUploadProps {
  onUploadSuccess?: () => void;
}

interface UploadingFile {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

const FileUpload = ({ onUploadSuccess }: FileUploadProps) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadingFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);

    for (const uploadingFile of newFiles) {
      try {
        await uploadFile(uploadingFile);
      } catch (error) {
        console.error('Upload error:', error);
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        ));
      }
    }
  }, []);

  const uploadFile = async (uploadingFile: UploadingFile) => {
    const { file, id } = uploadingFile;
    
    // Update progress
    const updateProgress = (progress: number, status: UploadingFile['status']) => {
      setUploadingFiles(prev => prev.map(f => 
        f.id === id ? { ...f, progress, status } : f
      ));
    };

    try {
      // Enhanced secure upload with audit logging
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `documents/${fileName}`;

      updateProgress(25, 'uploading');

      // Use secure upload with automatic audit logging
      const { data: uploadData, error: uploadError } = await SecurityLogger.secureFileUpload(
        file,
        'documents',
        filePath,
        {
          cacheControl: '3600',
          upsert: false
        }
      );

      if (uploadError) throw uploadError;

      updateProgress(50, 'uploading');

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required');
      }

      // Get user's company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        throw new Error('User profile or company not found');
      }

      // Create document record
      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert({
          filename: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: filePath,
          status: 'uploaded',
          user_id: user.id,
          company_id: profile.company_id
        })
        .select()
        .single();

      if (dbError) throw dbError;

      updateProgress(75, 'processing');

      // Process document with AI and log processing attempt
      await SecurityLogger.logFileAccess({
        file_id: documentData.id,
        file_path: filePath,
        action_type: 'process',
        metadata: { document_id: documentData.id, processing_stage: 'ai_analysis' }
      });

      const { error: functionError } = await supabase.functions.invoke('process-document', {
        body: { documentId: documentData.id }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        // Log processing failure
        await SecurityLogger.logFileAccess({
          file_id: documentData.id,
          file_path: filePath,
          action_type: 'process',
          success: false,
          error_message: functionError.message,
          metadata: { document_id: documentData.id, processing_stage: 'ai_analysis_failed' }
        });
        
        updateProgress(100, 'error');
        toast({
          title: "Upload completed",
          description: "Document uploaded but processing failed. You can retry processing later.",
          variant: "destructive",
        });
        return;
      }

      updateProgress(100, 'completed');
      
      toast({
        title: "Success",
        description: `${file.name} uploaded and processing started`,
      });

      onUploadSuccess?.();

    } catch (error) {
      console.error('Upload error:', error);
      updateProgress(0, 'error');
      throw error;
    }
  };

  const removeFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
  });

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <Card className="border-2 border-dashed">
        <CardContent className="p-8">
          <div
            {...getRootProps()}
            className={`text-center cursor-pointer transition-colors ${
              isDragActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {isDragActive ? 'Drop files here' : 'Upload Insurance Documents'}
            </h3>
            <p className="text-sm mb-4">
              Drag and drop multiple files here, or click to select files
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Upload multiple files at once • Supports PDF, Word (.docx, .doc), Excel (.xlsx, .xls) up to 10MB each
            </p>
            <Button variant="outline">
              Browse Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Uploading Files</h4>
          {uploadingFiles.map((uploadingFile) => (
            <Card key={uploadingFile.id}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadingFile.file.name}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress value={uploadingFile.progress} className="flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {uploadingFile.progress}%
                      </span>
                    </div>
                    {uploadingFile.status === 'error' && uploadingFile.error && (
                      <p className="text-xs text-destructive mt-1">
                        {uploadingFile.error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {uploadingFile.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadingFile.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;