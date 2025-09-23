import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Target, Clock, BarChart3, Zap, AlertCircle, CheckCircle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MarketPrediction {
  id: string;
  underwriter_name: string;
  industry: string;
  product_type: string;
  revenue_band: string;
  win_probability: number;
  quote_probability: number;
  average_response_days: number;
  typical_premium_adjustment: number;
  capacity_status: string;
  data_points_count: number;
  last_updated: string;
}

interface PlacementOutcome {
  underwriter_name: string;
  industry: string;
  product_type: string;
  outcome: string;
  premium_amount: number;
  response_time_days: number;
  competitiveness_score: number;
}

const PredictiveAnalyticsDashboard = () => {
  const [marketPredictions, setMarketPredictions] = useState<MarketPrediction[]>([]);
  const [placementOutcomes, setPlacementOutcomes] = useState<PlacementOutcome[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [selectedProductType, setSelectedProductType] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch market predictions
      const { data: predictionsData, error: predictionsError } = await supabase
        .from('market_predictions')
        .select('*')
        .order('win_probability', { ascending: false });

      if (predictionsError) throw predictionsError;

      // Fetch placement outcomes for analysis
      const { data: outcomesData, error: outcomesError } = await supabase
        .from('placement_outcomes')
        .select('underwriter_name, industry, product_type, outcome, premium_amount, response_time_days, competitiveness_score');

      if (outcomesError) throw outcomesError;

      setMarketPredictions(predictionsData || []);
      setPlacementOutcomes(outcomesData || []);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      toast({
        title: "Error",
        description: "Failed to load predictive analytics",
        variant: "destructive",
      });
    }
  };

  const refreshPredictions = async () => {
    setRefreshing(true);
    try {
      // This would typically call an AI service to update predictions
      // For now, we'll simulate updating predictions based on placement outcomes
      await updatePredictionsFromOutcomes();
      
      toast({
        title: "Predictions Updated",
        description: "Market predictions refreshed with latest data",
      });
      
      fetchData();
    } catch (error) {
      console.error('Error refreshing predictions:', error);
      toast({
        title: "Error",
        description: "Failed to refresh predictions",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const updatePredictionsFromOutcomes = async () => {
    // Group outcomes by underwriter and calculate success rates
    const underwriterStats = placementOutcomes.reduce((acc, outcome) => {
      const key = `${outcome.underwriter_name}-${outcome.industry}-${outcome.product_type}`;
      if (!acc[key]) {
        acc[key] = {
          underwriter_name: outcome.underwriter_name,
          industry: outcome.industry,
          product_type: outcome.product_type,
          total: 0,
          wins: 0,
          quotes: 0,
          totalResponse: 0,
          responseCount: 0,
          competitivenessSum: 0,
          competitivenessCount: 0
        };
      }
      
      const stats = acc[key];
      stats.total++;
      
      if (outcome.outcome === 'won') stats.wins++;
      if (outcome.outcome === 'quoted' || outcome.outcome === 'won') stats.quotes++;
      
      if (outcome.response_time_days) {
        stats.totalResponse += outcome.response_time_days;
        stats.responseCount++;
      }
      
      if (outcome.competitiveness_score) {
        stats.competitivenessSum += outcome.competitiveness_score;
        stats.competitivenessCount++;
      }
      
      return acc;
    }, {} as Record<string, {
      underwriter_name: string;
      industry: string;
      product_type: string;
      total: number;
      wins: number;
      quotes: number;
      totalResponse: number;
      responseCount: number;
      competitivenessSum: number;
      competitivenessCount: number;
    }>);

    // Update or insert predictions
    for (const [key, stats] of Object.entries(underwriterStats)) {
      const winProbability = stats.total > 0 ? (stats.wins / stats.total * 100) : 50;
      const quoteProbability = stats.total > 0 ? (stats.quotes / stats.total * 100) : 60;
      const avgResponse = stats.responseCount > 0 ? Math.round(stats.totalResponse / stats.responseCount) : 7;
      const avgCompetitiveness = stats.competitivenessCount > 0 ? (stats.competitivenessSum / stats.competitivenessCount) : 5;
      
      // Determine capacity status based on competitiveness and response time
      let capacityStatus = 'medium';
      if (avgCompetitiveness >= 7 && avgResponse <= 3) capacityStatus = 'high';
      else if (avgCompetitiveness <= 4 || avgResponse >= 10) capacityStatus = 'low';
      
      await supabase
        .from('market_predictions')
        .upsert({
          underwriter_name: stats.underwriter_name,
          industry: stats.industry,
          product_type: stats.product_type,
          revenue_band: 'SME', // Default for now
          win_probability: Math.round(winProbability * 100) / 100,
          quote_probability: Math.round(quoteProbability * 100) / 100,
          average_response_days: avgResponse,
          typical_premium_adjustment: 0, // Would need premium comparison data
          capacity_status: capacityStatus,
          data_points_count: stats.total,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'underwriter_name,industry,product_type',
          ignoreDuplicates: false
        });
    }
  };

  const getCapacityBadge = (status: string) => {
    switch (status) {
      case 'high': return 'bg-green-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-red-500 text-white';
      case 'restricted': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600';
    if (probability >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRecommendationIcon = (winProb: number, quoteProb: number) => {
    if (winProb >= 70 && quoteProb >= 80) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (winProb >= 50 && quoteProb >= 60) return <Target className="h-4 w-4 text-amber-500" />;
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  // Filter predictions
  const filteredPredictions = marketPredictions.filter(prediction => {
    if (selectedIndustry !== "all" && prediction.industry !== selectedIndustry) return false;
    if (selectedProductType !== "all" && prediction.product_type !== selectedProductType) return false;
    return true;
  });

  // Get unique industries and product types for filters
  const industries = Array.from(new Set(marketPredictions.map(p => p.industry).filter(Boolean)));
  const productTypes = Array.from(new Set(marketPredictions.map(p => p.product_type).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Predictive Analytics Dashboard
              </CardTitle>
              <CardDescription className="text-blue-700">
                CoverCompassAI-powered predictions for market approach success rates
              </CardDescription>
            </div>
            <Button 
              onClick={refreshPredictions} 
              disabled={refreshing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              {refreshing ? "Updating..." : "Refresh Predictions"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map(industry => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Product Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Product Types</SelectItem>
                  {productTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Predictions */}
      <div className="space-y-4">
        {filteredPredictions.map((prediction) => (
          <Card key={prediction.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {getRecommendationIcon(prediction.win_probability, prediction.quote_probability)}
                    {prediction.underwriter_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {prediction.industry}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {prediction.product_type}
                    </Badge>
                    <Badge className={getCapacityBadge(prediction.capacity_status)}>
                      {prediction.capacity_status.toUpperCase()} CAPACITY
                    </Badge>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Based on {prediction.data_points_count} placements</p>
                  <p>Updated: {new Date(prediction.last_updated).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Win Probability */}
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getProbabilityColor(prediction.win_probability)}`}>
                    {prediction.win_probability.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Win Probability</div>
                  <Progress value={prediction.win_probability} className="w-full" />
                </div>

                {/* Quote Probability */}
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getProbabilityColor(prediction.quote_probability)}`}>
                    {prediction.quote_probability.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Quote Probability</div>
                  <Progress value={prediction.quote_probability} className="w-full" />
                </div>

                {/* Response Time */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {prediction.average_response_days}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Avg Response Days</div>
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">
                      {prediction.average_response_days <= 3 ? 'Fast' : 
                       prediction.average_response_days <= 7 ? 'Standard' : 'Slow'}
                    </span>
                  </div>
                </div>

                {/* Premium Adjustment */}
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    prediction.typical_premium_adjustment > 0 ? 'text-red-600' : 
                    prediction.typical_premium_adjustment < 0 ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {prediction.typical_premium_adjustment > 0 ? '+' : ''}
                    {prediction.typical_premium_adjustment.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">Premium vs Market</div>
                  <div className="text-xs">
                    {prediction.typical_premium_adjustment > 5 ? 'Premium Pricing' :
                     prediction.typical_premium_adjustment < -5 ? 'Competitive Pricing' : 'Market Rate'}
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <h5 className="font-medium mb-1">AI Recommendation:</h5>
                <p className="text-sm text-muted-foreground">
                  {prediction.win_probability >= 70 && prediction.quote_probability >= 80 ? 
                    `🎯 HIGHLY RECOMMENDED: Strong appetite with ${prediction.win_probability.toFixed(0)}% win rate. Expect ${prediction.average_response_days}d response time.` :
                   prediction.win_probability >= 50 && prediction.quote_probability >= 60 ?
                    `✅ GOOD OPTION: Moderate appetite with ${prediction.win_probability.toFixed(0)}% win rate. Consider for competitive situations.` :
                    `⚠️ LOWER PRIORITY: ${prediction.win_probability.toFixed(0)}% win rate suggests limited appetite. Use as backup option.`}
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">
                  View Historical Data
                </Button>
                <Button variant="outline" size="sm">
                  Export Analysis
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  Approach Market
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredPredictions.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Predictions Available</h3>
              <p className="text-muted-foreground mb-4">
                {marketPredictions.length === 0 ? 
                  "Start tracking placement outcomes to generate AI predictions" :
                  "No predictions match your current filters"}
              </p>
              {marketPredictions.length === 0 && (
                <Button onClick={refreshPredictions} disabled={refreshing}>
                  Generate Initial Predictions
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PredictiveAnalyticsDashboard;