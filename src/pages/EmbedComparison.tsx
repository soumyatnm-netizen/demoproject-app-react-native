import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { Shield, TrendingDown, AlertCircle } from "lucide-react";

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
}

const EmbedComparison = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    // Extract URL params
    const params = new URLSearchParams(window.location.search);
    const client = params.get('clientId');
    const token = params.get('token');
    const demo = params.get('demo');
    
    setClientId(client || 'Demo Client');
    
    // Validate token (basic check - implement proper validation)
    if (!token || token !== 'demo-token') {
      setError('Invalid or missing access token');
      setLoading(false);
      return;
    }
    
    // Use demo data if demo=true parameter is present
    if (demo === 'true') {
      loadDemoData();
    } else if (client) {
      fetchQuotes(client);
    } else {
      // Default to demo data if no client specified
      loadDemoData();
    }
  }, []);

  const loadDemoData = () => {
    // Demo quotes data for POC
    const demoQuotes: Quote[] = [
      {
        id: 'demo-1',
        insurer_name: 'Allianz',
        product_type: 'Cyber Insurance',
        premium_amount: 45000,
        premium_currency: 'GBP',
        coverage_limits: { limit: 5000000 },
        deductible_amount: 10000,
        inclusions: [
          'Data breach response costs',
          'Business interruption coverage',
          'Cyber extortion coverage',
          'Media liability protection',
          'Network security liability',
          'Crisis management support'
        ],
        exclusions: [
          'War and terrorism',
          'Prior known incidents',
          'Unencrypted data loss'
        ]
      },
      {
        id: 'demo-2',
        insurer_name: 'AXA',
        product_type: 'Cyber Insurance',
        premium_amount: 42500,
        premium_currency: 'GBP',
        coverage_limits: { limit: 5000000 },
        deductible_amount: 15000,
        inclusions: [
          'Incident response services',
          'Regulatory defence costs',
          'Business interruption',
          'Cyber crime coverage',
          'System damage repair'
        ],
        exclusions: [
          'Bodily injury claims',
          'Property damage',
          'Prior known vulnerabilities',
          'Intentional acts'
        ]
      },
      {
        id: 'demo-3',
        insurer_name: 'Hiscox',
        product_type: 'Cyber Insurance',
        premium_amount: 48000,
        premium_currency: 'GBP',
        coverage_limits: { limit: 5000000 },
        deductible_amount: 12500,
        inclusions: [
          'Privacy breach costs',
          'Network security liability',
          'Media liability',
          'Regulatory investigations',
          'PR and crisis management',
          'Forensic investigation',
          'Legal defence costs'
        ],
        exclusions: [
          'Infrastructure failure',
          'Contractual penalties'
        ]
      },
      {
        id: 'demo-4',
        insurer_name: 'Chubb',
        product_type: 'Cyber Insurance',
        premium_amount: 52000,
        premium_currency: 'GBP',
        coverage_limits: { limit: 10000000 },
        deductible_amount: 25000,
        inclusions: [
          'First-party breach costs',
          'Third-party liability',
          'Regulatory fines coverage',
          'Business interruption',
          'Ransomware payments',
          'System restoration',
          'Credit monitoring services',
          'Notification costs'
        ],
        exclusions: [
          'Fraudulent transactions',
          'Insider threats',
          'Unpatched systems'
        ]
      }
    ];
    
    setQuotes(demoQuotes);
    setLoading(false);
  };

  const fetchQuotes = async (clientName: string) => {
    try {
      const { data, error } = await supabase
        .from('structured_quotes')
        .select('*')
        .eq('client_name', clientName)
        .eq('quote_status', 'quoted')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setQuotes(data || []);
    } catch (err) {
      console.error('Error fetching quotes:', err);
      setError('Failed to load quote data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const calculateCoverageScore = (quote: Quote): number => {
    // Simple coverage score calculation
    const inclusionScore = quote.inclusions?.length || 0;
    const exclusionPenalty = (quote.exclusions?.length || 0) * 0.5;
    return Math.min(100, Math.max(0, (inclusionScore * 10) - (exclusionPenalty * 5)));
  };

  const getComparisonData = () => {
    return quotes.map(quote => ({
      insurer: quote.insurer_name,
      premium: quote.premium_amount,
      deductible: quote.deductible_amount || 0,
      coverageScore: calculateCoverageScore(quote),
      inclusionsCount: quote.inclusions?.length || 0,
      exclusionsCount: quote.exclusions?.length || 0
    }));
  };

  const getBestValue = () => {
    if (quotes.length === 0) return null;
    return quotes.reduce((best, current) => {
      const currentScore = calculateCoverageScore(current) - (current.premium_amount / 100);
      const bestScore = calculateCoverageScore(best) - (best.premium_amount / 100);
      return currentScore > bestScore ? current : best;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please ensure you have a valid access token and client ID.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Quotes Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No quotes available for this client at the moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const comparisonData = getComparisonData();
  const bestValue = getBestValue();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quote Comparison</h1>
            {clientId && (
              <p className="text-muted-foreground">Client: {clientId}</p>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {quotes.length} {quotes.length === 1 ? 'Quote' : 'Quotes'}
          </Badge>
        </div>

        {/* Best Value Highlight */}
        {bestValue && (
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-5 w-5 text-primary" />
                Best Value Option
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Insurer</p>
                  <p className="font-semibold">{bestValue.insurer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Premium</p>
                  <p className="font-semibold">{formatCurrency(bestValue.premium_amount, bestValue.premium_currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deductible</p>
                  <p className="font-semibold">{formatCurrency(bestValue.deductible_amount || 0, bestValue.premium_currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Coverage Score</p>
                  <p className="font-semibold">{calculateCoverageScore(bestValue).toFixed(0)}/100</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Premium Comparison</CardTitle>
            <CardDescription>Visual comparison across insurers</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="insurer" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'premium') return [`£${value.toLocaleString()}`, 'Premium'];
                    if (name === 'deductible') return [`£${value.toLocaleString()}`, 'Deductible'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar dataKey="premium" fill="hsl(var(--primary))" name="Premium" />
                <Bar dataKey="deductible" fill="hsl(var(--muted))" name="Deductible" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Detailed Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Coverage Comparison
            </CardTitle>
            <CardDescription>Detailed breakdown of all quotes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insurer</TableHead>
                    <TableHead>Product Type</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead className="text-right">Deductible</TableHead>
                    <TableHead className="text-center">Inclusions</TableHead>
                    <TableHead className="text-center">Exclusions</TableHead>
                    <TableHead className="text-right">Coverage Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((item, index) => {
                    const quote = quotes[index];
                    return (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{item.insurer}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {quote.product_type || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.premium, quote.premium_currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.deductible, quote.premium_currency)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-50">
                            {item.inclusionsCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-red-50">
                            {item.exclusionsCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={item.coverageScore >= 70 ? "default" : "secondary"}
                            className="font-medium"
                          >
                            {item.coverageScore.toFixed(0)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Details */}
        <div className="grid md:grid-cols-2 gap-6">
          {quotes.map((quote) => (
            <Card key={quote.id}>
              <CardHeader>
                <CardTitle className="text-base">{quote.insurer_name}</CardTitle>
                <CardDescription>{quote.product_type || 'General Insurance'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-green-600">Inclusions</h4>
                  {quote.inclusions && quote.inclusions.length > 0 ? (
                    <ul className="text-xs space-y-1">
                      {quote.inclusions.slice(0, 5).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                      {quote.inclusions.length > 5 && (
                        <li className="text-muted-foreground italic">
                          +{quote.inclusions.length - 5} more...
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No inclusions listed</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-red-600">Exclusions</h4>
                  {quote.exclusions && quote.exclusions.length > 0 ? (
                    <ul className="text-xs space-y-1">
                      {quote.exclusions.slice(0, 5).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-red-600 mt-0.5">✗</span>
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                      {quote.exclusions.length > 5 && (
                        <li className="text-muted-foreground italic">
                          +{quote.exclusions.length - 5} more...
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No exclusions listed</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmbedComparison;
