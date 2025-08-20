import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Users, Building2, Star, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface StructuredQuote {
  id: string;
  insurer_name: string;
  product_type: string;
  premium_amount: number;
  industry: string;
  revenue_band: string;
  coverage_limits: any;
  created_at: string;
}

interface UnderwriterAppetiteData {
  id: string;
  underwriter_name: string;
  target_sectors: string[];
  specialty_focus: string[];
  coverage_limits: any;
  risk_appetite: string;
  geographic_coverage: string[];
  policy_features: any;
  financial_ratings: any;
}

interface UnderwriterMatch {
  underwriter: UnderwriterAppetiteData;
  matchScore: number;
  matchReasons: string[];
  riskAlignment: 'high' | 'medium' | 'low';
}

interface UnderwriterMatchingViewProps {
  quotes: StructuredQuote[];
}

const UnderwriterMatchingView = ({ quotes }: UnderwriterMatchingViewProps) => {
  const [underwriterData, setUnderwriterData] = useState<UnderwriterAppetiteData[]>([]);
  const [matches, setMatches] = useState<{[quoteId: string]: UnderwriterMatch[]}>({});
  const [selectedQuote, setSelectedQuote] = useState<StructuredQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUnderwriterData();
  }, []);

  const fetchUnderwriterData = async () => {
    try {
      const { data, error } = await supabase
        .from('underwriter_appetite_data')
        .select('*');

      if (error) throw error;
      setUnderwriterData(data || []);
    } catch (error) {
      console.error('Error fetching underwriter data:', error);
      toast({
        title: "Error",
        description: "Failed to load underwriter appetite data",
        variant: "destructive",
      });
    }
  };

  const calculateMatchScore = (quote: StructuredQuote, underwriter: UnderwriterAppetiteData): UnderwriterMatch => {
    let score = 0;
    const reasons: string[] = [];

    // Industry/sector matching (40% of score)
    if (quote.industry && underwriter.target_sectors) {
      const industryMatch = underwriter.target_sectors.some(sector => 
        sector.toLowerCase().includes(quote.industry?.toLowerCase() || '') ||
        quote.industry?.toLowerCase().includes(sector.toLowerCase())
      );
      if (industryMatch) {
        score += 40;
        reasons.push(`Targets ${quote.industry} sector`);
      }
    }

    // Product type matching (30% of score)
    if (quote.product_type && underwriter.specialty_focus) {
      const productMatch = underwriter.specialty_focus.some(focus =>
        focus.toLowerCase().includes('professional') && quote.product_type?.toLowerCase().includes('professional') ||
        focus.toLowerCase().includes('liability') && quote.product_type?.toLowerCase().includes('liability')
      );
      if (productMatch) {
        score += 30;
        reasons.push(`Specializes in ${quote.product_type}`);
      }
    }

    // Coverage limits matching (20% of score)
    if (quote.premium_amount && underwriter.coverage_limits) {
      const premiumInRange = quote.premium_amount >= 1000 && quote.premium_amount <= 50000; // Typical SME range
      if (premiumInRange) {
        score += 20;
        reasons.push('Premium fits appetite range');
      }
    }

    // Financial strength bonus (10% of score)
    if (underwriter.financial_ratings && 
        (underwriter.financial_ratings.sp || underwriter.financial_ratings.am_best)) {
      score += 10;
      reasons.push('Strong financial ratings');
    }

    // Determine risk alignment
    let riskAlignment: 'high' | 'medium' | 'low' = 'low';
    if (score >= 70) riskAlignment = 'high';
    else if (score >= 40) riskAlignment = 'medium';

    return {
      underwriter,
      matchScore: Math.min(score, 100),
      matchReasons: reasons,
      riskAlignment
    };
  };

  const generateMatches = (quote: StructuredQuote) => {
    const quoteMatches = underwriterData
      .map(underwriter => calculateMatchScore(quote, underwriter))
      .filter(match => match.matchScore > 20) // Only show matches above 20%
      .sort((a, b) => b.matchScore - a.matchScore);

    setMatches(prev => ({
      ...prev,
      [quote.id]: quoteMatches
    }));
  };

  const handleQuoteSelect = (quote: StructuredQuote) => {
    setSelectedQuote(quote);
    if (!matches[quote.id]) {
      generateMatches(quote);
    }
  };

  const getRiskAlignmentColor = (alignment: 'high' | 'medium' | 'low') => {
    switch (alignment) {
      case 'high': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-gray-600';
  };

  if (quotes.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Quotes Available</h3>
          <p className="text-muted-foreground">
            Upload and process client documents to start matching with underwriter appetites
          </p>
        </CardContent>
      </Card>
    );
  }

  if (underwriterData.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Underwriter Data</h3>
          <p className="text-muted-foreground">
            Upload underwriter appetite documents first to enable matching
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quote Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Select Client Quote for Matching
          </CardTitle>
          <CardDescription>
            Choose a processed quote to find matching underwriters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotes.map((quote) => (
              <div
                key={quote.id}
                onClick={() => handleQuoteSelect(quote)}
                className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedQuote?.id === quote.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{quote.insurer_name}</h4>
                    {selectedQuote?.id === quote.id && (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Product: {quote.product_type || 'N/A'}</p>
                    <p>Industry: {quote.industry || 'N/A'}</p>
                    <p>Premium: £{quote.premium_amount?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Matching Results */}
      {selectedQuote && matches[selectedQuote.id] && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Underwriter Matches for {selectedQuote.insurer_name}
            </CardTitle>
            <CardDescription>
              Ranked by appetite alignment and match probability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {matches[selectedQuote.id].map((match, index) => (
                <div key={match.underwriter.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-semibold text-muted-foreground">
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold">{match.underwriter.underwriter_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={getRiskAlignmentColor(match.riskAlignment)}
                          >
                            {match.riskAlignment.charAt(0).toUpperCase() + match.riskAlignment.slice(1)} Fit
                          </Badge>
                          {match.underwriter.financial_ratings?.sp && (
                            <Badge variant="secondary" className="text-xs">
                              S&P: {match.underwriter.financial_ratings.sp}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getScoreColor(match.matchScore)}`}>
                        {match.matchScore}%
                      </div>
                      <Progress value={match.matchScore} className="w-20 mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h5 className="font-medium mb-2">Target Sectors</h5>
                      <div className="flex flex-wrap gap-1">
                        {match.underwriter.target_sectors?.slice(0, 4).map((sector, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {sector}
                          </Badge>
                        ))}
                        {match.underwriter.target_sectors?.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{match.underwriter.target_sectors.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Specialty Focus</h5>
                      <div className="flex flex-wrap gap-1">
                        {match.underwriter.specialty_focus?.map((focus, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {focus}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {match.matchReasons.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <h5 className="font-medium mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Match Reasons
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {match.matchReasons.map((reason, i) => (
                          <div key={i} className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                            <Star className="h-3 w-3" />
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {matches[selectedQuote.id].length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No suitable matches found</p>
                  <p className="text-sm">Consider adding more underwriter appetite data or refining the quote details</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UnderwriterMatchingView;