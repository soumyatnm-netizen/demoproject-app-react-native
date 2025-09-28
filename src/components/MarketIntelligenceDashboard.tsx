import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  Target, 
  Award, 
  BarChart3, 
  Clock, 
  DollarSign,
  Filter,
  Trophy,
  Zap,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MarketIntelligence {
  underwriter_name: string;
  policy_type: string;
  industry: string;
  total_placements: number;
  win_rate_percentage: number;
  quote_rate_percentage: number;
  avg_premium: number;
  avg_response_time: number;
  competitiveness_ranking: number;
}

const MarketIntelligenceDashboard = () => {
  const [marketData, setMarketData] = useState<MarketIntelligence[]>([]);
  const [filteredData, setFilteredData] = useState<MarketIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    policyTypes: [] as string[],
    industry: "",
    minPremium: "",
    maxPremium: ""
  });
  const { toast } = useToast();

  const policyTypeOptions = [
    { value: "public_liability", label: "Public Liability" },
    { value: "professional_indemnity", label: "Professional Indemnity" },
    { value: "cyber", label: "Cyber Insurance" },
    { value: "employers_liability", label: "Employers' Liability" },
    { value: "product_liability", label: "Product Liability" },
    { value: "commercial_property", label: "Commercial Property" },
    { value: "business_interruption", label: "Business Interruption" },
    { value: "directors_officers", label: "Directors & Officers" },
    { value: "workers_compensation", label: "Workers' Compensation" },
    { value: "commercial_auto", label: "Commercial Auto" },
    { value: "trade_credit", label: "Trade Credit" },
    { value: "marine_cargo", label: "Marine & Cargo" },
    { value: "general_liability", label: "General Liability" },
    { value: "tech", label: "Technology & IT" },
    { value: "life_sciences", label: "Life Sciences" }
  ];

  useEffect(() => {
    fetchMarketIntelligence();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [marketData, filters]);

  const fetchMarketIntelligence = async () => {
    try {
      setLoading(true);
      
      // Call the database function to get policy type intelligence
      const { data, error } = await supabase.rpc('get_policy_type_intelligence', {
        p_policy_types: null, // Get all policy types initially
        p_industry: null,
        p_min_premium: null,
        p_max_premium: null
      });

      if (error) throw error;

      setMarketData(data || []);
    } catch (error) {
      console.error('Error fetching market intelligence:', error);
      toast({
        title: "Error",
        description: "Failed to load market intelligence data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = marketData;

    if (filters.policyTypes.length > 0) {
      filtered = filtered.filter(item => filters.policyTypes.includes(item.policy_type));
    }

    if (filters.industry) {
      filtered = filtered.filter(item => 
        item.industry?.toLowerCase().includes(filters.industry.toLowerCase())
      );
    }

    if (filters.minPremium) {
      const minPremium = parseFloat(filters.minPremium);
      filtered = filtered.filter(item => item.avg_premium >= minPremium);
    }

    if (filters.maxPremium) {
      const maxPremium = parseFloat(filters.maxPremium);
      filtered = filtered.filter(item => item.avg_premium <= maxPremium);
    }

    setFilteredData(filtered);
  };

  const handlePolicyTypeFilter = (selectedPolicyTypes: string[]) => {
    setFilters(prev => ({ ...prev, policyTypes: selectedPolicyTypes }));
  };

  const clearFilters = () => {
    setFilters({
      policyTypes: [],
      industry: "",
      minPremium: "",
      maxPremium: ""
    });
  };

  const getCompetitivenessColor = (ranking: number) => {
    if (ranking === 1) return "text-yellow-600 bg-yellow-100";
    if (ranking <= 3) return "text-green-600 bg-green-100";
    if (ranking <= 5) return "text-blue-600 bg-blue-100";
    return "text-gray-600 bg-gray-100";
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 70) return "text-green-600";
    if (winRate >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const groupedByPolicyType = filteredData.reduce((acc, item) => {
    if (!acc[item.policy_type]) {
      acc[item.policy_type] = [];
    }
    acc[item.policy_type].push(item);
    return acc;
  }, {} as Record<string, MarketIntelligence[]>);

  const topPerformers = filteredData
    .filter(item => item.competitiveness_ranking <= 3)
    .sort((a, b) => a.competitiveness_ranking - b.competitiveness_ranking)
    .slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-pulse">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Loading market intelligence...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Market Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Competitive insights across {marketData.length} data points from the market
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Live Market Data
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Market Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Policy Types</Label>
              <Select 
                value={filters.policyTypes.join(',')} 
                onValueChange={(value) => handlePolicyTypeFilter(value ? value.split(',') : [])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All policy types" />
                </SelectTrigger>
                <SelectContent>
                  {policyTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Input
                placeholder="Filter by industry"
                value={filters.industry}
                onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Min Premium (£)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minPremium}
                onChange={(e) => setFilters(prev => ({ ...prev, minPremium: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Max Premium (£)</Label>
              <Input
                type="number"
                placeholder="No limit"
                value={filters.maxPremium}
                onChange={(e) => setFilters(prev => ({ ...prev, maxPremium: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Market Overview</TabsTrigger>
          <TabsTrigger value="policy-types">By Policy Type</TabsTrigger>
          <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Market Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{filteredData.length}</div>
                <div className="text-sm text-muted-foreground">Market Data Points</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Award className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">
                  {filteredData.length > 0 ? 
                    Math.round(filteredData.reduce((sum, item) => sum + item.win_rate_percentage, 0) / filteredData.length) : 0
                  }%
                </div>
                <div className="text-sm text-muted-foreground">Avg Win Rate</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">
                  £{filteredData.length > 0 ? 
                    Math.round(filteredData.reduce((sum, item) => sum + (item.avg_premium || 0), 0) / filteredData.length).toLocaleString() : 0
                  }
                </div>
                <div className="text-sm text-muted-foreground">Avg Premium</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">
                  {filteredData.length > 0 ? 
                    Math.round(filteredData.reduce((sum, item) => sum + (item.avg_response_time || 0), 0) / filteredData.length) : 0
                  }
                </div>
                <div className="text-sm text-muted-foreground">Avg Response Days</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Market Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Market Activity Overview</CardTitle>
              <CardDescription>
                Competitive landscape across all tracked underwriters and policy types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredData.slice(0, 20).map((item, index) => (
                  <div key={`${item.underwriter_name}-${item.policy_type}-${index}`} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.underwriter_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {policyTypeOptions.find(opt => opt.value === item.policy_type)?.label} • {item.industry}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getCompetitivenessColor(item.competitiveness_ranking)}>
                          #{item.competitiveness_ranking}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Win Rate:</span>
                        <div className={`font-medium ${getWinRateColor(item.win_rate_percentage)}`}>
                          {item.win_rate_percentage}%
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quote Rate:</span>
                        <div className="font-medium">{item.quote_rate_percentage}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Premium:</span>
                        <div className="font-medium">£{Math.round(item.avg_premium || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Placements:</span>
                        <div className="font-medium">{item.total_placements}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy-types" className="space-y-6">
          {Object.entries(groupedByPolicyType).map(([policyType, items]) => {
            const policyLabel = policyTypeOptions.find(opt => opt.value === policyType)?.label || policyType;
            const topPerformer = items[0];

            return (
              <Card key={policyType}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {policyLabel}
                    <Badge variant="outline">{items.length} underwriters</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {items.slice(0, 5).map((item, index) => (
                      <div key={`${item.underwriter_name}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                          <div>
                            <div className="font-medium">{item.underwriter_name}</div>
                            <div className="text-sm text-muted-foreground">{item.industry}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right">
                            <div className={`font-medium ${getWinRateColor(item.win_rate_percentage)}`}>
                              {item.win_rate_percentage}% win rate
                            </div>
                            <div className="text-muted-foreground">
                              £{Math.round(item.avg_premium || 0).toLocaleString()} avg
                            </div>
                          </div>
                          <Badge className={getCompetitivenessColor(item.competitiveness_ranking)}>
                            #{item.competitiveness_ranking}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="top-performers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Market Leaders
              </CardTitle>
              <CardDescription>
                Top performing underwriters across all policy types based on win rates and placement volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformers.map((performer, index) => (
                  <div key={`${performer.underwriter_name}-${performer.policy_type}-${index}`} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {index < 3 && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                          }`}>
                            {index + 1}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-lg">{performer.underwriter_name}</h4>
                          <p className="text-muted-foreground">
                            {policyTypeOptions.find(opt => opt.value === performer.policy_type)?.label}
                            {performer.industry && ` • ${performer.industry}`}
                          </p>
                        </div>
                      </div>
                      <Badge className={getCompetitivenessColor(performer.competitiveness_ranking)}>
                        Market Leader #{performer.competitiveness_ranking}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getWinRateColor(performer.win_rate_percentage)}`}>
                          {performer.win_rate_percentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {performer.quote_rate_percentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">Quote Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          £{Math.round(performer.avg_premium || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Avg Premium</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {performer.total_placements}
                        </div>
                        <div className="text-xs text-muted-foreground">Placements</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {Math.round(performer.avg_response_time || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Days Response</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {filteredData.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Market Data Available</h3>
            <p className="text-muted-foreground mb-4">
              No market intelligence data matches your current filters, or there isn't enough placement data yet.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MarketIntelligenceDashboard;