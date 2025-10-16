import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Target, TrendingUp, AlertTriangle, CheckCircle, Zap, Sword, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StructuredQuote {
  id: string;
  insurer_name: string;
  client_name: string;
  product_type: string;
  industry: string;
  premium_amount: number;
  coverage_limits: any;
  inclusions: string[];
  exclusions: string[];
  policy_terms: any;
  created_at: string;
}

interface GapAnalysis {
  id: string;
  incumbent_quote_id: string;
  opportunity_score: number;
  coverage_gaps: any;
  key_weaknesses: string[];
  competitive_advantages: string[];
  switch_evidence: any;
  attack_strategy: string;
  recommended_carriers: any[];
  created_at: string;
}

interface RecommendedCarrier {
  name: string;
  matchScore: number;
  winRate: number;
  avgPremium: number;
  reasons: string[];
  dataSource: string;
}

const AttackingBrokerIntelligence = () => {
  const [quotes, setQuotes] = useState<StructuredQuote[]>([]);
  const [gapAnalyses, setGapAnalyses] = useState<GapAnalysis[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [clientQuotes, setClientQuotes] = useState<StructuredQuote[]>([]);
  const [selectedIncumbent, setSelectedIncumbent] = useState<StructuredQuote | null>(null);
  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [customStrategy, setCustomStrategy] = useState("");
  const { toast } = useToast();

  // Get unique client names
  const uniqueClients = Array.from(new Set(quotes.map(q => q.client_name).filter(Boolean)));

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      const filtered = quotes.filter(q => q.client_name === selectedClient);
      setClientQuotes(filtered);
      setSelectedIncumbent(null);
    } else {
      setClientQuotes([]);
    }
  }, [selectedClient, quotes]);

  const fetchData = async () => {
    try {
      // Fetch structured quotes (potential incumbents)
      const { data: quotesData, error: quotesError } = await supabase
        .from('structured_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      // Fetch existing gap analyses
      const { data: gapData, error: gapError } = await supabase
        .from('gap_analyses')
        .select('*')
        .order('created_at', { ascending: false });

      if (gapError) throw gapError;

      setQuotes(quotesData || []);
      // Map to handle potentially missing recommended_carriers field
      setGapAnalyses((gapData || []).map((gap: any) => ({
        ...gap,
        recommended_carriers: gap.recommended_carriers || []
      })) as GapAnalysis[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    }
  };

  const analyzeGaps = async () => {
    if (!selectedIncumbent) return;

    try {
      setAnalyzingGaps(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate gap analysis using AI logic
      const gapAnalysis = await generateGapAnalysis(selectedIncumbent);

      // Save to database
      const { data: analysis, error } = await supabase
        .from('gap_analyses')
        .insert({
          user_id: user.id,
          incumbent_quote_id: selectedIncumbent.id,
          coverage_gaps: gapAnalysis.gaps,
          opportunity_score: gapAnalysis.opportunityScore,
          key_weaknesses: gapAnalysis.weaknesses,
          competitive_advantages: gapAnalysis.advantages,
          switch_evidence: gapAnalysis.evidence,
          attack_strategy: gapAnalysis.strategy,
          recommended_carriers: gapAnalysis.recommendedCarriers
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Analysis Complete",
        description: `Gap analysis generated with ${gapAnalysis.opportunityScore}% opportunity score`,
      });

      fetchData();
    } catch (error) {
      console.error('Error analysing gaps:', error);
      toast({
        title: "Error",
        description: "Failed to analyse gaps",
        variant: "destructive",
      });
    } finally {
      setAnalyzingGaps(false);
    }
  };

  const generateGapAnalysis = async (incumbent: StructuredQuote) => {
    try {
      // Fetch real market data for comprehensive analysis
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch placement outcomes for this product type and industry
      const { data: placements } = await supabase
        .from('placement_outcomes')
        .select('*')
        .eq('product_type', incumbent.product_type)
        .eq('industry', incumbent.industry)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch underwriter appetite data
      const { data: appetiteData } = await supabase
        .from('underwriter_appetite_data')
        .select('*, underwriter_appetites!inner(*)')
        .eq('product_type', incumbent.product_type)
        .limit(10);

      // Fetch market intelligence
      const { data: marketIntel } = await supabase
        .from('market_intelligence_aggregated')
        .select('*')
        .eq('product_type', incumbent.product_type)
        .eq('industry', incumbent.industry)
        .order('win_rate_percentage', { ascending: false })
        .limit(5);

      // Analyze coverage gaps
      const gaps: any = {
        coverage_limitations: [],
        pricing_issues: [],
        service_gaps: [],
        policy_restrictions: []
      };

      if (incumbent.coverage_limits) {
        if (incumbent.coverage_limits.public_liability < 2000000) {
          gaps.coverage_limitations.push("Public liability limit below market average of £2M");
        }
        if (incumbent.coverage_limits.professional_indemnity < 1000000) {
          gaps.coverage_limitations.push("Professional indemnity coverage insufficient for sector");
        }
      }

      // Analyze pricing based on market intelligence
      let marketAverage = 5000;
      if (marketIntel && marketIntel.length > 0) {
        const avgPremiums = marketIntel.map((m: any) => m.avg_premium).filter(Boolean);
        if (avgPremiums.length > 0) {
          marketAverage = avgPremiums.reduce((a: number, b: number) => a + b, 0) / avgPremiums.length;
        }
      }

      let pricingScore = 0;
      if (incumbent.premium_amount > marketAverage * 1.15) {
        gaps.pricing_issues.push(`Premium ${Math.round(((incumbent.premium_amount / marketAverage) - 1) * 100)}% above market rate`);
        pricingScore += 30;
      }

      // Analyze exclusions
      if (incumbent.exclusions && incumbent.exclusions.length > 5) {
        gaps.policy_restrictions.push(`${incumbent.exclusions.length} exclusions limit coverage scope`);
      }

      // Generate recommended carriers based on real data
      const recommendedCarriers: RecommendedCarrier[] = [];

      // From market intelligence (highest win rates)
      if (marketIntel) {
        marketIntel.slice(0, 3).forEach((intel: any) => {
          if (intel.underwriter_name !== incumbent.insurer_name) {
            recommendedCarriers.push({
              name: intel.underwriter_name,
              matchScore: Math.round(intel.win_rate_percentage * 0.7 + intel.quote_rate_percentage * 0.3),
              winRate: intel.win_rate_percentage,
              avgPremium: intel.avg_premium,
              reasons: [
                `${intel.win_rate_percentage}% win rate in ${incumbent.industry}`,
                `£${intel.avg_premium?.toLocaleString()} average premium`,
                `${intel.total_placements} successful placements`
              ],
              dataSource: 'Market Intelligence'
            });
          }
        });
      }

      // From appetite guides
      if (appetiteData) {
        appetiteData.slice(0, 2).forEach((appetite: any) => {
          if (appetite.underwriter_name !== incumbent.insurer_name && 
              !recommendedCarriers.find(c => c.name === appetite.underwriter_name)) {
            const reasons = [];
            if (appetite.target_sectors?.includes(incumbent.industry)) {
              reasons.push(`Strong appetite for ${incumbent.industry} sector`);
            }
            if (appetite.specialty_focus?.includes(incumbent.product_type)) {
              reasons.push(`Specializes in ${incumbent.product_type}`);
            }
            if (appetite.jurisdictions?.length > 0) {
              reasons.push(`Active in ${appetite.jurisdictions.length} jurisdictions`);
            }

            recommendedCarriers.push({
              name: appetite.underwriter_name,
              matchScore: 75,
              winRate: 0,
              avgPremium: appetite.minimum_premium || 0,
              reasons,
              dataSource: 'Appetite Guide'
            });
          }
        });
      }

      // From placement tracking
      if (placements) {
        const winningCarriers = placements
          .filter((p: any) => p.outcome === 'won')
          .reduce((acc: any, p: any) => {
            if (!acc[p.underwriter_name]) {
              acc[p.underwriter_name] = { count: 0, totalPremium: 0 };
            }
            acc[p.underwriter_name].count++;
            acc[p.underwriter_name].totalPremium += p.premium_amount || 0;
            return acc;
          }, {});

        Object.entries(winningCarriers).forEach(([name, data]: [string, any]) => {
          if (name !== incumbent.insurer_name && 
              !recommendedCarriers.find(c => c.name === name) &&
              recommendedCarriers.length < 5) {
            recommendedCarriers.push({
              name,
              matchScore: Math.min(95, 60 + (data.count * 5)),
              winRate: 0,
              avgPremium: data.totalPremium / data.count,
              reasons: [
                `${data.count} successful placements tracked`,
                `Proven track record in ${incumbent.product_type}`,
                `£${Math.round(data.totalPremium / data.count).toLocaleString()} average premium`
              ],
              dataSource: 'Placement History'
            });
          }
        });
      }

      // Generate opportunity score
      const opportunityScore = Math.min(
        50 + pricingScore + 
        (gaps.coverage_limitations.length * 10) +
        (gaps.policy_restrictions.length * 8) +
        (recommendedCarriers.length * 5),
        95
      );

      const weaknesses = [
        ...gaps.coverage_limitations,
        ...gaps.pricing_issues,
        ...gaps.policy_restrictions,
        incumbent.exclusions && incumbent.exclusions.length > 3 
          ? `${incumbent.exclusions.length} exclusions vs market average of 2-3`
          : null,
      ].filter(Boolean);

      const advantages = [
        recommendedCarriers.length > 0 ? `${recommendedCarriers.length} better-suited carriers identified` : null,
        marketAverage < incumbent.premium_amount ? `Potential savings of £${Math.round(incumbent.premium_amount - marketAverage).toLocaleString()}` : null,
        "Enhanced coverage limits available",
        "Improved claims service capabilities"
      ].filter(Boolean);

      const evidence = {
        premium_comparison: `Current premium £${incumbent.premium_amount?.toLocaleString()} vs market average £${Math.round(marketAverage).toLocaleString()}`,
        coverage_improvements: gaps.coverage_limitations,
        carrier_alternatives: recommendedCarriers.length,
        market_data_points: (placements?.length || 0) + (marketIntel?.length || 0)
      };

      const strategy = customStrategy || 
        `Leverage the ${weaknesses.length} identified weaknesses in the current policy. ` +
        `Present ${recommendedCarriers.length} alternative carriers with proven track records. ` +
        `${marketAverage < incumbent.premium_amount ? `Emphasize potential savings of £${Math.round(incumbent.premium_amount - marketAverage).toLocaleString()}.` : ''} ` +
        `Focus on improved coverage and service capabilities backed by market intelligence data.`;

      return {
        gaps,
        opportunityScore,
        weaknesses: weaknesses.slice(0, 6),
        advantages: advantages.slice(0, 4),
        evidence,
        strategy,
        recommendedCarriers: recommendedCarriers.slice(0, 5)
      };
    } catch (error) {
      console.error('Error generating gap analysis:', error);
      throw error;
    }
  };

  const getOpportunityScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-gray-600';
  };

  const getOpportunityBadge = (score: number) => {
    if (score >= 70) return 'bg-green-500 text-white';
    if (score >= 50) return 'bg-amber-500 text-white';
    return 'bg-gray-500 text-white';
  };

  return (
    <div className="space-y-6">
      {/* Gap Analysis Generator */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sword className="h-5 w-5 text-orange-600" />
            Attacking Broker Intelligence
          </CardTitle>
          <CardDescription className="text-orange-700">
            Identify weaknesses in incumbent coverage and generate attack strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">1. Select Client</label>
              <Select 
                value={selectedClient} 
                onValueChange={setSelectedClient}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose client" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueClients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">2. Select Incumbent Policy</label>
              <Select 
                value={selectedIncumbent?.id || ""} 
                onValueChange={(value) => {
                  const quote = clientQuotes.find(q => q.id === value);
                  setSelectedIncumbent(quote || null);
                }}
                disabled={!selectedClient}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedClient ? "Choose policy" : "Select client first"} />
                </SelectTrigger>
                <SelectContent>
                  {clientQuotes.map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      {quote.insurer_name} - £{quote.premium_amount?.toLocaleString()} ({quote.product_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={analyzeGaps} 
                disabled={!selectedIncumbent || analyzingGaps}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {analyzingGaps ? "Analysing..." : "Analyse & Generate"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Attack Strategy (Optional)</label>
            <Textarea
              placeholder="Enter specific attack angles or client concerns to focus on..."
              value={customStrategy}
              onChange={(e) => setCustomStrategy(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Gap Analysis Results */}
      <div className="space-y-4">
        {gapAnalyses.map((analysis) => {
          const incumbentQuote = quotes.find(q => q.id === analysis.incumbent_quote_id);
          
          return (
            <Card key={analysis.id} className="border-l-4 border-l-orange-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Attack Analysis: {incumbentQuote?.insurer_name || 'Unknown Insurer'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Generated {new Date(analysis.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${getOpportunityScoreColor(analysis.opportunity_score)}`}>
                      {analysis.opportunity_score}%
                    </div>
                    <Badge className={getOpportunityBadge(analysis.opportunity_score)}>
                      {analysis.opportunity_score >= 70 ? 'HIGH OPPORTUNITY' : 
                       analysis.opportunity_score >= 50 ? 'MEDIUM OPPORTUNITY' : 'LOW OPPORTUNITY'}
                    </Badge>
                    <Progress value={analysis.opportunity_score} className="w-24 mt-2" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Weaknesses */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Key Weaknesses Found
                    </h4>
                    <div className="space-y-2">
                      {analysis.key_weaknesses.map((weakness, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm bg-red-50 p-2 rounded">
                          <Target className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                          <span>{weakness}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Competitive Advantages */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      Your Competitive Advantages
                    </h4>
                    <div className="space-y-2">
                      {analysis.competitive_advantages.map((advantage, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm bg-green-50 p-2 rounded">
                          <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{advantage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Evidence to Switch */}
                {analysis.switch_evidence && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      Evidence to Present to Client
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {analysis.switch_evidence.premium_comparison && (
                        <div>
                          <span className="font-medium">Premium Savings:</span>
                          <p className="text-muted-foreground">{analysis.switch_evidence.premium_comparison}</p>
                        </div>
                      )}
                      {analysis.switch_evidence.coverage_improvements?.length > 0 && (
                        <div>
                          <span className="font-medium">Coverage Improvements:</span>
                          <ul className="text-muted-foreground list-disc list-inside">
                            {analysis.switch_evidence.coverage_improvements.slice(0, 2).map((improvement: string, i: number) => (
                              <li key={i}>{improvement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis.switch_evidence.service_enhancements?.length > 0 && (
                        <div>
                          <span className="font-medium">Service Enhancements:</span>
                          <ul className="text-muted-foreground list-disc list-inside">
                            {analysis.switch_evidence.service_enhancements.slice(0, 2).map((enhancement: string, i: number) => (
                              <li key={i}>{enhancement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recommended Carriers */}
                {analysis.recommended_carriers && analysis.recommended_carriers.length > 0 && (
                  <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      Recommended Carriers to Approach
                    </h4>
                    <div className="space-y-3">
                      {analysis.recommended_carriers.map((carrier: RecommendedCarrier, i: number) => (
                        <div key={i} className="bg-white p-3 rounded border border-purple-100">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-semibold text-sm">{carrier.name}</h5>
                              <Badge variant="outline" className="text-xs mt-1">
                                {carrier.dataSource}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-purple-600">
                                {carrier.matchScore}%
                              </div>
                              {carrier.winRate > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {carrier.winRate}% win rate
                                </div>
                              )}
                            </div>
                          </div>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {carrier.reasons.map((reason, j) => (
                              <li key={j} className="flex items-start gap-1">
                                <span className="text-purple-500 mt-0.5">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attack Strategy */}
                <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-600" />
                    Recommended Attack Strategy
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {analysis.attack_strategy}
                  </p>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm">
                    Export Analysis
                  </Button>
                  <Button variant="outline" size="sm">
                    Create Proposal
                  </Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                    Launch Attack Campaign
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {gapAnalyses.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Sword className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Gap Analyses Yet</h3>
              <p className="text-muted-foreground">
                Analyse incumbent policies to identify attack opportunities and generate winning strategies
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AttackingBrokerIntelligence;