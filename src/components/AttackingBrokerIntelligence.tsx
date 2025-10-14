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
  product_type: string;
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
  created_at: string;
}

const AttackingBrokerIntelligence = () => {
  const [quotes, setQuotes] = useState<StructuredQuote[]>([]);
  const [gapAnalyses, setGapAnalyses] = useState<GapAnalysis[]>([]);
  const [selectedIncumbent, setSelectedIncumbent] = useState<StructuredQuote | null>(null);
  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [customStrategy, setCustomStrategy] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

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
      setGapAnalyses(gapData || []);
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
          attack_strategy: gapAnalysis.strategy
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
    // Simulate AI analysis of incumbent weaknesses
    const gaps = {
      coverage_limitations: [],
      pricing_issues: [],
      service_gaps: [],
      policy_restrictions: []
    };

    // Analyse coverage gaps
    if (incumbent.coverage_limits) {
      if (incumbent.coverage_limits.public_liability < 2000000) {
        gaps.coverage_limitations.push("Public liability limit below market average");
      }
      if (incumbent.coverage_limits.professional_indemnity < 1000000) {
        gaps.coverage_limitations.push("Professional indemnity coverage insufficient");
      }
    }

    // Analyse pricing
    const marketAverage = 5000; // Placeholder
    let pricingScore = 0;
    if (incumbent.premium_amount > marketAverage * 1.2) {
      gaps.pricing_issues.push("Premium 20%+ above market rate");
      pricingScore += 30;
    }

    // Generate opportunity score
    const opportunityScore = Math.min(
      50 + pricingScore + 
      (gaps.coverage_limitations.length * 10) +
      (incumbent.exclusions?.length > 5 ? 20 : 0), 
      95
    );

    const weaknesses = [
      ...gaps.coverage_limitations,
      ...gaps.pricing_issues,
      "Limited digital service capabilities",
      "Restrictive claims handling"
    ].filter(Boolean);

    const advantages = [
      "More competitive pricing available",
      "Better coverage limits in market",
      "Enhanced digital service platform",
      "Faster claims processing"
    ];

    const evidence = {
      premium_comparison: `Current premium £${incumbent.premium_amount?.toLocaleString()} vs market average £${marketAverage.toLocaleString()}`,
      coverage_improvements: gaps.coverage_limitations,
      service_enhancements: ["24/7 online portal", "Mobile claims app", "Dedicated account manager"]
    };

    const strategy = customStrategy || `Target the client's concerns about ${weaknesses[0] || 'coverage gaps'}. Emphasize our competitive advantage in ${advantages[0] || 'pricing'}. Present clear evidence of ${evidence.coverage_improvements.length > 0 ? 'coverage improvements' : 'service enhancements'}.`;

    return {
      gaps,
      opportunityScore,
      weaknesses: weaknesses.slice(0, 5),
      advantages: advantages.slice(0, 4),
      evidence,
      strategy
    };
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Incumbent Policy</label>
              <Select 
                value={selectedIncumbent?.id || ""} 
                onValueChange={(value) => {
                  const quote = quotes.find(q => q.id === value);
                  setSelectedIncumbent(quote || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose incumbent to analyse" />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((quote) => (
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
                {analyzingGaps ? "Analysing..." : "Analyse Gaps & Generate Strategy"}
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