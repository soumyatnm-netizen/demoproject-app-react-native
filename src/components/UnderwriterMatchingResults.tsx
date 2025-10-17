import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Star, TrendingUp, DollarSign, Shield, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { getInsurerInfo } from "@/lib/insurers";

interface UnderwriterMatch {
  id: string;
  appetite_document_id: string;
  underwriter_name: string;
  match_score: number;
  match_rank: number;
  match_reasoning: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    overall_assessment: string;
  };
  compatibility_factors: {
    industry_match: number;
    revenue_match: number;
    premium_match: number;
    coverage_match: number;
    risk_appetite_match: number;
  };
  risk_assessment: string;
  recommended_premium_range: {
    min: number;
    max: number;
    currency: string;
    confidence: string;
  };
  coverage_gaps: string[];
  competitive_advantages: string[];
  logo_url: string | null;
  financial_ratings: any;
}

interface UnderwriterMatchingResultsProps {
  documentId: string;
  documentName: string;
  isOpen: boolean;
  onClose: () => void;
}

const UnderwriterMatchingResults = ({ documentId, documentName, isOpen, onClose }: UnderwriterMatchingResultsProps) => {
  const [matches, setMatches] = useState<UnderwriterMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchMatches();
    }
  }, [isOpen, documentId]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_best_underwriter_matches', { 
          p_document_id: documentId 
        });

      if (error) throw error;

      setMatches((data || []).map(match => ({
        ...match,
        match_reasoning: match.match_reasoning as any,
        compatibility_factors: match.compatibility_factors as any,
        recommended_premium_range: match.recommended_premium_range as any,
        coverage_gaps: match.coverage_gaps as any,
      })));
      
      // If no matches found, suggest running analysis
      if (!data || data.length === 0) {
        toast({
          title: "No matches found",
          description: "Click 'Analyse Underwriters' to find the best matches for this document.",
        });
      }

    } catch (error) {
      console.error('Error fetching matches:', error);
      toast({
        title: "Error",
        description: "Failed to load underwriter matches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    try {
      setAnalyzing(true);
      
      toast({
        title: "Analysis Started",
        description: "AI is analysing underwriter appetite guides...",
      });

      const { error } = await supabase.functions.invoke('match-underwriters', {
        body: { documentId }
      });

      if (error) throw error;

      toast({
        title: "Analysis Complete",
        description: "Underwriter matches have been updated!",
      });

      // Refresh the matches
      await fetchMatches();

    } catch (error) {
      console.error('Error triggering analysis:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyse underwriter matches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-gold text-black";
    if (rank === 2) return "bg-silver text-black";
    if (rank === 3) return "bg-bronze text-white";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5" />
            Underwriter Matches for {documentName}
          </DialogTitle>
          <DialogDescription>
            CoverCompassAI-powered analysis matching your document against underwriter appetite guides
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {matches.length > 0 && (
                <Badge variant="secondary">
                  {matches.length} matches found
                </Badge>
              )}
            </div>
            <Button
              onClick={triggerAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  Analysing...
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  {matches.length > 0 ? 'Re-analyse' : 'Analyse Underwriters'}
                </>
              )}
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {/* Matches List */}
          {!loading && matches.length > 0 && (
            <div className="space-y-6">
              {matches.map((match) => (
                <Card key={match.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getRankBadgeColor(match.match_rank)}>
                          #{match.match_rank}
                        </Badge>
                        {(() => {
                          const insurerInfo = getInsurerInfo(match.underwriter_name);
                          return insurerInfo.logo ? (
                            <img 
                              src={insurerInfo.logo} 
                              alt={match.underwriter_name}
                              className="w-10 h-10 object-contain rounded"
                            />
                          ) : null;
                        })()}
                        <div>
                          <CardTitle className="text-xl">{match.underwriter_name}</CardTitle>
                          <CardDescription>{match.match_reasoning.summary}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getScoreColor(match.match_score)}`}>
                          {match.match_score}%
                        </div>
                        <div className="text-sm text-muted-foreground">Match Score</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Compatibility Factors */}
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Compatibility Analysis</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {Object.entries(match.compatibility_factors).map(([factor, score]) => (
                          <div key={factor} className="text-center">
                            <div className={`text-lg font-bold ${getScoreColor(score as number)}`}>
                              {score}%
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {factor.replace('_', ' ')}
                            </div>
                            <Progress value={score as number} className="mt-1 h-2" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Strengths */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Strengths
                        </h4>
                        <ul className="space-y-1">
                          {match.match_reasoning.strengths.map((strength, index) => (
                            <li key={index} className="text-sm text-green-700 flex items-start gap-2">
                              <span className="text-green-600 mt-1">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Weaknesses */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          Considerations
                        </h4>
                        <ul className="space-y-1">
                          {match.match_reasoning.weaknesses.map((weakness, index) => (
                            <li key={index} className="text-sm text-orange-700 flex items-start gap-2">
                              <span className="text-orange-600 mt-1">•</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Premium Range & Risk Assessment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Recommended Premium Range
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-lg font-semibold">
                            {match.recommended_premium_range.currency} {match.recommended_premium_range.min.toLocaleString()} - {match.recommended_premium_range.max.toLocaleString()}
                          </div>
                          <Badge 
                            variant={match.recommended_premium_range.confidence === 'high' ? 'default' : 'secondary'}
                            className="mt-2"
                          >
                            {match.recommended_premium_range.confidence} confidence
                          </Badge>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Risk Assessment
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{match.risk_assessment}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Competitive Advantages */}
                    {match.competitive_advantages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Why Choose This Underwriter</h4>
                        <div className="flex flex-wrap gap-2">
                          {match.competitive_advantages.map((advantage, index) => (
                            <Badge key={index} variant="outline">
                              {advantage}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coverage Gaps */}
                    {match.coverage_gaps.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          Coverage Gaps to Address
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {match.coverage_gaps.map((gap, index) => (
                            <Badge key={index} variant="destructive">
                              {gap}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overall Assessment */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-2">Overall Assessment</h4>
                      <p className="text-sm">{match.match_reasoning.overall_assessment}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Matches State */}
          {!loading && matches.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Underwriter Matches Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Analyse Underwriters" to find the best matches for this document
                </p>
                <Button onClick={triggerAnalysis} disabled={analyzing}>
                  {analyzing ? 'Analysing...' : 'Start Analysis'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnderwriterMatchingResults;