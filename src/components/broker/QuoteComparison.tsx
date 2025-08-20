import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Shield, FileText, Download, Mail, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
}

interface ComparisonData {
  insurer: string;
  premium: number;
  coverage: number;
  deductible: number;
  score: number;
}

const QuoteComparison = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuotes();
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
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Export to PDF
                </Button>
                <Button variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Email to Client
                </Button>
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Create Report
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
    </div>
  );
};

export default QuoteComparison;