import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Building2, Brain, BarChart3, Award, Clock, AlertTriangle, CheckCircle2, TrendingUp, Eye, ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppetiteMatchingResults } from "./AppetiteMatchingResults";

interface ClientData {
  id: string;
  client_name: string;
  report_data: any;
}

interface AppetiteGuide {
  id: string;
  underwriter_name: string;
  logo_url: string | null;
  appetite_data: {
    target_sectors: string[];
    minimum_premium: number | null;
    maximum_premium: number | null;
    risk_appetite: string;
    geographic_coverage: string[];
    specialty_focus: string[];
    exclusions: string[];
    financial_ratings: any;
  } | null;
}

interface InsurerMatch {
  underwriter_name: string;
  logo_url: string | null;
  match_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  match_reasons: string[];
  concerns: string[];
  appetite_alignment: {
    industry_fit: number;
    revenue_alignment: number;
    risk_appetite_match: number;
    geographic_match: number;
  };
  recommended_approach: string;
  premium_range: {
    min: number | null;
    max: number | null;
  };
}

interface ClientInsurerMatchingProps {
  client: ClientData;
}

const ClientInsurerMatching = ({ client }: ClientInsurerMatchingProps) => {
  const [appetiteGuides, setAppetiteGuides] = useState<AppetiteGuide[]>([]);
  const [matches, setMatches] = useState<InsurerMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAppetiteGuides();
  }, []);

  const fetchAppetiteGuides = async () => {
    try {
      const { data: guides, error } = await supabase
        .from('underwriter_appetites')
        .select(`
          id,
          underwriter_name,
          logo_url,
          appetite_data:underwriter_appetite_data(*)
        `)
        .eq('status', 'processed')
        .order('underwriter_name');

      if (error) throw error;

      const transformedGuides = guides?.map(guide => ({
        ...guide,
        appetite_data: guide.appetite_data?.[0] || null
      })) || [];

      setAppetiteGuides(transformedGuides);
      
      // Auto-generate matches when guides are loaded
      if (transformedGuides.length > 0) {
        await generateMatches(transformedGuides);
      }
    } catch (error) {
      console.error('Error fetching appetite guides:', error);
      toast({
        title: "Error",
        description: "Failed to load appetite guides",
        variant: "destructive",
      });
    }
  };

  const generateMatches = async (guides: AppetiteGuide[] = appetiteGuides) => {
    setLoading(true);
    try {
      const clientIndustry = client.report_data?.industry?.toLowerCase() || '';
      const clientRevenue = client.report_data?.revenue_band || '';
      const clientRiskProfile = client.report_data?.risk_profile || '';
      const clientLocation = 'United Kingdom'; // Default assumption

      const matches: InsurerMatch[] = [];

      for (const guide of guides) {
        if (!guide.appetite_data) continue;

        const match = calculateMatch(guide, {
          industry: clientIndustry,
          revenue: clientRevenue,
          riskProfile: clientRiskProfile,
          location: clientLocation
        });

        if (match.match_score > 20) { // Only include matches with some relevance
          matches.push(match);
        }
      }

      // Sort by match score descending
      matches.sort((a, b) => b.match_score - a.match_score);
      
      setMatches(matches);
      setAnalysisComplete(true);

      toast({
        title: "Analysis Complete",
        description: `Found ${matches.length} potential insurer matches for ${client.client_name}`,
      });

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

  const calculateMatch = (guide: AppetiteGuide, clientProfile: any): InsurerMatch => {
    const appetiteData = guide.appetite_data!;
    let matchScore = 0;
    let industryFit = 0;
    let revenueAlignment = 0;
    let riskAppetiteMatch = 0;
    let geographicMatch = 0;
    
    const matchReasons: string[] = [];
    const concerns: string[] = [];

    // Industry matching
    if (appetiteData.target_sectors && appetiteData.target_sectors.length > 0) {
      const industryMatches = appetiteData.target_sectors.some(sector =>
        sector.toLowerCase().includes(clientProfile.industry) ||
        clientProfile.industry.includes(sector.toLowerCase())
      );
      
      if (industryMatches) {
        industryFit = 95;
        matchScore += 30;
        matchReasons.push(`Specializes in ${clientProfile.industry} sector`);
      } else if (appetiteData.target_sectors.includes('General Commercial')) {
        industryFit = 70;
        matchScore += 20;
        matchReasons.push('Accepts general commercial risks');
      } else {
        industryFit = 30;
        concerns.push(`Limited experience in ${clientProfile.industry} sector`);
      }
    } else {
      industryFit = 60;
      matchScore += 15;
    }

    // Revenue/Premium alignment
    const revenueMapping: { [key: string]: number } = {
      '0-1m': 5000,
      '1-5m': 15000,
      '5-10m': 25000,
      '10-50m': 75000,
      '50m+': 150000
    };
    
    const estimatedPremium = revenueMapping[clientProfile.revenue] || 15000;
    
    if (appetiteData.minimum_premium || appetiteData.maximum_premium) {
      const minPrem = appetiteData.minimum_premium || 0;
      const maxPrem = appetiteData.maximum_premium || Infinity;
      
      if (estimatedPremium >= minPrem && estimatedPremium <= maxPrem) {
        revenueAlignment = 90;
        matchScore += 25;
        matchReasons.push('Premium requirements align with appetite');
      } else if (estimatedPremium < minPrem) {
        revenueAlignment = 40;
        concerns.push(`Estimated premium (£${estimatedPremium.toLocaleString()}) below minimum (£${minPrem.toLocaleString()})`);
      } else {
        revenueAlignment = 50;
        concerns.push(`Estimated premium (£${estimatedPremium.toLocaleString()}) above maximum (£${maxPrem.toLocaleString()})`);
      }
    } else {
      revenueAlignment = 70;
      matchScore += 15;
    }

    // Risk appetite matching
    if (appetiteData.risk_appetite) {
      const clientRisk = clientProfile.riskProfile?.toLowerCase() || '';
      const insurerRisk = appetiteData.risk_appetite.toLowerCase();
      
      if (
        (clientRisk === 'low' && insurerRisk.includes('conservative')) ||
        (clientRisk === 'medium' && (insurerRisk.includes('moderate') || insurerRisk.includes('balanced'))) ||
        (clientRisk === 'high' && insurerRisk.includes('aggressive'))
      ) {
        riskAppetiteMatch = 85;
        matchScore += 20;
        matchReasons.push('Risk appetite alignment');
      } else {
        riskAppetiteMatch = 50;
        matchScore += 10;
      }
    } else {
      riskAppetiteMatch = 60;
      matchScore += 10;
    }

    // Geographic coverage
    if (appetiteData.geographic_coverage && appetiteData.geographic_coverage.length > 0) {
      const hasUKCoverage = appetiteData.geographic_coverage.some(geo =>
        geo.toLowerCase().includes('uk') || 
        geo.toLowerCase().includes('united kingdom') ||
        geo.toLowerCase().includes('england') ||
        geo.toLowerCase().includes('europe')
      );
      
      if (hasUKCoverage) {
        geographicMatch = 90;
        matchScore += 15;
        matchReasons.push('Covers UK market');
      } else {
        geographicMatch = 30;
        concerns.push('Limited UK market presence');
      }
    } else {
      geographicMatch = 70;
      matchScore += 10;
    }

    // Exclusions check
    if (appetiteData.exclusions && appetiteData.exclusions.length > 0) {
      const hasConflictingExclusions = appetiteData.exclusions.some(exclusion =>
        exclusion.toLowerCase().includes(clientProfile.industry)
      );
      
      if (hasConflictingExclusions) {
        matchScore -= 20;
        concerns.push('Industry may be excluded');
      }
    }

    // Specialty focus bonus
    if (appetiteData.specialty_focus && appetiteData.specialty_focus.length > 0) {
      const hasSpecialtyMatch = appetiteData.specialty_focus.some(focus =>
        focus.toLowerCase().includes(clientProfile.industry) ||
        clientProfile.industry.includes(focus.toLowerCase())
      );
      
      if (hasSpecialtyMatch) {
        matchScore += 10;
        matchReasons.push('Specialty expertise in your industry');
      }
    }

    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (matchScore >= 75) confidenceLevel = 'high';
    else if (matchScore >= 50) confidenceLevel = 'medium';

    // Generate recommended approach
    let recommendedApproach = 'Standard submission approach';
    if (matchScore >= 80) {
      recommendedApproach = 'Priority submission - high appetite alignment';
    } else if (matchScore >= 60) {
      recommendedApproach = 'Standard submission with sector expertise highlighted';
    } else if (matchScore >= 40) {
      recommendedApproach = 'Careful submission - address potential concerns';
    } else {
      recommendedApproach = 'Consider alternative markets - limited appetite fit';
    }

    return {
      underwriter_name: guide.underwriter_name,
      logo_url: guide.logo_url,
      match_score: Math.min(100, Math.max(0, matchScore)),
      confidence_level: confidenceLevel,
      match_reasons: matchReasons.slice(0, 4), // Limit to top 4 reasons
      concerns: concerns.slice(0, 3), // Limit to top 3 concerns
      appetite_alignment: {
        industry_fit: industryFit,
        revenue_alignment: revenueAlignment,
        risk_appetite_match: riskAppetiteMatch,
        geographic_match: geographicMatch,
      },
      recommended_approach: recommendedApproach,
      premium_range: {
        min: appetiteData.minimum_premium,
        max: appetiteData.maximum_premium,
      }
    };
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (appetiteGuides.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Insurer Matching</span>
          </CardTitle>
          <CardDescription>
            CoverCompassAI-powered insurer matching based on appetite guides
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No appetite guides available. Upload insurer appetite documents to enable matching.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Recommended Insurers</span>
          {analysisComplete && (
            <Badge variant="outline" className="ml-2">
              <Brain className="h-3 w-3 mr-1" />
              AI Analysis
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Insurers matched to {client.client_name} based on appetite guides and client profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Analysing appetite guides...</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No suitable matches found for this client profile.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => generateMatches()}
            >
              Retry Analysis
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Found {matches.length} potential matches
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateMatches()}
              >
                <Brain className="h-3 w-3 mr-1" />
                Re-analyse
              </Button>
            </div>

            <div className="space-y-4">
              {matches.slice(0, 5).map((match, index) => (
                <Card key={`${match.underwriter_name}-${index}`} className="border-l-4 border-l-primary/50">
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{match.underwriter_name}</h4>
                            <Badge className={getConfidenceColor(match.confidence_level)} variant="outline">
                              {match.confidence_level} confidence
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold px-2 py-1 rounded ${getScoreColor(match.match_score)}`}>
                            {Math.round(match.match_score)}%
                          </div>
                        </div>
                      </div>

                      {/* Analysis Tabs */}
                      <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="overview">Overview</TabsTrigger>
                          <TabsTrigger value="alignment">Appetite Fit</TabsTrigger>
                          <TabsTrigger value="approach">Approach</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="overview" className="space-y-3">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium mb-2 flex items-center text-green-600">
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Match Strengths
                              </h5>
                              <ul className="space-y-1">
                                {match.match_reasons.map((reason, i) => (
                                  <li key={i} className="text-sm text-muted-foreground flex items-start">
                                    <span className="w-1 h-1 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0"></span>
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            {match.concerns.length > 0 && (
                              <div>
                                <h5 className="font-medium mb-2 flex items-center text-orange-600">
                                  <AlertTriangle className="h-4 w-4 mr-2" />
                                  Considerations
                                </h5>
                                <ul className="space-y-1">
                                  {match.concerns.map((concern, i) => (
                                    <li key={i} className="text-sm text-muted-foreground flex items-start">
                                      <span className="w-1 h-1 bg-orange-500 rounded-full mr-2 mt-2 flex-shrink-0"></span>
                                      {concern}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {(match.premium_range.min || match.premium_range.max) && (
                            <div className="bg-muted/30 rounded-lg p-3">
                              <h5 className="font-medium mb-2">Premium Range</h5>
                              <p className="text-sm">
                                {match.premium_range.min && match.premium_range.max
                                  ? `£${match.premium_range.min.toLocaleString()} - £${match.premium_range.max.toLocaleString()}`
                                  : match.premium_range.min
                                  ? `From £${match.premium_range.min.toLocaleString()}`
                                  : `Up to £${match.premium_range.max?.toLocaleString()}`
                                }
                              </p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="alignment" className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Industry Fit</span>
                                <span>{Math.round(match.appetite_alignment.industry_fit)}%</span>
                              </div>
                              <Progress value={match.appetite_alignment.industry_fit} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Revenue Alignment</span>
                                <span>{Math.round(match.appetite_alignment.revenue_alignment)}%</span>
                              </div>
                              <Progress value={match.appetite_alignment.revenue_alignment} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Risk Appetite</span>
                                <span>{Math.round(match.appetite_alignment.risk_appetite_match)}%</span>
                              </div>
                              <Progress value={match.appetite_alignment.risk_appetite_match} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Geographic Match</span>
                                <span>{Math.round(match.appetite_alignment.geographic_match)}%</span>
                              </div>
                              <Progress value={match.appetite_alignment.geographic_match} className="h-2" />
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="approach" className="space-y-3">
                          <div className="bg-muted/30 rounded-lg p-4">
                            <h5 className="font-medium mb-2 flex items-center">
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Recommended Approach
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              {match.recommended_approach}
                            </p>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientInsurerMatching;