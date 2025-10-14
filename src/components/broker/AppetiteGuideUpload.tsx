import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

type CoverageCategory = 'tech-life-sciences' | 'commercial-combined' | 'cyber' | 'other';

interface AppetiteGuideUploadProps {
  onUploadComplete?: () => void;
}

interface UploadStatus {
  uploading: boolean;
  processing: boolean;
  success: boolean;
  error: string | null;
  progress: number;
}

const AppetiteGuideUpload = ({ onUploadComplete }: AppetiteGuideUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [underwriterName, setUnderwriterName] = useState("");
  const [category, setCategory] = useState<CoverageCategory>('other');
  const [logoUrl, setLogoUrl] = useState("");
  const [status, setStatus] = useState<UploadStatus>({
    uploading: false,
    processing: false,
    success: false,
    error: null,
    progress: 0,
  });
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file",
          variant: "destructive",
        });
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) { // 20MB limit
        toast({
          title: "File too large",
          description: "File size must be less than 20MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setStatus({ uploading: false, processing: false, success: false, error: null, progress: 0 });
    }
  };

  const handleUpload = async () => {
    if (!file || !underwriterName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a file and underwriter name",
        variant: "destructive",
      });
      return;
    }

    try {
      setStatus({ uploading: true, processing: false, success: false, error: null, progress: 10 });

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      setStatus(prev => ({ ...prev, progress: 20 }));

      // Create a unique file path
      const timestamp = Date.now();
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/appetite-guides/${timestamp}_${sanitizedFilename}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setStatus(prev => ({ ...prev, progress: 40, uploading: false }));

      // Create appetite guide record
      const { data: appetiteRecord, error: insertError } = await supabase
        .from('underwriter_appetites')
        .insert({
          underwriter_name: underwriterName.trim(),
          filename: file.name,
          file_type: 'application/pdf',
          storage_path: filePath,
          file_size: file.size,
          uploaded_by: user.id,
          status: 'uploaded',
          document_type: 'appetite_guide',
          coverage_category: category,
          logo_url: logoUrl.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setStatus(prev => ({ ...prev, progress: 60, processing: true }));

      // Process the document with AI
      const { error: processError } = await supabase.functions.invoke('process-appetite-document', {
        body: { appetiteDocumentId: appetiteRecord.id },
      });

      if (processError) {
        console.error('Processing error:', processError);
        toast({
          title: "Processing queued",
          description: "Document uploaded successfully. Processing may take a few moments.",
        });
      }

      setStatus({ uploading: false, processing: false, success: true, error: null, progress: 100 });

      toast({
        title: "Success!",
        description: `Appetite guide for ${underwriterName} uploaded and processing started`,
      });

      // Reset form
      setTimeout(() => {
        setFile(null);
        setUnderwriterName("");
        setCategory('other');
        setLogoUrl("");
        setStatus({ uploading: false, processing: false, success: false, error: null, progress: 0 });
        
        // Call the callback to refresh the guides list
        if (onUploadComplete) {
          onUploadComplete();
        }
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setStatus({
        uploading: false,
        processing: false,
        success: false,
        error: (error as Error).message,
        progress: 0,
      });
      toast({
        title: "Upload failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const isProcessing = status.uploading || status.processing;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Appetite Guide
        </CardTitle>
        <CardDescription>
          Upload underwriter appetite guides to make them available for matching
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="file-upload">PDF Document</Label>
          <div className="flex items-center gap-2">
            <Input
              id="file-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="flex-1"
            />
            {file && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name}
            </p>
          )}
        </div>

        {/* Underwriter Name */}
        <div className="space-y-2">
          <Label htmlFor="underwriter-name">Underwriter Name *</Label>
          <Input
            id="underwriter-name"
            placeholder="e.g., Hiscox, AXA, Allianz"
            value={underwriterName}
            onChange={(e) => setUnderwriterName(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Coverage Category */}
        <div className="space-y-2">
          <Label htmlFor="category">Coverage Category</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as CoverageCategory)} disabled={isProcessing}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tech-life-sciences">Tech and Life Sciences</SelectItem>
              <SelectItem value="commercial-combined">Commercial Combined</SelectItem>
              <SelectItem value="cyber">Cyber</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logo URL (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="logo-url">Logo URL (Optional)</Label>
          <Input
            id="logo-url"
            type="url"
            placeholder="https://example.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Progress Bar */}
        {(isProcessing || status.success) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {status.uploading && "Uploading file..."}
                {status.processing && "Processing with AI..."}
                {status.success && "Complete!"}
              </span>
              <span className="font-medium">{status.progress}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>
        )}

        {/* Status Messages */}
        {status.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{status.error}</span>
          </div>
        )}

        {status.success && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Appetite guide uploaded successfully!</span>
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!file || !underwriterName.trim() || isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {status.uploading ? "Uploading..." : "Processing..."}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Appetite Guide
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Maximum file size: 20MB. Only PDF files are supported.
        </p>
      </CardContent>
    </Card>
  );
};

export default AppetiteGuideUpload;
