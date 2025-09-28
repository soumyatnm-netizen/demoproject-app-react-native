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
  client_name: string;
  quote_date: string;
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
  const [clients, setClients] = useState<string[]>([]);
  const [placementOutcomes, setPlacementOutcomes] = useState<PlacementOutcome[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedQuote, setSelectedQuote] = useState<StructuredQuote | null>(null);
  const [clientQuotes, setClientQuotes] = useState<StructuredQuote[]>([]);
  const [outcomeForm, setOutcomeForm] = useState({
    outcome: "",
    winReason: "",
    businessType: "",
    policyType: "",
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

      // Extract unique client names, handling null/empty values
      const allClientNames = (quotesData || [])
        .map(quote => quote.client_name)
        .filter(name => name && name.trim() !== '');
      
      const uniqueClients = [...new Set(allClientNames)].sort();

      // Fetch existing placement outcomes
      const { data: outcomesData, error: outcomesError } = await supabase
        .from('placement_outcomes')
        .select('*')
        .order('created_at', { ascending: false });

      if (outcomesError) throw outcomesError;

      setQuotes(quotesData || []);
      setClients(uniqueClients);
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

  // Handle client selection to filter quotes
  const handleClientSelection = (clientName: string) => {
    setSelectedClient(clientName);
    setSelectedQuote(null);
    
    if (clientName) {
      const filteredQuotes = quotes
        .filter(quote => quote.client_name === clientName)
        .sort((a, b) => new Date(b.quote_date || b.created_at).getTime() - new Date(a.quote_date || a.created_at).getTime());
      setClientQuotes(filteredQuotes);
    } else {
      setClientQuotes([]);
    }
  };

  const submitPlacementOutcome = async () => {
    if (!selectedQuote || !outcomeForm.outcome) {
      toast({
        title: "Error", 
        description: "Please select a client, quote, and outcome",
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
          underwriter_name: selectedQuote.insurer_name, // Use the insurer from the selected quote
          industry: selectedQuote.industry,
          product_type: selectedQuote.product_type,
          premium_amount: selectedQuote.premium_amount,
          outcome: outcomeForm.outcome,
          win_reason: outcomeForm.winReason,
          business_type: outcomeForm.businessType,
          policy_type: outcomeForm.policyType,
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
        outcome: "",
        winReason: "",
        businessType: "",
        policyType: "",
        notes: ""
      });
      setSelectedClient("");
      setSelectedQuote(null);
      setClientQuotes([]);
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

  // Calculate analytics
  const analytics = placementOutcomes.reduce((acc, outcome) => {
    acc.total++;
    if (outcome.outcome === 'won') acc.wins++;
    if (outcome.outcome === 'quoted') acc.quotes++;
    return acc;
  }, { total: 0, wins: 0, quotes: 0 });

  const winRate = analytics.total > 0 ? (analytics.wins / analytics.total * 100) : 0;
  const quoteRate = analytics.total > 0 ? (analytics.quotes / analytics.total * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label>Select Client *</Label>
              <Select 
                value={selectedClient} 
                onValueChange={handleClientSelection}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((clientName) => (
                    <SelectItem key={clientName} value={clientName}>
                      {clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && (
              <div className="space-y-2">
                <Label>Select Quote *</Label>
                <Select 
                  value={selectedQuote?.id || ""} 
                  onValueChange={(value) => {
                    const quote = clientQuotes.find(q => q.id === value);
                    setSelectedQuote(quote || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose quote to track outcome for" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientQuotes.map((quote) => (
                      <SelectItem key={quote.id} value={quote.id}>
                        {quote.insurer_name} - {quote.product_type} (£{quote.premium_amount?.toLocaleString()}) - {new Date(quote.quote_date || quote.created_at).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <Label>New Business or Existing Client *</Label>
              <Select 
                value={outcomeForm.businessType} 
                onValueChange={(value) => setOutcomeForm(prev => ({ ...prev, businessType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_business">New Business</SelectItem>
                  <SelectItem value="existing_client">Existing Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Policy Type *</Label>
              <Select 
                value={outcomeForm.policyType} 
                onValueChange={(value) => setOutcomeForm(prev => ({ ...prev, policyType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select policy type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public_liability">Public Liability Insurance</SelectItem>
                  <SelectItem value="professional_indemnity">Professional Indemnity Insurance</SelectItem>
                  <SelectItem value="cyber">Cyber Insurance</SelectItem>
                  <SelectItem value="employers_liability">Employers' Liability Insurance</SelectItem>
                  <SelectItem value="product_liability">Product Liability Insurance</SelectItem>
                  <SelectItem value="commercial_property">Commercial Property Insurance</SelectItem>
                  <SelectItem value="business_interruption">Business Interruption Insurance</SelectItem>
                  <SelectItem value="directors_officers">Directors and Officers (D&O) Insurance</SelectItem>
                  <SelectItem value="workers_compensation">Workers' Compensation Insurance</SelectItem>
                  <SelectItem value="commercial_auto">Commercial Auto Insurance</SelectItem>
                  <SelectItem value="trade_credit">Trade Credit Insurance</SelectItem>
                  <SelectItem value="marine_cargo">Marine & Cargo Insurance</SelectItem>
                  <SelectItem value="general_liability">General Liability Insurance</SelectItem>
                </SelectContent>
              </Select>
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
            disabled={submitting || !selectedQuote || !selectedClient}
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