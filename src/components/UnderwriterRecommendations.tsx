import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Star, CheckCircle, ExternalLink, Award, Building2 } from "lucide-react";
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
  logo_url?: string;
}

interface UnderwriterMatch {
  underwriter: UnderwriterAppetiteData;
  matchScore: number;
  matchReasons: string[];
  riskAlignment: 'high' | 'medium' | 'low';
  recommendationText: string;
}

interface UnderwriterRecommendationsProps {
  quote: StructuredQuote;
  onClose?: () => void;
}

const UnderwriterRecommendations = ({ quote, onClose }: UnderwriterRecommendationsProps) => {
  const [underwriterData, setUnderwriterData] = useState<UnderwriterAppetiteData[]>([]);
  const [matches, setMatches] = useState<UnderwriterMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUnderwriterDataAndMatch();
  }, [quote.id]);

  const fetchUnderwriterDataAndMatch = async () => {
    try {
      setLoading(true);
      
      // Fetch appetite data with logos
      const { data, error } = await supabase
        .from('underwriter_appetite_data')
        .select(`
          *,
          appetite_document:underwriter_appetites!inner(logo_url)
        `);

      if (error) throw error;

      // Transform data to include logo_url
      const transformedData = data?.map(item => ({
        ...item,
        logo_url: item.appetite_document?.logo_url
      })) || [];

      setUnderwriterData(transformedData);
      
      // Generate matches
      const quoteMatches = transformedData
        .map(underwriter => calculateAdvancedMatch(quote, underwriter))
        .filter(match => match.matchScore > 30) // Higher threshold for recommendations
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5); // Top 5 recommendations

      setMatches(quoteMatches);
    } catch (error) {
      console.error('Error fetching underwriter data:', error);
      toast({
        title: "Error",
        description: "Failed to load underwriter recommendations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAdvancedMatch = (quote: StructuredQuote, underwriter: UnderwriterAppetiteData): UnderwriterMatch => {
    let score = 0;
    const reasons: string[] = [];
    let recommendationText = "";

    // Industry/sector matching (35% of score)
    if (quote.industry && underwriter.target_sectors) {
      const industryMatch = underwriter.target_sectors.some(sector => 
        sector.toLowerCase().includes(quote.industry?.toLowerCase() || '') ||
        quote.industry?.toLowerCase().includes(sector.toLowerCase()) ||
        (sector.toLowerCase().includes('it') && quote.industry?.toLowerCase().includes('technology')) ||
        (sector.toLowerCase().includes('media') && quote.industry?.toLowerCase().includes('creative')) ||
        (sector.toLowerCase().includes('consultant') && quote.industry?.toLowerCase().includes('advisory'))
      );
      if (industryMatch) {
        score += 35;
        reasons.push(`Actively targets ${quote.industry} sector`);
        recommendationText += `${underwriter.underwriter_name} has strong appetite for ${quote.industry} businesses. `;
      }
    }

    // Product type specialization (25% of score)
    if (quote.product_type && underwriter.specialty_focus) {
      const productMatch = underwriter.specialty_focus.some(focus =>
        focus.toLowerCase().includes('professional') && quote.product_type?.toLowerCase().includes('professional') ||
        focus.toLowerCase().includes('liability') && quote.product_type?.toLowerCase().includes('liability') ||
        focus.toLowerCase().includes('sme') && quote.premium_amount && quote.premium_amount < 50000
      );
      if (productMatch) {
        score += 25;
        reasons.push(`Specializes in ${quote.product_type}`);
        recommendationText += `They offer competitive terms for ${quote.product_type}. `;
      }
    }

    // Premium range alignment (20% of score)
    if (quote.premium_amount && underwriter.coverage_limits) {
      const premiumFit = quote.premium_amount >= 1000 && quote.premium_amount <= 100000; // Typical range
      if (premiumFit) {
        score += 20;
        reasons.push(`Premium fits their sweet spot`);
        recommendationText += `Your premium of £${quote.premium_amount?.toLocaleString()} is within their preferred range. `;
      }
    }

    // Risk appetite alignment (10% of score)
    if (underwriter.risk_appetite) {
      if (underwriter.risk_appetite === 'moderate' || underwriter.risk_appetite === 'aggressive') {
        score += 10;
        reasons.push(`${underwriter.risk_appetite} risk appetite`);
      }
    }

    // Financial strength bonus (10% of score)
    if (underwriter.financial_ratings && 
        (underwriter.financial_ratings.sp || underwriter.financial_ratings.am_best)) {
      score += 10;
      reasons.push('Strong financial ratings');
      recommendationText += `Excellent financial strength ratings provide security for your client. `;
    }

    // Determine risk alignment and final recommendation
    let riskAlignment: 'high' | 'medium' | 'low' = 'low';
    if (score >= 70) {
      riskAlignment = 'high';
      recommendationText = `🎯 HIGHLY RECOMMENDED: ${recommendationText}This underwriter would be an excellent match for your client based on live market data and recent placements.`;
    } else if (score >= 50) {
      riskAlignment = 'medium';
      recommendationText = `✅ GOOD FIT: ${recommendationText}This underwriter shows strong appetite for this type of risk.`;
    } else {
      recommendationText = `⚠️ POSSIBLE MATCH: ${recommendationText}Consider this underwriter but expect more detailed underwriting questions.`;
    }

    return {
      underwriter,
      matchScore: Math.min(score, 100),
      matchReasons: reasons,
      riskAlignment,
      recommendationText
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-gray-600';
  };

  const getRiskAlignmentBadge = (alignment: 'high' | 'medium' | 'low') => {
    switch (alignment) {
      case 'high': return 'bg-green-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analyzing underwriter appetites...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">Underwriter Recommendations</CardTitle>
                <CardDescription className="text-base">
                  Best matches for {quote.insurer_name} - {quote.product_type}
                </CardDescription>
              </div>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Strong Matches Found</h3>
            <p className="text-muted-foreground">
              Consider broadening search criteria or adding more underwriter appetite data
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match, index) => (
            <Card key={match.underwriter.id} className={`${
              index === 0 ? 'border-primary shadow-lg' : 'border-border'
            } hover:shadow-md transition-shadow`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="flex-shrink-0">
                    {match.underwriter.logo_url ? (
                      <img 
                        src={match.underwriter.logo_url} 
                        alt={`${match.underwriter.underwriter_name} logo`}
                        className="w-16 h-16 object-contain bg-white rounded-lg border p-2"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {index === 0 && (
                            <Badge className="bg-primary text-primary-foreground">
                              <Star className="h-3 w-3 mr-1" />
                              TOP MATCH
                            </Badge>
                          )}
                          <Badge className={getRiskAlignmentBadge(match.riskAlignment)}>
                            {match.riskAlignment.toUpperCase()} FIT
                          </Badge>
                        </div>
                        <h3 className="text-xl font-bold">{match.underwriter.underwriter_name}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          {match.underwriter.financial_ratings?.sp && (
                            <Badge variant="outline" className="text-xs">
                              S&P: {match.underwriter.financial_ratings.sp}
                            </Badge>
                          )}
                          {match.underwriter.financial_ratings?.am_best && (
                            <Badge variant="outline" className="text-xs">
                              A.M. Best: {match.underwriter.financial_ratings.am_best}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getScoreColor(match.matchScore)}`}>
                          {match.matchScore}%
                        </div>
                        <Progress value={match.matchScore} className="w-24 mt-1" />
                      </div>
                    </div>

                    {/* Recommendation Text */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm leading-relaxed">{match.recommendationText}</p>
                    </div>

                    {/* Target Sectors */}
                    {match.underwriter.target_sectors && match.underwriter.target_sectors.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium mb-2">Target Sectors:</h5>
                        <div className="flex flex-wrap gap-2">
                          {match.underwriter.target_sectors.slice(0, 6).map((sector, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {sector}
                            </Badge>
                          ))}
                          {match.underwriter.target_sectors.length > 6 && (
                            <Badge variant="secondary" className="text-xs">
                              +{match.underwriter.target_sectors.length - 6} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Match Reasons */}
                    {match.matchReasons.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium mb-2">Why this underwriter fits:</h5>
                        <div className="flex flex-wrap gap-2">
                          {match.matchReasons.map((reason, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                              <CheckCircle className="h-3 w-3" />
                              {reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Request Quote
                      </Button>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        View Appetite Guide
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {matches.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {matches.filter(m => m.riskAlignment === 'high').length}
                </div>
                <div className="text-xs text-muted-foreground">High Fit Matches</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">
                  {Math.round(matches.reduce((acc, m) => acc + m.matchScore, 0) / matches.length)}%
                </div>
                <div className="text-xs text-muted-foreground">Average Match Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {matches.filter(m => m.underwriter.financial_ratings?.sp).length}
                </div>
                <div className="text-xs text-muted-foreground">A-Rated Insurers</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UnderwriterRecommendations;