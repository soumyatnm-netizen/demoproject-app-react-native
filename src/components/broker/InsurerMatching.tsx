import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, TrendingUp, AlertCircle, CheckCircle2, Mail, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ClientQuote {
  id: string;
  client_name: string;
  industry: string;
  revenue_band: string;
  premium_amount: number;
  coverage_limits: any;
}

interface UnderwriterMatch {
  id: string;
  underwriter_name: string;
  logo_url: string | null;
  match_score: number;
  risk_alignment: 'high' | 'medium' | 'low';
  target_sectors: string[];
  specialty_focus: string[];
  match_reasons: string[];
  financial_ratings: any;
}

const InsurerMatching = () => {
  const [clientQuotes, setClientQuotes] = useState<ClientQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<string>("");
  const [matches, setMatches] = useState<UnderwriterMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchClientQuotes();
  }, []);

  const fetchClientQuotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Fetch client reports as proxy for quotes
      const { data, error } = await supabase
        .from('client_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedQuotes = data?.map(report => ({
        id: report.id,
        client_name: report.client_name,
        industry: (report.report_data as any)?.industry || 'Unknown',
        revenue_band: (report.report_data as any)?.revenue_band || 'Unknown',
        premium_amount: Math.floor(Math.random() * 50000) + 10000, // Mock data
        coverage_limits: (report.report_data as any)?.coverage_requirements || []
      })) || [];
      
      setClientQuotes(formattedQuotes);
    } catch (error) {
      console.error('Error fetching client quotes:', error);
      toast({
        title: "Error",
        description: "Failed to load client quotes",
        variant: "destructive",
      });
    }
  };

  const generateMatches = async (quoteId: string) => {
    setLoading(true);
    try {
      const selectedQuoteData = clientQuotes.find(q => q.id === quoteId);
      if (!selectedQuoteData) return;

      // Fetch underwriter appetite data
      const { data: underwriters, error } = await supabase
        .from('underwriter_appetite_data')
        .select('*');

      if (error) throw error;

      // Calculate matches based on industry, revenue band, etc.
      const calculatedMatches: UnderwriterMatch[] = underwriters?.map(uw => {
        let score = 0;
        const reasons: string[] = [];

        // Industry matching
        if (uw.target_sectors?.includes(selectedQuoteData.industry.toLowerCase())) {
          score += 30;
          reasons.push(`Specializes in ${selectedQuoteData.industry} sector`);
        }

        // Revenue band matching
        const revenueMatch = checkRevenueMatch(selectedQuoteData.revenue_band, uw.minimum_premium, uw.maximum_premium);
        if (revenueMatch) {
          score += 25;
          reasons.push('Premium range aligns with client budget');
        }

        // Risk appetite
        if (uw.risk_appetite === 'medium' || uw.risk_appetite === 'high') {
          score += 20;
          reasons.push('Appropriate risk appetite for client profile');
        }

        // Geographic coverage (assuming UK for demo)
        if (uw.geographic_coverage?.includes('UK') || uw.geographic_coverage?.includes('United Kingdom')) {
          score += 15;
          reasons.push('Provides coverage in required geography');
        }

        // Random additional factors for demo
        if (Math.random() > 0.3) {
          score += Math.floor(Math.random() * 10);
          reasons.push('Strong market reputation and competitive terms');
        }

        const riskAlignment: 'high' | 'medium' | 'low' = 
          score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';

        return {
          id: uw.id,
          underwriter_name: uw.underwriter_name,
          logo_url: uw.logo_url,
          match_score: Math.min(score, 95), // Cap at 95%
          risk_alignment: riskAlignment,
          target_sectors: uw.target_sectors || [],
          specialty_focus: uw.specialty_focus || [],
          match_reasons: reasons,
          financial_ratings: uw.financial_ratings
        };
      }).sort((a, b) => b.match_score - a.match_score) || [];

      setMatches(calculatedMatches);
    } catch (error) {
      console.error('Error generating matches:', error);
      toast({
        title: "Error",
        description: "Failed to generate insurer matches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkRevenueMatch = (clientRevenue: string, minPremium?: number, maxPremium?: number): boolean => {
    // Simple matching logic - in reality this would be more sophisticated
    if (!minPremium && !maxPremium) return true;
    
    const revenueRanges: { [key: string]: number } = {
      '0-1m': 500,
      '1-5m': 2500,
      '5-10m': 7500,
      '10-50m': 30000,
      '50m+': 100000
    };

    const estimatedPremium = revenueRanges[clientRevenue] || 5000;
    
    if (minPremium && estimatedPremium < minPremium) return false;
    if (maxPremium && estimatedPremium > maxPremium) return false;
    
    return true;
  };

  const getRiskAlignmentColor = (alignment: string) => {
    switch (alignment) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Insurer Matching Engine</h2>
        <p className="text-muted-foreground">Find the best insurance matches for your clients</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Select Client Quote</span>
          </CardTitle>
          <CardDescription>
            Choose a client quote to find matching insurers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Select value={selectedQuote} onValueChange={setSelectedQuote}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a client quote..." />
              </SelectTrigger>
              <SelectContent>
                {clientQuotes.map((quote) => (
                  <SelectItem key={quote.id} value={quote.id}>
                    {quote.client_name} - {quote.industry} (£{quote.premium_amount.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => generateMatches(selectedQuote)}
              disabled={!selectedQuote || loading}
            >
              {loading ? 'Finding Matches...' : 'Find Matches'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Insurer Matches ({matches.length})</h3>
          
          <div className="grid gap-4">
            {matches.slice(0, 10).map((match) => (
              <Card key={match.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      {match.logo_url ? (
                        <img 
                          src={match.logo_url} 
                          alt={`${match.underwriter_name} logo`}
                          className="w-12 h-12 object-contain rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-lg">{match.underwriter_name}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className={getRiskAlignmentColor(match.risk_alignment)}>
                            {match.risk_alignment} risk alignment
                          </Badge>
                          {match.target_sectors.slice(0, 2).map((sector) => (
                            <Badge key={sector} variant="secondary" className="text-xs">
                              {sector}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-2xl font-bold px-3 py-1 rounded ${getScoreColor(match.match_score)}`}>
                        {match.match_score}%
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Match Score</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h5 className="font-medium mb-2 flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                      Match Reasons
                    </h5>
                    <ul className="space-y-1">
                      {match.match_reasons.map((reason, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-center">
                          <span className="w-1 h-1 bg-primary rounded-full mr-2"></span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {match.specialty_focus.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium mb-2">Specialty Focus</h5>
                      <div className="flex flex-wrap gap-1">
                        {match.specialty_focus.slice(0, 4).map((focus) => (
                          <Badge key={focus} variant="outline" className="text-xs">
                            {focus}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex space-x-2">
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                    <Button size="sm" variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Client
                    </Button>
                    <Button size="sm">
                      Add to Shortlist
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedQuote && matches.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No matches found</h3>
            <p className="text-muted-foreground">
              Try selecting a different client quote or check if insurer data is available.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InsurerMatching;