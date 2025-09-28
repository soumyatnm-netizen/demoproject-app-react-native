import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Download, Search, Filter, Archive, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size?: number;
  storage_path: string;
  status: string;
  created_at: string;
  source: 'client_document' | 'underwriter_appetite';
  underwriter_name?: string;
  source_url?: string;
  client_name?: string;
}

const DocumentManagement = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('structured_quotes')
        .select('client_name')
        .not('client_name', 'is', null);

      if (error) throw error;

      const uniqueClients = [...new Set(data?.map(item => item.client_name).filter(Boolean))] as string[];
      setClients(uniqueClients.sort());
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // Fetch client documents with client associations
      const { data: clientDocs, error: clientError } = await supabase
        .from('documents')
        .select(`
          *,
          structured_quotes!inner(client_name)
        `)
        .order('created_at', { ascending: false });

      if (clientError) throw clientError;

      // Fetch underwriter documents
      const { data: underwriterDocs, error: underwriterError } = await supabase
        .from('underwriter_appetites')
        .select('*')
        .order('created_at', { ascending: false });

      if (underwriterError) throw underwriterError;

      // Combine and format documents
      const allDocuments: Document[] = [
        ...(clientDocs || []).map(doc => ({
          ...doc,
          source: 'client_document' as const,
          client_name: doc.structured_quotes?.[0]?.client_name
        })),
        ...(underwriterDocs || []).map(doc => ({
          ...doc,
          source: 'underwriter_appetite' as const
        }))
      ];

      setDocuments(allDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      if (document.source_url) {
        // For URL-based documents, open in new tab
        window.open(document.source_url, '_blank');
        return;
      }

      if (!document.storage_path) {
        toast({
          title: "Error",
          description: "No file path available for download",
          variant: "destructive",
        });
        return;
      }

      // Download from Supabase storage
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Document downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleArchiveDocument = async (document: Document) => {
    try {
      const table = document.source === 'client_document' ? 'documents' : 'underwriter_appetites';
      
      const { error } = await supabase
        .from(table)
        .update({ status: 'archived' })
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document archived successfully",
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error archiving document:', error);
      toast({
        title: "Error",
        description: "Failed to archive document",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    try {
      const table = document.source === 'client_document' ? 'documents' : 'underwriter_appetites';
      
      // Delete the record from database
      const { error: dbError } = await supabase
        .from(table)
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      // Delete the file from storage if it exists
      if (document.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.storage_path]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      }

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'uploaded':
        return 'outline';
      case 'failed':
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.underwriter_name && doc.underwriter_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.client_name && doc.client_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || doc.source === sourceFilter;
    const matchesClient = clientFilter === 'all' || doc.client_name === clientFilter;

    return matchesSearch && matchesStatus && matchesSource && matchesClient;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Document Management</h2>
        <p className="text-muted-foreground">Access and download your uploaded documents</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="client_document">Client Documents</SelectItem>
                  <SelectItem value="underwriter_appetite">Underwriter PDFs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
          <CardDescription>
            All your uploaded documents with download access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={`${doc.source}-${doc.id}`}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium truncate max-w-[200px]" title={doc.filename}>
                          {doc.filename}
                        </div>
                        {doc.underwriter_name && (
                          <div className="text-xs text-muted-foreground">
                            {doc.underwriter_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {doc.file_type?.split('/')?.pop()?.toUpperCase() || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={doc.source === 'client_document' ? 'default' : 'secondary'}>
                      {doc.source === 'client_document' ? 'Client Doc' : 'Underwriter PDF'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(doc.status)}>
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatFileSize(doc.file_size)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(doc)}
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Archive className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive Document</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to archive "{doc.filename}"? This will mark it as archived but keep it accessible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleArchiveDocument(doc)}>
                              Archive
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Document</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete "{doc.filename}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteDocument(doc)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredDocuments.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No documents found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' || clientFilter !== 'all'
                  ? 'Try adjusting your filters to find documents.'
                  : 'Upload some documents to get started.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentManagement;