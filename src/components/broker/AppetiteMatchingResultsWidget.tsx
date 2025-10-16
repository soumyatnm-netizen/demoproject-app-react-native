import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface AppetiteMatch {
  id: string;
  carrier_id: string;
  underwriter_name?: string;
  confidence_score: number;
  coverage_fit: string;
  industry_fit: string;
  jurisdiction_fit: boolean;
  capacity_fit_diff: number;
  primary_reasons: string[];
  exclusions_hit: string[];
  explanation: string;
  score_breakdown: any;
  matched_at: string;
}

interface AppetiteMatchingResultsWidgetProps {
  clientDocumentId?: string;
  clientData?: any;
}

export const AppetiteMatchingResultsWidget = ({ 
  clientDocumentId, 
  clientData 
}: AppetiteMatchingResultsWidgetProps) => {
  const [matches, setMatches] = useState<AppetiteMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (clientDocumentId) {
      fetchMatches();
    } else {
      setLoading(false);
    }
  }, [clientDocumentId]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('appetite_match_results')
        .select(`
          *,
          underwriter_appetites:carrier_id (
            underwriter_name,
            logo_url
          )
        `)
        .eq('client_document_id', clientDocumentId)
        .order('confidence_score', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedMatches = (data || []).map((match: any) => ({
        ...match,
        underwriter_name: match.underwriter_appetites?.underwriter_name || 'Unknown Carrier'
      }));

      setMatches(formattedMatches);

      if (formattedMatches.length === 0) {
        setError("No carrier matches found yet. Upload appetite guides to enable matching.");
      }
    } catch (err) {
      console.error('Error fetching appetite matches:', err);
      setError("Failed to load carrier matches");
      toast({
        title: "Error",
        description: "Failed to load carrier matches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-blue-600 bg-blue-100";
    if (score >= 40) return "text-yellow-600 bg-yellow-100";
    return "text-gray-600 bg-gray-100";
  };

  const getFitColor = (fit: string) => {
    if (fit === "excellent" || fit === "strong") return "text-green-600";
    if (fit === "good" || fit === "moderate") return "text-blue-600";
    if (fit === "fair" || fit === "partial") return "text-yellow-600";
    return "text-gray-600";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">
            <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Analyzing carrier appetite matches...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  const topMatches = matches.filter(m => m.confidence_score >= 60);
  const nearestMisses = matches.filter(m => m.confidence_score >= 50 && m.confidence_score < 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Appetite-Based Carrier Matches
        </CardTitle>
        <CardDescription>
          AI-powered analysis against {matches.length} underwriter appetite guides
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Matches */}
        {topMatches.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Strong Matches ({topMatches.length})
            </h4>
            {topMatches.slice(0, 5).map((match) => (
              <div key={match.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium">{match.underwriter_name}</h5>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getFitColor(match.coverage_fit)} variant="outline">
                        Coverage: {match.coverage_fit}
                      </Badge>
                      <Badge className={getFitColor(match.industry_fit)} variant="outline">
                        Industry: {match.industry_fit}
                      </Badge>
                      {match.jurisdiction_fit && (
                        <Badge className="text-green-600" variant="outline">
                          Jurisdiction ✓
                        </Badge>
                      )}
                    </div>
                  </div>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Badge className={getConfidenceColor(match.confidence_score)}>
                        {match.confidence_score}% match
                      </Badge>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Match Explanation</h4>
                        <p className="text-sm text-muted-foreground">{match.explanation}</p>
                        {match.score_breakdown && (
                            <div className="space-y-1 mt-3">
                            <p className="text-xs font-medium">Score Breakdown:</p>
                            {Object.entries(match.score_breakdown).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{key}:</span>
                                <span>{String(value)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>

                <Progress value={match.confidence_score} className="h-2" />

                {match.primary_reasons && match.primary_reasons.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Key Strengths:</p>
                    <div className="flex flex-wrap gap-1">
                      {match.primary_reasons.map((reason, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {match.exclusions_hit && match.exclusions_hit.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-orange-600">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Exclusions triggered:</p>
                      <p className="text-xs">{match.exclusions_hit.join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Nearest Misses */}
        {nearestMisses.length > 0 && (
          <div className="space-y-3 mt-6">
            <h4 className="font-medium text-sm flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Other Options Considered ({nearestMisses.length})
            </h4>
            {nearestMisses.slice(0, 3).map((match) => (
              <div key={match.id} className="border border-dashed rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{match.underwriter_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {match.confidence_score}% match
                  </Badge>
                </div>
                {match.primary_reasons && match.primary_reasons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {match.primary_reasons[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {topMatches.length === 0 && nearestMisses.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No strong appetite matches found</p>
            <p className="text-xs mt-1">Consider uploading more underwriter appetite guides</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
