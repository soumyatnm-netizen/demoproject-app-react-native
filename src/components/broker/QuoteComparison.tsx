import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Shield, FileText, Download, Mail, Target, History, Eye, Trash2 } from "lucide-react";
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

interface Quote {
  id: string;
  insurer_name: string;
  product_type: string;
  premium_amount: number;
  premium_currency: string;
  coverage_limits: any;
  deductible_amount: number;
  inclusions: string[];
  exclusions: string[];
  quote_status: string;
  created_at: string;
  client_name?: string;
}

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
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([]);
  const [viewingComparison, setViewingComparison] = useState<SavedComparison | null>(null);
  const [activeTab, setActiveTab] = useState("new");
  const { toast } = useToast();

  useEffect(() => {
    fetchQuotes();
    fetchSavedComparisons();
  }, []);

  useEffect(() => {
    if (selectedQuotes.length > 0) {
      generateComparison();
    }
  }, [selectedQuotes]);

  const fetchQuotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('structured_quotes')
        .select('*')
        .eq('user_id', user.id)
        .eq('quote_status', 'quoted')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast({
        title: "Error",
        description: "Failed to load quotes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const generateComparison = () => {
    const selectedQuoteData = quotes.filter(q => selectedQuotes.includes(q.id));
    
    const comparison = selectedQuoteData.map(quote => {
      // Calculate coverage score (mock calculation)
      const coverageScore = Math.min(100, (quote.premium_amount / 10000) * 100);
      
      // Calculate overall score based on premium competitiveness and coverage
      const premiumScore = Math.max(0, 100 - (quote.premium_amount / 1000));
      const overallScore = (premiumScore + coverageScore) / 2;

      return {
        insurer: quote.insurer_name,
        premium: quote.premium_amount,
        coverage: Math.floor(coverageScore),
        deductible: quote.deductible_amount || 0,
        score: Math.floor(overallScore)
      };
    });

    setComparisonData(comparison);
  };

  const handleQuoteSelection = (quoteId: string, selected: boolean) => {
    if (selected) {
      if (selectedQuotes.length < 5) {
        setSelectedQuotes([...selectedQuotes, quoteId]);
      } else {
        toast({
          title: "Selection Limit",
          description: "You can compare up to 5 quotes at a time",
          variant: "destructive",
        });
      }
    } else {
      setSelectedQuotes(selectedQuotes.filter(id => id !== quoteId));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const saveComparison = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const selectedQuoteData = quotes.filter(q => selectedQuotes.includes(q.id));
      const clientName = selectedQuoteData[0]?.client_name || 'Unknown Client';

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase
        .from('comparisons')
        .insert([{
          user_id: user.id,
          company_id: profile?.company_id,
          name: `Comparison - ${clientName}`,
          description: `Comparison of ${selectedQuotes.length} quotes`,
          client_name: clientName,
          quote_ids: selectedQuotes,
          comparison_data: comparisonData as any,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comparison saved successfully",
      });

      fetchSavedComparisons();
    } catch (error) {
      console.error('Error saving comparison:', error);
      toast({
        title: "Error",
        description: "Failed to save comparison",
        variant: "destructive",
      });
    }
  };

  const viewSavedComparison = (comparison: SavedComparison) => {
    setViewingComparison(comparison);
    setComparisonData(comparison.comparison_data);
    setSelectedQuotes(comparison.quote_ids);
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
        <h2 className="text-2xl font-bold">Quote Comparison</h2>
        <p className="text-muted-foreground">Compare multiple quotes side-by-side to find the best value</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new">New Comparison</TabsTrigger>
          <TabsTrigger value="recent">
            <History className="h-4 w-4 mr-2" />
            Recent Comparisons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 mt-6">

      {/* Quote Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Select Quotes to Compare</span>
          </CardTitle>
          <CardDescription>
            Choose up to 5 quotes for detailed comparison ({selectedQuotes.length}/5 selected)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {quotes.map((quote) => (
              <div key={quote.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  checked={selectedQuotes.includes(quote.id)}
                  onChange={(e) => handleQuoteSelection(quote.id, e.target.checked)}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{quote.insurer_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {quote.product_type} • {formatCurrency(quote.premium_amount, quote.premium_currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">
                        {new Date(quote.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparisonData.length > 0 && (
        <>
          {/* Premium Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Premium Comparison</span>
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

          {/* Detailed Comparison Table */}
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((item) => (
                    <TableRow key={item.insurer}>
                      <TableCell className="font-medium">{item.insurer}</TableCell>
                      <TableCell>£{item.premium.toLocaleString()}</TableCell>
                      <TableCell>£{item.deductible.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className={`inline-flex px-2 py-1 rounded text-sm font-medium ${getScoreColor(item.coverage)}`}>
                          {item.coverage}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex px-2 py-1 rounded text-sm font-medium ${getScoreColor(item.score)}`}>
                          {item.score}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Coverage Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Best Value</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const bestValue = comparisonData.reduce((best, current) => 
                    current.score > best.score ? current : best
                  );
                  return (
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-green-600">{bestValue.insurer}</h3>
                      <p className="text-muted-foreground">Overall Score: {bestValue.score}%</p>
                      <p className="text-lg font-medium mt-2">£{bestValue.premium.toLocaleString()}</p>
                      <Button className="mt-4">Select This Quote</Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Lowest Premium</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const lowestPremium = comparisonData.reduce((lowest, current) => 
                    current.premium < lowest.premium ? current : lowest
                  );
                  return (
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-blue-600">{lowestPremium.insurer}</h3>
                      <p className="text-muted-foreground">Lowest Cost Option</p>
                      <p className="text-lg font-medium mt-2">£{lowestPremium.premium.toLocaleString()}</p>
                      <Button variant="outline" className="mt-4">View Details</Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>Export Comparison</CardTitle>
              <CardDescription>Share this comparison with your client</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Button onClick={saveComparison}>
                  <FileText className="h-4 w-4 mr-2" />
                  Save Comparison
                </Button>
                <Button onClick={() => downloadComparisonPDF({ 
                  id: '', 
                  name: '', 
                  description: '', 
                  client_name: '', 
                  quote_ids: selectedQuotes, 
                  comparison_data: comparisonData,
                  created_at: '',
                  updated_at: ''
                })}>
                  <Download className="h-4 w-4 mr-2" />
                  Export to PDF
                </Button>
                <Button variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Email to Client
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedQuotes.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No quotes selected</h3>
            <p className="text-muted-foreground">
              Select at least 2 quotes from the list above to start comparing.
            </p>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="recent" className="space-y-6 mt-6">
          {savedComparisons.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No saved comparisons</h3>
                <p className="text-muted-foreground">
                  Your saved comparisons will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Saved Comparisons</CardTitle>
                  <CardDescription>
                    View and download your previous quote comparisons
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {savedComparisons.map((comparison) => (
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
                            onClick={() => {
                              viewSavedComparison(comparison);
                              setActiveTab("new");
                            }}
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
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuoteComparison;