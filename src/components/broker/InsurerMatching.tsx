import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp, AlertCircle, CheckCircle2, Mail, Building2, Brain, BarChart3, Award, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { getInsurerInfo } from "@/lib/insurers";

interface ClientQuote {
  id: string;
  client_name: string;
  industry: string;
  revenue_band: string;
  premium_amount: number;
  coverage_limits: any;
}

interface EnhancedMatch {
  underwriter_name: string;
  match_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  match_reasons: string[];
  concerns: string[];
  recommended_approach: string;
  estimated_win_probability: number;
  historical_performance?: {
    win_rate: number;
    avg_response_time: number;
    typical_premium_adjustment: number;
  };
  appetite_alignment: {
    industry_fit: number;
    revenue_alignment: number;
    coverage_expertise: number;
    risk_appetite_match: number;
  };
  market_intelligence: {
    recent_activity: string;
    competitive_position: string;
    capacity_status: string;
  };
  similar_clients_success: {
    count: number;
    examples: string[];
    success_rate: number;
  };
}

const InsurerMatching = () => {
  const [clientQuotes, setClientQuotes] = useState<ClientQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<string>("");
  const [matches, setMatches] = useState<EnhancedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<string>("");
  const [isFromCache, setIsFromCache] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchClientQuotes();
  }, []);

  useEffect(() => {
    if (selectedQuote) {
      fetchCachedMatches(selectedQuote);
    } else {
      setMatches([]);
      setIsFromCache(false);
    }
  }, [selectedQuote]);

  const fetchClientQuotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Fetch client reports as proxy for quotes
      const { data, error } = await supabase
        .from('client_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedQuotes = data?.map(report => ({
        id: report.id,
        client_name: report.client_name,
        industry: (report.report_data as any)?.industry || 'Unknown',
        revenue_band: (report.report_data as any)?.revenue_band || 'Unknown',
        premium_amount: Math.floor(Math.random() * 50000) + 10000, // Mock data
        coverage_limits: (report.report_data as any)?.coverage_requirements || []
      })) || [];
      
      setClientQuotes(formattedQuotes);
    } catch (error) {
      console.error('Error fetching client quotes:', error);
      toast({
        title: "Error",
        description: "Failed to load client quotes",
        variant: "destructive",
      });
    }
  };

  const fetchCachedMatches = async (quoteId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('insurer_matching_cache')
        .select('*')
        .eq('user_id', user.id)
        .eq('client_report_id', quoteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.matches) {
        setMatches(data.matches as unknown as EnhancedMatch[]);
        setAnalysisTimestamp(data.analysis_timestamp);
        setIsFromCache(true);
      } else {
        setMatches([]);
        setIsFromCache(false);
      }
    } catch (error) {
      console.error('Error fetching cached matches:', error);
      setMatches([]);
      setIsFromCache(false);
    }
  };

  const generateMatches = async (quoteId: string, forceRefresh = false) => {
    setLoading(true);
    setIsFromCache(false);
    try {
      console.log('Generating enhanced insurer matches for quote:', quoteId);
      
      const { data, error } = await supabase.functions.invoke('enhanced-insurer-matching', {
        body: { client_id: quoteId }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate matches');
      }

      console.log('Received enhanced matching results:', data);
      
      const newMatches = data.matches || [];
      const timestamp = data.analysis_timestamp || new Date().toISOString();
      
      setMatches(newMatches);
      setAnalysisTimestamp(timestamp);
      
      // Save to cache
      await saveToCache(quoteId, newMatches, timestamp);
      
      toast({
        title: forceRefresh ? "Analysis Refreshed" : "Enhanced Analysis Complete",
        description: `Found ${newMatches.length} matches by analysing ${data.similar_clients_analysed || 0} similar clients and ${data.appetite_guides_analysed || 0} appetite guides`,
      });

    } catch (error) {
      console.error('Error generating enhanced matches:', error);
      toast({
        title: "Error",
        description: "Failed to generate enhanced insurer matches. Please try again.",
        variant: "destructive",
      });
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const saveToCache = async (quoteId: string, matches: EnhancedMatch[], timestamp: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if cache exists for this quote
      const { data: existing } = await supabase
        .from('insurer_matching_cache')
        .select('id')
        .eq('user_id', user.id)
        .eq('client_report_id', quoteId)
        .maybeSingle();

      if (existing) {
        // Update existing cache
        await supabase
          .from('insurer_matching_cache')
          .update({
            matches: matches as any,
            analysis_timestamp: timestamp,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Insert new cache
        await supabase
          .from('insurer_matching_cache')
          .insert({
            user_id: user.id,
            client_report_id: quoteId,
            matches: matches as any,
            analysis_timestamp: timestamp
          });
      }
    } catch (error) {
      console.error('Error saving to cache:', error);
      // Don't show error to user as this is a background operation
    }
  };

  const checkRevenueMatch = (clientRevenue: string, minPremium?: number, maxPremium?: number): boolean => {
    // Simple matching logic - in reality this would be more sophisticated
    if (!minPremium && !maxPremium) return true;
    
    const revenueRanges: { [key: string]: number } = {
      '0-1m': 500,
      '1-5m': 2500,
      '5-10m': 7500,
      '10-50m': 30000,
      '50m+': 100000
    };

    const estimatedPremium = revenueRanges[clientRevenue] || 5000;
    
    if (minPremium && estimatedPremium < minPremium) return false;
    if (maxPremium && estimatedPremium > maxPremium) return false;
    
    return true;
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <Brain className="h-6 w-6 text-primary" />
              <span>CoverCompassAI-Powered Insurer Matching</span>
            </h2>
            <p className="text-muted-foreground">Intelligent analysis using appetite guides, market data, and placement history</p>
          </div>
          {analysisTimestamp && (
            <div className="flex items-center space-x-2">
              {isFromCache && (
                <Badge variant="secondary" className="text-xs">
                  Cached Results
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(analysisTimestamp).toLocaleTimeString()}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Select Client Quote</span>
          </CardTitle>
          <CardDescription>
            Choose a client quote to find matching insurers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Select value={selectedQuote} onValueChange={setSelectedQuote}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a client quote..." />
              </SelectTrigger>
              <SelectContent>
                {clientQuotes.map((quote) => (
                  <SelectItem key={quote.id} value={quote.id}>
                    {quote.client_name} - {quote.industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isFromCache && (
              <Button 
                onClick={() => generateMatches(selectedQuote)}
                disabled={!selectedQuote || loading}
                className="min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Brain className="h-4 w-4 mr-2 animate-pulse" />
                    Analysing...
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-2" />
                    Find Matches
                  </>
                )}
              </Button>
            )}
            {isFromCache && matches.length > 0 && (
              <Button 
                onClick={() => generateMatches(selectedQuote, true)}
                disabled={loading}
                variant="outline"
                className="min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Brain className="h-4 w-4 mr-2 animate-pulse" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Refresh Analysis
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Intelligent Match Results ({matches.length})</span>
            </h3>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                <Award className="h-3 w-3 mr-1" />
                AI-Enhanced Analysis
              </Badge>
            </div>
          </div>
          
          <div className="grid gap-6">
            {matches.map((match, index) => (
              <Card key={`${match.underwriter_name}-${index}`} className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header Section */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        {(() => {
                          const insurerInfo = getInsurerInfo(match.underwriter_name);
                          return insurerInfo.logo ? (
                            <img 
                              src={insurerInfo.logo} 
                              alt={match.underwriter_name}
                              className="w-12 h-12 object-contain rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                              <Building2 className="h-6 w-6 text-primary" />
                            </div>
                          );
                        })()}
                        <div>
                          <h4 className="font-semibold text-lg">{match.underwriter_name}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className={getConfidenceColor(match.confidence_level)}>
                              {match.confidence_level} confidence
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {match.market_intelligence.capacity_status} capacity
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-2xl font-bold px-3 py-1 rounded ${getScoreColor(match.match_score)}`}>
                          {match.match_score}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Match
                        </div>
                      </div>
                    </div>

                    {/* Detailed Analysis Tabs */}
                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="alignment">Appetite Fit</TabsTrigger>
                        <TabsTrigger value="intelligence">Market Intel</TabsTrigger>
                        <TabsTrigger value="approach">Strategy</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="overview" className="space-y-4">
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

                        {/* Similar Clients Success Section */}
                        <div className="bg-blue-50/50 rounded-lg p-4">
                          <h5 className="font-medium mb-3 flex items-center text-blue-600">
                            <Building2 className="h-4 w-4 mr-2" />
                            Similar Clients Success
                          </h5>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-lg font-semibold text-blue-600">
                                {match.similar_clients_success.count}
                              </div>
                              <div className="text-xs text-muted-foreground">Similar Clients</div>
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-blue-600">
                                {Math.round(match.similar_clients_success.success_rate)}%
                              </div>
                              <div className="text-xs text-muted-foreground">Success Rate</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">
                                {match.similar_clients_success.examples.length > 0 
                                  ? match.similar_clients_success.examples.slice(0, 2).join(', ')
                                  : 'No examples available'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">Examples</div>
                            </div>
                          </div>
                        </div>

                        {match.historical_performance && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <h5 className="font-medium mb-3">Historical Performance</h5>
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="text-lg font-semibold">
                                  {Math.round(match.historical_performance.win_rate * 100)}%
                                </div>
                                <div className="text-xs text-muted-foreground">Win Rate</div>
                              </div>
                              <div>
                                <div className="text-lg font-semibold">
                                  {match.historical_performance.avg_response_time}d
                                </div>
                                <div className="text-xs text-muted-foreground">Avg Response</div>
                              </div>
                              <div>
                                <div className="text-lg font-semibold">
                                  {match.historical_performance.typical_premium_adjustment > 0 ? '+' : ''}
                                  {Math.round(match.historical_performance.typical_premium_adjustment * 100)}%
                                </div>
                                <div className="text-xs text-muted-foreground">Premium Adj.</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="alignment" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Industry Fit</span>
                              <span>{match.appetite_alignment.industry_fit}%</span>
                            </div>
                            <Progress value={match.appetite_alignment.industry_fit} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Revenue Alignment</span>
                              <span>{match.appetite_alignment.revenue_alignment}%</span>
                            </div>
                            <Progress value={match.appetite_alignment.revenue_alignment} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Coverage Expertise</span>
                              <span>{match.appetite_alignment.coverage_expertise}%</span>
                            </div>
                            <Progress value={match.appetite_alignment.coverage_expertise} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Risk Appetite Match</span>
                              <span>{match.appetite_alignment.risk_appetite_match}%</span>
                            </div>
                            <Progress value={match.appetite_alignment.risk_appetite_match} className="h-2" />
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="intelligence" className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <div className="font-medium">Market Activity</div>
                            <div className="text-sm text-muted-foreground">
                              {match.market_intelligence.recent_activity}
                            </div>
                          </div>
                          <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <div className="font-medium">Position</div>
                            <div className="text-sm text-muted-foreground">
                              {match.market_intelligence.competitive_position}
                            </div>
                          </div>
                          <div className="text-center p-4 bg-muted/30 rounded-lg">
                            <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <div className="font-medium">Capacity</div>
                            <div className="text-sm text-muted-foreground">
                              {match.market_intelligence.capacity_status}
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="approach" className="space-y-4">
                        <div className="bg-primary/5 rounded-lg p-4">
                          <h5 className="font-medium mb-2 flex items-center">
                            <Brain className="h-4 w-4 mr-2 text-primary" />
                            AI-Recommended Approach
                          </h5>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {match.recommended_approach}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline">
                            View Full Profile
                          </Button>
                          <Button size="sm" variant="outline">
                            <Mail className="h-4 w-4 mr-2" />
                            Generate Submission
                          </Button>
                          <Button size="sm">
                            Add to Shortlist
                          </Button>
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

      {selectedQuote && matches.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No matches found</h3>
            <p className="text-muted-foreground">
              Try selecting a different client quote or check if insurer data is available.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InsurerMatching;