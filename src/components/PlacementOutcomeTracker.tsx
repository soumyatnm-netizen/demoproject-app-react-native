import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Clock, Award, Target, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StructuredQuote {
  id: string;
  insurer_name: string;
  product_type: string;
  premium_amount: number;
  industry: string;
  coverage_limits: any;
  created_at: string;
}

interface PlacementOutcome {
  id: string;
  quote_id: string;
  underwriter_name: string;
  industry: string;
  product_type: string;
  premium_amount: number;
  outcome: string;
  win_reason: string;
  response_time_days: number;
  competitiveness_score: number;
  notes: string;
  placed_at: string;
  created_at: string;
}

const PlacementOutcomeTracker = () => {
  const [quotes, setQuotes] = useState<StructuredQuote[]>([]);
  const [placementOutcomes, setPlacementOutcomes] = useState<PlacementOutcome[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<StructuredQuote | null>(null);
  const [outcomeForm, setOutcomeForm] = useState({
    underwriter: "",
    outcome: "",
    winReason: "",
    responseDays: "",
    competitivenessScore: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch quotes that can have outcomes tracked
      const { data: quotesData, error: quotesError } = await supabase
        .from('structured_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      // Fetch existing placement outcomes
      const { data: outcomesData, error: outcomesError } = await supabase
        .from('placement_outcomes')
        .select('*')
        .order('created_at', { ascending: false });

      if (outcomesError) throw outcomesError;

      setQuotes(quotesData || []);
      setPlacementOutcomes(outcomesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load placement data",
        variant: "destructive",
      });
    }
  };

  const submitPlacementOutcome = async () => {
    if (!selectedQuote || !outcomeForm.underwriter || !outcomeForm.outcome) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('placement_outcomes')
        .insert({
          user_id: user.id,
          quote_id: selectedQuote.id,
          underwriter_name: outcomeForm.underwriter,
          industry: selectedQuote.industry,
          product_type: selectedQuote.product_type,
          premium_amount: selectedQuote.premium_amount,
          outcome: outcomeForm.outcome,
          win_reason: outcomeForm.winReason,
          response_time_days: parseInt(outcomeForm.responseDays) || null,
          competitiveness_score: parseInt(outcomeForm.competitivenessScore) || null,
          notes: outcomeForm.notes,
          placed_at: outcomeForm.outcome === 'won' ? new Date().toISOString() : null
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Placement outcome recorded successfully",
      });

      // Reset form
      setOutcomeForm({
        underwriter: "",
        outcome: "",
        winReason: "",
        responseDays: "",
        competitivenessScore: "",
        notes: ""
      });
      setSelectedQuote(null);
      fetchData();

    } catch (error) {
      console.error('Error submitting outcome:', error);
      toast({
        title: "Error",
        description: "Failed to record placement outcome",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'won': return 'bg-green-500 text-white';
      case 'lost': return 'bg-red-500 text-white';
      case 'quoted': return 'bg-blue-500 text-white';
      case 'declined': return 'bg-gray-500 text-white';
      case 'no_response': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getCompetitivenessColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-amber-600';
    return 'text-red-600';
  };

  // Calculate analytics
  const analytics = placementOutcomes.reduce((acc, outcome) => {
    acc.total++;
    if (outcome.outcome === 'won') acc.wins++;
    if (outcome.outcome === 'quoted') acc.quotes++;
    if (outcome.response_time_days) {
      acc.totalResponseTime += outcome.response_time_days;
      acc.responseTimeCount++;
    }
    return acc;
  }, { total: 0, wins: 0, quotes: 0, totalResponseTime: 0, responseTimeCount: 0 });

  const winRate = analytics.total > 0 ? (analytics.wins / analytics.total * 100) : 0;
  const quoteRate = analytics.total > 0 ? (analytics.quotes / analytics.total * 100) : 0;
  const avgResponseTime = analytics.responseTimeCount > 0 ? (analytics.totalResponseTime / analytics.responseTimeCount) : 0;

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{analytics.total}</div>
            <div className="text-sm text-muted-foreground">Total Placements</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">{winRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Win Rate</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">{quoteRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Quote Rate</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-600">{avgResponseTime.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg Response Days</div>
          </CardContent>
        </Card>
      </div>

      {/* Record New Outcome */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Record Placement Outcome
          </CardTitle>
          <CardDescription>
            Track the results of your market approaches to build intelligence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Quote/Client *</Label>
              <Select 
                value={selectedQuote?.id || ""} 
                onValueChange={(value) => {
                  const quote = quotes.find(q => q.id === value);
                  setSelectedQuote(quote || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose quote to track outcome for" />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      {quote.insurer_name} - {quote.product_type} (£{quote.premium_amount?.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Underwriter/Market *</Label>
              <Input
                placeholder="e.g., Lloyd's Syndicate 123, AXA, Zurich"
                value={outcomeForm.underwriter}
                onChange={(e) => setOutcomeForm(prev => ({ ...prev, underwriter: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Outcome *</Label>
              <Select 
                value={outcomeForm.outcome} 
                onValueChange={(value) => setOutcomeForm(prev => ({ ...prev, outcome: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Response Time (Days)</Label>
              <Input
                type="number"
                placeholder="How many days to respond?"
                value={outcomeForm.responseDays}
                onChange={(e) => setOutcomeForm(prev => ({ ...prev, responseDays: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Competitiveness Score (1-10)</Label>
              <Input
                type="number"
                min="1"
                max="10"
                placeholder="How competitive was their quote?"
                value={outcomeForm.competitivenessScore}
                onChange={(e) => setOutcomeForm(prev => ({ ...prev, competitivenessScore: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Win/Loss Reason</Label>
              <Input
                placeholder="Why did you win/lose?"
                value={outcomeForm.winReason}
                onChange={(e) => setOutcomeForm(prev => ({ ...prev, winReason: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              placeholder="Any other observations about this placement..."
              value={outcomeForm.notes}
              onChange={(e) => setOutcomeForm(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <Button 
            onClick={submitPlacementOutcome} 
            disabled={submitting || !selectedQuote}
            className="w-full"
          >
            {submitting ? "Recording..." : "Record Placement Outcome"}
          </Button>
        </CardContent>
      </Card>

      {/* Placement History */}
      <Card>
        <CardHeader>
          <CardTitle>Placement History & Intelligence</CardTitle>
          <CardDescription>
            Your tracked placement outcomes building market intelligence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {placementOutcomes.map((outcome) => {
              const quote = quotes.find(q => q.id === outcome.quote_id);
              
              return (
                <div key={outcome.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{outcome.underwriter_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {outcome.product_type} • {outcome.industry} • £{outcome.premium_amount?.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getOutcomeBadge(outcome.outcome)}>
                          {outcome.outcome.toUpperCase()}
                        </Badge>
                        {outcome.response_time_days && (
                          <Badge variant="outline" className="text-xs">
                            {outcome.response_time_days}d response
                          </Badge>
                        )}
                        {outcome.competitiveness_score && (
                          <Badge variant="outline" className="text-xs">
                            {outcome.competitiveness_score}/10 competitive
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {new Date(outcome.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {outcome.win_reason && (
                    <div className="bg-muted/50 rounded p-2 mb-2">
                      <span className="text-sm font-medium">Reason: </span>
                      <span className="text-sm">{outcome.win_reason}</span>
                    </div>
                  )}

                  {outcome.notes && (
                    <div className="bg-blue-50 rounded p-2 text-sm">
                      <span className="font-medium">Notes: </span>
                      {outcome.notes}
                    </div>
                  )}

                  {outcome.competitiveness_score && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Competitiveness:</span>
                        <Progress value={outcome.competitiveness_score * 10} className="w-20 h-2" />
                        <span className={`text-xs font-medium ${getCompetitivenessColor(outcome.competitiveness_score)}`}>
                          {outcome.competitiveness_score}/10
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {placementOutcomes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No placement outcomes recorded yet</p>
                <p className="text-sm">Start tracking your market approaches to build intelligence</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlacementOutcomeTracker;