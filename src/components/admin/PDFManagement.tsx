import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Link, FileText, Database, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useDropzone } from "react-dropzone";

interface PDFDocument {
  id: string;
  underwriter_name: string;
  filename: string;
  file_type: string;
  status: string;
  source_url: string | null;
  created_at: string;
  processing_error: string | null;
}

interface PDFManagementProps {
  onStatsUpdate: () => void;
}

const PDFManagement = ({ onStatsUpdate }: PDFManagementProps) => {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [underwriterName, setUnderwriterName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('underwriter_appetites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load PDF documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (!underwriterName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an underwriter name",
        variant: "destructive",
      });
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `underwriter-appetites/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: insertError } = await supabase
        .from('underwriter_appetites')
        .insert({
          underwriter_name: underwriterName,
          filename: file.name,
          file_type: file.type,
          storage_path: filePath,
          file_size: file.size,
          uploaded_by: user.id,
          status: 'uploaded'
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "PDF uploaded successfully and queued for processing",
      });

      setShowUploadDialog(false);
      setUnderwriterName("");
      fetchDocuments();
      onStatsUpdate();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload PDF",
        variant: "destructive",
      });
    }
  };

  const handleUrlUpload = async () => {
    if (!underwriterName.trim() || !sourceUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter both underwriter name and URL",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('underwriter_appetites')
        .insert({
          underwriter_name: underwriterName,
          filename: sourceUrl.split('/').pop() || 'Remote PDF',
          file_type: 'application/pdf',
          storage_path: '',
          source_url: sourceUrl,
          uploaded_by: user.id,
          status: 'uploaded'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "PDF URL added successfully and queued for processing",
      });

      setShowUploadDialog(false);
      setUnderwriterName("");
      setSourceUrl("");
      fetchDocuments();
      onStatsUpdate();
    } catch (error) {
      console.error('Error adding URL:', error);
      toast({
        title: "Error",
        description: "Failed to add PDF URL",
        variant: "destructive",
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const handleDelete = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('underwriter_appetites')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "PDF document deleted successfully",
      });

      fetchDocuments();
      onStatsUpdate();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Failed to delete PDF document",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">PDF Management</h2>
          <p className="text-muted-foreground">Upload and manage insurer appetite guides and PDFs</p>
        </div>
        
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload PDF
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Insurer PDF</DialogTitle>
              <DialogDescription>
                Upload PDF documents or provide URLs for insurer appetite guides
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="underwriter_name">Underwriter/Insurer Name</Label>
                <Input
                  id="underwriter_name"
                  value={underwriterName}
                  onChange={(e) => setUnderwriterName(e.target.value)}
                  placeholder="e.g., Lloyds of London, AXA, Zurich"
                />
              </div>

              <div className="flex space-x-4">
                <Button
                  variant={uploadMethod === 'file' ? 'default' : 'outline'}
                  onClick={() => setUploadMethod('file')}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  variant={uploadMethod === 'url' ? 'default' : 'outline'}
                  onClick={() => setUploadMethod('url')}
                  className="flex-1"
                >
                  <Link className="h-4 w-4 mr-2" />
                  Add URL
                </Button>
              </div>

              {uploadMethod === 'file' && (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                >
                  <input {...getInputProps()} />
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {isDragActive ? (
                    <p>Drop the PDF file here...</p>
                  ) : (
                    <div>
                      <p className="text-lg font-medium">Drop PDF file here, or click to select</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Supports PDF files up to 10MB
                      </p>
                    </div>
                  )}
                </div>
              )}

              {uploadMethod === 'url' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="source_url">PDF URL</Label>
                    <Input
                      id="source_url"
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://example.com/appetite-guide.pdf"
                    />
                  </div>
                  <Button onClick={handleUrlUpload} className="w-full">
                    Add PDF URL
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded PDF Documents</CardTitle>
          <CardDescription>
            Manage insurer appetite guides and extract data using AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Underwriter</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="font-medium">{doc.underwriter_name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[200px]">{doc.filename}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {doc.source_url ? (
                      <Badge variant="outline">URL</Badge>
                    ) : (
                      <Badge variant="outline">Upload</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        doc.status === 'processed' ? 'default' :
                        doc.status === 'processing' ? 'secondary' :
                        doc.status === 'failed' ? 'destructive' : 'outline'
                      }
                    >
                      {doc.status}
                    </Badge>
                    {doc.processing_error && (
                      <div className="text-xs text-destructive mt-1">
                        {doc.processing_error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Database className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PDFManagement;