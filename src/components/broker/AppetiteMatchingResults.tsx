import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  MapPin, 
  Building2, 
  Shield,
  ExternalLink,
  Info
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";

interface AppetiteMatch {
  carrier_id: string;
  carrier_name: string;
  confidence_score: number;
  coverage_fit: string;
  jurisdiction_fit: boolean;
  industry_fit: string;
  capacity_fit_diff: number;
  exclusions_hit: string[];
  primary_reasons: string[];
  explanation: string;
  last_guide_update: string;
  score_breakdown?: any;
}

interface AppetiteMatchingResultsProps {
  topMatches: AppetiteMatch[];
  nearestMisses?: AppetiteMatch[];
  productType: string;
  loading?: boolean;
}

export const AppetiteMatchingResults = ({ 
  topMatches, 
  nearestMisses = [],
  productType,
  loading = false 
}: AppetiteMatchingResultsProps) => {
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Matching Carriers...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={undefined} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">
            Analyzing appetite guides for {productType}...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (topMatches.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-5 w-5" />
            No Strong Matches Found
          </CardTitle>
          <CardDescription>
            No carriers with strong appetite (≥60% match) found for {productType}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nearestMisses.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-900">Nearest Options:</p>
              {nearestMisses.map((miss, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{miss.carrier_name}</span>
                    <Badge variant="outline" className="bg-amber-100">
                      {miss.confidence_score}% Match
                    </Badge>
                  </div>
                  <ul className="text-sm space-y-1">
                    {miss.primary_reasons.map((fail, i) => (
                      <li key={i} className="flex items-start gap-2 text-amber-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{fail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Top Carrier Matches
        </h3>
        <Badge variant="secondary">
          {topMatches.length} Match{topMatches.length !== 1 ? 'es' : ''}
        </Badge>
      </div>

      <div className="grid gap-4">
        {topMatches.map((match, index) => (
          <Card key={match.carrier_id} className="relative overflow-hidden">
            {/* Rank indicator */}
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-lg text-sm font-bold">
              #{index + 1}
            </div>

            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{match.carrier_name}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Fit badges */}
                    <Badge 
                      variant={match.coverage_fit === 'within-range' ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      <Shield className="h-3 w-3" />
                      Coverage
                    </Badge>
                    <Badge 
                      variant={match.jurisdiction_fit ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      <MapPin className="h-3 w-3" />
                      Jurisdiction
                    </Badge>
                    <Badge 
                      variant={match.industry_fit === 'direct-match' ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      <Building2 className="h-3 w-3" />
                      Industry
                    </Badge>
                  </div>
                </div>

                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Info className="h-4 w-4" />
                      Why?
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Match Explanation</p>
                      <p className="text-sm text-muted-foreground">{match.explanation}</p>
                      {match.score_breakdown && (
                        <div className="pt-2 border-t space-y-1">
                          <p className="text-xs font-medium">Score Breakdown:</p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <span>Coverage:</span>
                            <span className="text-right font-mono">{match.score_breakdown.coverage > 0 ? '+' : ''}{match.score_breakdown.coverage}</span>
                            <span>Jurisdiction:</span>
                            <span className="text-right font-mono">{match.score_breakdown.jurisdiction > 0 ? '+' : ''}{match.score_breakdown.jurisdiction}</span>
                            <span>Industry:</span>
                            <span className="text-right font-mono">{match.score_breakdown.industry > 0 ? '+' : ''}{match.score_breakdown.industry}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Confidence score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Match Confidence</span>
                  <span className="font-bold text-lg">{match.confidence_score}%</span>
                </div>
                <Progress value={match.confidence_score} className="h-2" />
              </div>

              {/* Primary reasons */}
              {match.primary_reasons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Key Strengths:</p>
                  <ul className="space-y-1.5">
                    {match.primary_reasons.slice(0, 3).map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Exclusions hit */}
              {match.exclusions_hit.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-900 mb-1">⚠️ Exclusions Triggered:</p>
                  <ul className="space-y-1">
                    {match.exclusions_hit.map((excl, idx) => (
                      <li key={idx} className="text-sm text-red-700">• {excl}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  Guide updated: {match.last_guide_update}
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View Appetite Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Nearest misses section */}
      {nearestMisses.length > 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Other Carriers Considered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nearestMisses.map((miss, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div>
                    <span className="text-sm font-medium">{miss.carrier_name}</span>
                    <p className="text-xs text-muted-foreground">{miss.explanation}</p>
                  </div>
                  <Badge variant="outline">{miss.confidence_score}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};