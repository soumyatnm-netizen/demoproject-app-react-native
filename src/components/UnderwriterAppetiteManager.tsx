import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Download, Plus, ExternalLink, AlertCircle, CheckCircle, Building2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { CategoryCombobox } from "./broker/CategoryCombobox";
import { BatchProcessAppetites } from "./broker/BatchProcessAppetites";

interface UnderwriterAppetite {
  id: string;
  underwriter_name: string;
  document_type: string;
  filename: string;
  source_url?: string;
  status: string;
  processing_error?: string;
  logo_url?: string;
  created_at: string;
}

interface UnderwriterAppetiteData {
  id: string;
  underwriter_name: string;
  financial_ratings: any;
  coverage_limits: any;
  target_sectors: string[];
  geographic_coverage: string[];
  policy_features: any;
  specialty_focus: string[];
  risk_appetite: string;
}

const UnderwriterAppetiteManager = () => {
  const [appetiteDocuments, setAppetiteDocuments] = useState<UnderwriterAppetite[]>([]);
  const [appetiteData, setAppetiteData] = useState<UnderwriterAppetiteData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newUnderwriter, setNewUnderwriter] = useState({
    name: "",
    documentType: "appetite_guide",
    sourceUrl: "",
    logoUrl: "",
    coverageCategory: "Other"
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAppetiteData();
  }, []);

  const fetchAppetiteData = async () => {
    try {
      // Fetch appetite documents
      const { data: appetiteDocsData, error: appetiteDocsError } = await supabase
        .from('underwriter_appetites')
        .select('*')
        .order('created_at', { ascending: false });

      if (appetiteDocsError) throw appetiteDocsError;

      // Fetch structured appetite data
      const { data: structuredData, error: structuredError } = await supabase
        .from('underwriter_appetite_data')
        .select('*')
        .order('created_at', { ascending: false });

      if (structuredError) throw structuredError;

      setAppetiteDocuments(appetiteDocsData || []);
      setAppetiteData(structuredData || []);
    } catch (error) {
      console.error('Error fetching appetite data:', error);
      toast({
        title: "Error",
        description: "Failed to load underwriter appetite data",
        variant: "destructive",
      });
    }
  };

  const uploadFile = async (file: File) => {
    if (!newUnderwriter.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter the underwriter name first",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, is_super_admin')
        .eq('user_id', user.id)
        .maybeSingle();
      const companyId = profile?.company_id ?? null;
      const isSuperAdmin = profile?.is_super_admin === true;
      if (!companyId && !isSuperAdmin) {
        toast({
          title: 'Company required',
          description: 'Please create or join a company before uploading appetite guides.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${newUnderwriter.name.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
      const filePath = `appetite-guides/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert record in database
      const { data: appetiteDoc, error: dbError } = await supabase
        .from('underwriter_appetites')
        .insert({
          underwriter_name: newUnderwriter.name,
          document_type: newUnderwriter.documentType,
          filename: file.name,
          storage_path: filePath,
          source_url: newUnderwriter.sourceUrl || null,
          logo_url: newUnderwriter.logoUrl || null,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
          coverage_category: newUnderwriter.coverageCategory,
          company_id: companyId
        })
        .select()
        .maybeSingle();

      if (dbError) throw dbError;

      // Process the document
      const { error: processError } = await supabase.functions.invoke('process-appetite-document', {
        body: { appetiteDocumentId: appetiteDoc.id }
      });

      if (processError) {
        console.error('Processing error:', processError);
        toast({
          title: "Upload Successful",
          description: "Document uploaded but processing may have issues. Check status.",
        });
      } else {
        toast({
          title: "Success",
          description: "Underwriter appetite document uploaded and processing started",
        });
      }

      // Reset form
      setNewUnderwriter({ name: "", documentType: "appetite_guide", sourceUrl: "", logoUrl: "", coverageCategory: "Other" });
      fetchAppetiteData();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const processUrlDocument = async () => {
    if (!newUnderwriter.name.trim() || !newUnderwriter.sourceUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter both underwriter name and source URL",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, is_super_admin')
        .eq('user_id', user.id)
        .maybeSingle();
      const companyId = profile?.company_id ?? null;
      const isSuperAdmin = profile?.is_super_admin === true;
      if (!companyId && !isSuperAdmin) {
        toast({
          title: 'Company required',
          description: 'Please create or join a company before adding URLs.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Insert record in database with URL
      const { data: appetiteDoc, error: dbError } = await supabase
        .from('underwriter_appetites')
        .insert({
          underwriter_name: newUnderwriter.name,
          document_type: newUnderwriter.documentType,
          filename: `Web Document - ${newUnderwriter.name}`,
          storage_path: '', // Empty for URL-based documents
          source_url: newUnderwriter.sourceUrl,
          logo_url: newUnderwriter.logoUrl || null,
          file_type: 'web/url',
          uploaded_by: user.id,
          coverage_category: newUnderwriter.coverageCategory,
          company_id: companyId
        })
        .select()
        .maybeSingle();

      if (dbError) throw dbError;

      // Process the URL
      const { error: processError } = await supabase.functions.invoke('process-appetite-document', {
        body: { appetiteDocumentId: appetiteDoc.id }
      });

      if (processError) {
        console.error('Processing error:', processError);
        toast({
          title: "Added Successfully", 
          description: "URL added but processing may have issues. Check status.",
        });
      } else {
        toast({
          title: "Success",
          description: "Underwriter URL added and processing started",
        });
      }

      // Reset form
      setNewUnderwriter({ name: "", documentType: "appetite_guide", sourceUrl: "", logoUrl: "", coverageCategory: "Other" });
      fetchAppetiteData();

    } catch (error) {
      console.error('URL processing error:', error);
      toast({
        title: "Error",
        description: "Failed to process URL",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        uploadFile(acceptedFiles[0]);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: uploading
  });

  return (
    <div className="space-y-6">
      {/* AI Batch Processing Scanner */}
      <BatchProcessAppetites />

      {/* Upload New Appetite Document */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Underwriter Appetite
          </CardTitle>
          <CardDescription>
            Upload appetite guides, product brochures, or add web links from underwriters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="underwriter-name">Underwriter Name *</Label>
              <Input
                id="underwriter-name"
                placeholder="e.g., Lloyd's of London, AXA, Zurich"
                value={newUnderwriter.name}
                onChange={(e) => setNewUnderwriter(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-type">Document Type</Label>
              <Select 
                value={newUnderwriter.documentType} 
                onValueChange={(value) => setNewUnderwriter(prev => ({ ...prev, documentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appetite_guide">Appetite Guide</SelectItem>
                  <SelectItem value="product_brochure">Product Brochure</SelectItem>
                  <SelectItem value="terms_conditions">Terms & Conditions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverage-category">Coverage Category</Label>
            <CategoryCombobox
              value={newUnderwriter.coverageCategory}
              onValueChange={(value) => setNewUnderwriter(prev => ({ ...prev, coverageCategory: value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-url">Source URL (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="source-url"
                placeholder="https://example.com/appetite-guide.pdf"
                value={newUnderwriter.sourceUrl}
                onChange={(e) => setNewUnderwriter(prev => ({ ...prev, sourceUrl: e.target.value }))}
              />
              <Button 
                onClick={processUrlDocument} 
                disabled={uploading || !newUnderwriter.name.trim() || !newUnderwriter.sourceUrl.trim()}
                variant="outline"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Process URL
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-url">Logo URL (Optional)</Label>
            <Input
              id="logo-url"
              placeholder="https://example.com/logo.png"
              value={newUnderwriter.logoUrl}
              onChange={(e) => setNewUnderwriter(prev => ({ ...prev, logoUrl: e.target.value }))}
            />
          </div>

          <div className="border-t pt-4">
            <Label>Or Upload Document</Label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {uploading ? (
                <p className="text-sm text-muted-foreground">Uploading and processing...</p>
              ) : isDragActive ? (
                <p className="text-sm text-primary">Drop the document here...</p>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Drag & drop a document here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, DOC, DOCX, TXT files
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Appetite Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Underwriter Appetite Documents</CardTitle>
          <CardDescription>
            Manage uploaded appetite guides and their processed data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appetiteDocuments.map((doc) => {
              const processedData = appetiteData.find(data => data.id === doc.id);
              
              return (
                <div key={doc.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3">
                    {doc.logo_url ? (
                      <img 
                        src={doc.logo_url} 
                        alt={`${doc.underwriter_name} logo`}
                        className="w-12 h-12 object-contain bg-white rounded border p-1"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Building2 className="h-12 w-12 text-muted-foreground mt-0.5 p-2 bg-muted rounded border" />
                    )}
                    <div>
                      <h4 className="font-medium">{doc.underwriter_name}</h4>
                      <p className="text-sm text-muted-foreground">{doc.filename}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {doc.document_type.replace('_', ' ')}
                        </Badge>
                        {doc.source_url && (
                          <a 
                            href={doc.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                    <Badge 
                      variant={
                        doc.status === 'processed' ? 'default' : 
                        doc.status === 'processing' ? 'secondary' : 
                        doc.status === 'error' ? 'destructive' : 'outline'
                      }
                      className="flex items-center gap-1"
                    >
                      {doc.status === 'processed' && <CheckCircle className="h-3 w-3" />}
                      {doc.status === 'error' && <AlertCircle className="h-3 w-3" />}
                      {doc.status}
                    </Badge>
                  </div>
                  
                  {doc.processing_error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded p-2 mb-3">
                      <p className="text-sm text-destructive">{doc.processing_error}</p>
                    </div>
                  )}
                  
                  {processedData && (
                    <div className="bg-muted/50 rounded p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {processedData.target_sectors && processedData.target_sectors.length > 0 && (
                          <div>
                            <span className="font-medium">Target Sectors:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {processedData.target_sectors.slice(0, 3).map((sector, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {sector}
                                </Badge>
                              ))}
                              {processedData.target_sectors.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{processedData.target_sectors.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {processedData.specialty_focus && processedData.specialty_focus.length > 0 && (
                          <div>
                            <span className="font-medium">Specialty Focus:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {processedData.specialty_focus.map((focus, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {focus}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {processedData.risk_appetite && (
                          <div>
                            <span className="font-medium">Risk Appetite:</span>
                            <Badge 
                              variant={
                                processedData.risk_appetite === 'aggressive' ? 'destructive' :
                                processedData.risk_appetite === 'moderate' ? 'default' : 'secondary'
                              } 
                              className="ml-2 text-xs"
                            >
                              {processedData.risk_appetite}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
                    <span>Added {new Date(doc.created_at).toLocaleDateString()}</span>
                    {doc.status === 'processed' && processedData && (
                      <span className="text-green-600">✓ Data extracted successfully</span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {appetiteDocuments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No underwriter appetite documents uploaded yet</p>
                <p className="text-sm">Upload appetite guides to start matching clients with underwriters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnderwriterAppetiteManager;
