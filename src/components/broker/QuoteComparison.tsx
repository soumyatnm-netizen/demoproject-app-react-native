import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, FileText, Download, History, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
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

interface ComparisonData {
  insurer: string;
  premium: number;
  coverage: number;
  deductible: number;
  score: number;
}

interface SavedComparison {
  id: string;
  name: string;
  description: string;
  client_name: string;
  quote_ids: string[];
  comparison_data: any;
  created_at: string;
  updated_at: string;
}

const QuoteComparison = () => {
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([]);
  const [viewingComparison, setViewingComparison] = useState<SavedComparison | null>(null);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchSavedComparisons();
  }, []);

  const fetchSavedComparisons = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('comparisons')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedComparisons(data || []);
    } catch (error) {
      console.error('Error fetching saved comparisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewSavedComparison = async (comparison: SavedComparison) => {
    setViewingComparison(comparison);

    // ALWAYS prefer comparison_data if it exists and has content
    if (comparison.comparison_data && Array.isArray(comparison.comparison_data) && comparison.comparison_data.length > 0) {
      console.log('[viewSavedComparison] Using saved comparison_data:', comparison.comparison_data);
      setComparisonData(comparison.comparison_data);
      return;
    }

    console.log('[viewSavedComparison] No comparison_data, trying to rebuild from quote_ids:', comparison.quote_ids);

    // Otherwise try to rebuild from the stored IDs (supports both quote IDs and document IDs)
    try {
      // First: treat saved IDs as structured_quote IDs
      let { data: sqById, error: errById } = await supabase
        .from('structured_quotes')
        .select('*')
        .in('id', comparison.quote_ids);

      if (errById) console.warn('[viewSavedComparison] sqById error:', errById);

      // If nothing, try interpreting them as document_ids
      if (!sqById || sqById.length === 0) {
        console.log('[viewSavedComparison] No results by ID, trying by document_id');
        const { data: sqByDoc, error: errByDoc } = await supabase
          .from('structured_quotes')
          .select('*')
          .in('document_id', comparison.quote_ids);
        if (errByDoc) console.warn('[viewSavedComparison] sqByDoc error:', errByDoc);
        sqById = sqByDoc || [];
      }

      if (!sqById || sqById.length === 0) {
        console.error('[viewSavedComparison] No quotes found in database');
        setComparisonData([]);
        toast({
          title: "Cannot Load Comparison",
          description: "The quotes for this comparison are not accessible.",
          variant: "destructive",
        });
        return;
      }

      // Build comparison data
      const comparisonRows: ComparisonData[] = sqById.map((quote: any) => {
        const coverageScore = Math.min(100, (Number(quote.premium_amount) / 10000) * 100);
        const premiumScore = Math.max(0, 100 - (Number(quote.premium_amount) / 1000));
        const overallScore = (premiumScore + coverageScore) / 2;
        return {
          insurer: quote.insurer_name,
          premium: Number(quote.premium_amount) || 0,
          coverage: Math.floor(coverageScore),
          deductible: Number(quote.deductible_amount) || 0,
          score: Math.floor(overallScore)
        };
      });

      setComparisonData(comparisonRows);
    } catch (e) {
      console.error('[viewSavedComparison] rebuild error:', e);
      setComparisonData([]);
      toast({
        title: "Error",
        description: "Failed to load comparison data",
        variant: "destructive",
      });
    }
  };

  const deleteSavedComparison = async (comparisonId: string) => {
    try {
      const { error } = await supabase
        .from('comparisons')
        .delete()
        .eq('id', comparisonId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comparison deleted successfully",
      });

      fetchSavedComparisons();
      if (viewingComparison?.id === comparisonId) {
        setViewingComparison(null);
        setComparisonData([]);
      }
    } catch (error) {
      console.error('Error deleting comparison:', error);
      toast({
        title: "Error",
        description: "Failed to delete comparison",
        variant: "destructive",
      });
    }
  };

  const downloadComparisonPDF = async (comparison: SavedComparison) => {
    try {
      const { data, error } = await supabase.functions.invoke('export-report', {
        body: {
          comparisonData: comparison.comparison_data,
          format: 'pdf'
        }
      });

      if (error) throw error;

      // Create download link
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to download PDF",
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
      <div>
        <h2 className="text-2xl font-bold">Recent Comparisons</h2>
        <p className="text-muted-foreground">View your saved quote comparisons</p>
      </div>

      {/* Recent Comparisons Content */}
      {savedComparisons.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No saved comparisons</h3>
            <p className="text-muted-foreground">
              Your saved comparisons will appear here automatically when you generate comparisons from Instant Comparison
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Saved Comparisons</CardTitle>
            <CardDescription>
              View and download your previous quote comparisons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Filter by client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {[...new Set(savedComparisons.map(c => c.client_name))].map((clientName) => (
                    <SelectItem key={clientName} value={clientName}>
                      {clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              {savedComparisons
                .filter(comparison => 
                  selectedClientFilter === "all" || comparison.client_name === selectedClientFilter
                )
                .map((comparison) => (
                <div key={comparison.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium">{comparison.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {comparison.client_name} • {comparison.quote_ids.length} quotes
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(comparison.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewSavedComparison(comparison)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadComparisonPDF(comparison)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Comparison</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this comparison? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSavedComparison(comparison.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Viewing Comparison Details */}
      {viewingComparison && comparisonData.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Premium Comparison - {viewingComparison.name}</span>
              </CardTitle>
              <CardDescription>Visual comparison of premium amounts</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="insurer" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`£${value.toLocaleString()}`, 'Premium']}
                  />
                  <Bar dataKey="premium" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Detailed Comparison</span>
              </CardTitle>
              <CardDescription>Side-by-side comparison of all quote features</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insurer</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Deductible</TableHead>
                    <TableHead>Coverage Score</TableHead>
                    <TableHead>Overall Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((item) => (
                    <TableRow key={item.insurer}>
                      <TableCell className="font-medium">{item.insurer}</TableCell>
                      <TableCell>£{item.premium.toLocaleString()}</TableCell>
                      <TableCell>£{item.deductible.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={item.coverage > 80 ? "default" : item.coverage > 60 ? "secondary" : "destructive"}>
                          {item.coverage}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.score > 80 ? "default" : item.score > 60 ? "secondary" : "destructive"}>
                          {item.score}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default QuoteComparison;
