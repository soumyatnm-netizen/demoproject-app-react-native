import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, Eye, TrendingUp, Users, Trash2, Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { reprocessQuote } from "@/utils/reprocessQuotes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StructuredQuote {
  id: string;
  insurer_name: string;
  product_type: string;
  premium_amount: number;
  premium_currency: string;
  quote_status: string;
  coverage_limits: any;
  deductible_amount: number;
  inclusions: string[];
  exclusions: string[];
  created_at: string;
  client_name?: string;
}

interface ComparisonViewProps {
  quotes: StructuredQuote[];
  onRefresh: () => void;
}

const ComparisonView = ({ quotes, onRefresh }: ComparisonViewProps) => {
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [filteredQuotes, setFilteredQuotes] = useState<StructuredQuote[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    // Get filtered quotes sorted by date (newest first)
    if (selectedClient) {
      const filtered = quotes
        .filter(quote => quote.client_name === selectedClient)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('Filtered quotes for', selectedClient, ':', filtered);
      setFilteredQuotes(filtered);
      setSelectedQuotes([]); // Reset selected quotes when client changes
    } else {
      setFilteredQuotes([]);
      setSelectedQuotes([]);
    }
  }, [selectedClient, quotes]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('client_reports')
        .select('client_name')
        .order('client_name');

      if (error) throw error;

      const uniqueClients = [...new Set(data.map(item => item.client_name))].filter(Boolean);
      console.log('Fetched clients:', uniqueClients);
      setClients(uniqueClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleQuoteSelection = (quoteId: string, selected: boolean) => {
    if (selected) {
      setSelectedQuotes(prev => [...prev, quoteId]);
    } else {
      setSelectedQuotes(prev => prev.filter(id => id !== quoteId));
    }
  };

  const generateComparison = async () => {
    if (selectedQuotes.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 quotes to compare",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-comparison', {
        body: { quoteIds: selectedQuotes }
      });

      if (error) throw error;

      setComparisonData(data);
      toast({
        title: "Success",
        description: "Comparison generated successfully",
      });
    } catch (error) {
      console.error('Comparison error:', error);
      toast({
        title: "Error",
        description: "Failed to generate comparison",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadQuote = async (quote: StructuredQuote) => {
    try {
      // First get the quote data with document_id
      const { data: quoteData, error: quoteError } = await supabase
        .from('structured_quotes')
        .select('document_id')
        .eq('id', quote.id)
        .single();

      if (quoteError) throw quoteError;

      if (!quoteData?.document_id) {
        throw new Error('No associated document found for this quote');
      }

      // Now get the document using the document_id from the quote
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', quoteData.document_id)
        .single();

      if (docError) throw docError;

      if (docData.storage_path) {
        // Download from Supabase storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(docData.storage_path);

        if (downloadError) throw downloadError;

        // Create download link
        const url = URL.createObjectURL(fileData);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = `${quote.insurer_name}_Quote_${quote.client_name || 'Document'}.${docData.filename.split('.').pop()}`;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Download Complete",
          description: `${quote.insurer_name} quote downloaded successfully`,
        });
      } else {
        throw new Error('No file available for download');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: `Could not download ${quote.insurer_name} quote: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const deleteQuote = async (quote: StructuredQuote) => {
    try {
      // First get the quote data with document_id
      const { data: quoteData, error: quoteError } = await supabase
        .from('structured_quotes')
        .select('document_id')
        .eq('id', quote.id)
        .single();

      if (quoteError) throw quoteError;

      if (!quoteData?.document_id) {
        throw new Error('No associated document found for this quote');
      }

      // Delete the quote record
      const { error: deleteQuoteError } = await supabase
        .from('structured_quotes')
        .delete()
        .eq('id', quote.id);

      if (deleteQuoteError) throw deleteQuoteError;

      // Delete the document record
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('id', quoteData.document_id);

      if (docError) throw docError;

      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([quoteData.document_id]);

      if (storageError) throw storageError;

      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });

      onRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote",
        variant: "destructive",
      });
    }
  };

  const deleteSelectedQuotes = async () => {
    try {
      const quotesToDelete = filteredQuotes.filter(quote => 
        selectedQuotes.includes(quote.id)
      );

      // Delete all selected quotes
      for (const quote of quotesToDelete) {
        // First get the quote data with document_id
        const { data: quoteData, error: fetchError } = await supabase
          .from('structured_quotes')
          .select('document_id')
          .eq('id', quote.id)
          .single();

        if (fetchError) throw fetchError;

        if (!quoteData?.document_id) {
          continue; // Skip if no document found
        }

        // Delete the quote record
        const { error: quoteError } = await supabase
          .from('structured_quotes')
          .delete()
          .eq('id', quote.id);

        if (quoteError) throw quoteError;

        // Delete the document record
        const { error: docError } = await supabase
          .from('documents')
          .delete()
          .eq('id', quoteData.document_id);

        if (docError) throw docError;

        // Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([quoteData.document_id]);

        if (storageError) throw storageError;
      }

      toast({
        title: "Success",
        description: `${quotesToDelete.length} quotes deleted successfully`,
      });

      // Clear selected quotes and refresh
      setSelectedQuotes([]);
      onRefresh();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete selected quotes",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const exportComparison = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('export-report', {
        body: {
          comparisonData,
          selectedQuotes: selectedQuotes.map(id => 
            filteredQuotes.find(q => q.id === id)
          ).filter(Boolean)
        }
      });

      if (error) throw error;

      // Create and download the file
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparison-report-${new Date().getTime()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Report exported successfully",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive",
      });
    }
  };

  if (quotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quote Comparison</CardTitle>
          <CardDescription>
            Compare coverage, limits, and terms across different insurers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Quotes Available</h3>
            <p className="text-muted-foreground">
              Upload and process some insurance documents to start comparing quotes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Client
          </CardTitle>
          <CardDescription>
            Choose a client to view their quotes for comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a client to view their quotes" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {clients.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              No clients found. Create client reports to see them here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quote Selection */}
      {selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle>Select Quotes to Compare</CardTitle>
            <CardDescription>
              Choose quotes for {selectedClient} for side-by-side comparison
            </CardDescription>
          </CardHeader>
        <CardContent>
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                No quotes found for {selectedClient}. Upload and process documents to generate quotes.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {filteredQuotes.map((quote) => (
              <Card 
                key={quote.id} 
                className={`cursor-pointer transition-colors ${
                  selectedQuotes.includes(quote.id) 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleQuoteSelection(
                  quote.id, 
                  !selectedQuotes.includes(quote.id)
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{quote.insurer_name}</h4>
                    <input 
                      type="checkbox" 
                      checked={selectedQuotes.includes(quote.id)}
                      onChange={() => {}} // Handled by card click
                      className="rounded"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {quote.product_type || 'General Insurance'}
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {quote.premium_currency} {quote.premium_amount?.toLocaleString() || 'N/A'}
                    </span>
                    <Badge 
                      variant={quote.quote_status === 'quoted' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {quote.quote_status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>Uploaded {formatDate(quote.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadQuote(quote);
                      }}
                      className="flex items-center space-x-1 h-7 px-2 flex-1"
                    >
                      <Download className="h-3 w-3" />
                      <span className="text-xs">Download</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          toast({
                            title: "Rescanning Quote",
                            description: "AI is extracting data from the document...",
                          });
                          const result = await reprocessQuote(quote.id);
                          toast({
                            title: "Rescan Complete!",
                            description: `Updated to: ${result.newInsurer}`,
                          });
                          onRefresh();
                        } catch (error) {
                          toast({
                            title: "Rescan Failed",
                            description: error.message,
                            variant: "destructive",
                          });
                        }
                      }}
                      className="flex items-center space-x-1 h-7 px-2 flex-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span className="text-xs">Rescan</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1 h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="text-xs">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this {quote.insurer_name} quote? This action cannot be undone and will permanently remove the quote and its associated file.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteQuote(quote)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Quote
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <Button 
              onClick={generateComparison}
              disabled={selectedQuotes.length < 2 || loading}
            >
              {loading ? 'Generating...' : 'Generate Comparison'}
            </Button>
            {selectedQuotes.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="default">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Selected Quotes</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedQuotes.length} selected quotes? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteSelectedQuotes}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <p className="text-sm text-muted-foreground">
              {selectedQuotes.length} quote{selectedQuotes.length !== 1 ? 's' : ''} selected
            </p>
          </div>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Comparison Results */}
      {comparisonData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Comparison Results</CardTitle>
                <CardDescription>
                  Side-by-side analysis of selected quotes
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={exportComparison}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Premium Comparison */}
              <div>
                <h4 className="font-semibold mb-3">Premium Comparison</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insurer</TableHead>
                      <TableHead>Premium</TableHead>
                      <TableHead>Deductible</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedQuotes.map(quoteId => {
                      const quote = filteredQuotes.find(q => q.id === quoteId);
                      if (!quote) return null;
                      return (
                        <TableRow key={quote.id}>
                          <TableCell className="font-medium">{quote.insurer_name}</TableCell>
                          <TableCell>
                            {quote.premium_currency} {quote.premium_amount?.toLocaleString() || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {quote.deductible_amount ? 
                              `${quote.premium_currency} ${quote.deductible_amount.toLocaleString()}` : 
                              'N/A'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={quote.quote_status === 'quoted' ? 'default' : 'secondary'}>
                              {quote.quote_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Coverage Analysis */}
              <div>
                <h4 className="font-semibold mb-3">Coverage Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Common Inclusions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1">
                        <li>• Property Damage</li>
                        <li>• Public Liability</li>
                        <li>• Employers Liability</li>
                        <li>• Business Interruption</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Key Differences</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1">
                        <li>• Cyber Coverage varies</li>
                        <li>• Different limits structure</li>
                        <li>• Policy extensions differ</li>
                        <li>• Territorial coverage varies</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Recommendations */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Recommendations
                </h4>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <ul className="text-sm space-y-2">
                    <li>• <strong>Best Value:</strong> Consider the middle-tier option for balanced coverage</li>
                    <li>• <strong>Coverage Gaps:</strong> Review cyber liability limits across all quotes</li>
                    <li>• <strong>Terms:</strong> Compare policy exclusions carefully before binding</li>
                    <li>• <strong>Market Position:</strong> Current pricing is competitive for this risk profile</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComparisonView;