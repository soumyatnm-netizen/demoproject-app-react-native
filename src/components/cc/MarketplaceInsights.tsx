import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Target, Award } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const MarketplaceInsights = () => {
  const [insights, setInsights] = useState<any>({
    topInsurersByVolume: [],
    topPoliciesByVolume: [],
    avgPremiumByClass: [],
    placementSuccessRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  const loadMarketplaceData = async () => {
    try {
      // Top insurers by quote volume (anonymized)
      const { data: insurerData } = await supabase
        .from('structured_quotes')
        .select('insurer_name')
        .limit(1000);

      const insurerCounts = insurerData?.reduce((acc: any, quote: any) => {
        const insurer = quote.insurer_name || 'Unknown';
        acc[insurer] = (acc[insurer] || 0) + 1;
        return acc;
      }, {});

      const topInsurers = Object.entries(insurerCounts || {})
        .map(([name, count]) => ({ insurer: name, quotes: count }))
        .sort((a: any, b: any) => b.quotes - a.quotes)
        .slice(0, 10);

      // Top policy types by volume
      const { data: policyData } = await supabase
        .from('structured_quotes')
        .select('product_type')
        .not('product_type', 'is', null)
        .limit(1000);

      const policyCounts = policyData?.reduce((acc: any, quote: any) => {
        const type = quote.product_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      const topPolicies = Object.entries(policyCounts || {})
        .map(([name, count]) => ({ policy: name, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 8);

      // Average premiums by class of business
      const { data: premiumData } = await supabase
        .from('structured_quotes')
        .select('product_type, premium_amount')
        .not('product_type', 'is', null)
        .not('premium_amount', 'is', null);

      const premiumsByClass = premiumData?.reduce((acc: any, quote: any) => {
        const type = quote.product_type;
        if (!acc[type]) {
          acc[type] = { total: 0, count: 0 };
        }
        acc[type].total += Number(quote.premium_amount);
        acc[type].count += 1;
        return acc;
      }, {});

      const avgPremiums = Object.entries(premiumsByClass || {})
        .map(([name, data]: [string, any]) => ({
          class: name,
          avgPremium: Math.round(data.total / data.count),
        }))
        .sort((a, b) => b.avgPremium - a.avgPremium)
        .slice(0, 8);

      // Placement success rate
      const { data: placementData } = await supabase
        .from('placement_outcomes')
        .select('outcome');

      const wonCount = placementData?.filter(p => p.outcome === 'won').length || 0;
      const totalCount = placementData?.length || 1;
      const successRate = Math.round((wonCount / totalCount) * 100);

      setInsights({
        topInsurersByVolume: topInsurers,
        topPoliciesByVolume: topPolicies,
        avgPremiumByClass: avgPremiums,
        placementSuccessRate: successRate,
      });
    } catch (error) {
      console.error('Error loading marketplace data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <TrendingUp className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Placement Success</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.placementSuccessRate}%</div>
            <p className="text-xs text-muted-foreground">Win rate across all clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Insurers</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.topInsurersByVolume.length}</div>
            <p className="text-xs text-muted-foreground">Top tier carriers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Policy Classes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.topPoliciesByVolume.length}</div>
            <p className="text-xs text-muted-foreground">Active product lines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Premium</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{Math.round(insights.avgPremiumByClass.reduce((sum: number, item: any) => sum + item.avgPremium, 0) / (insights.avgPremiumByClass.length || 1)).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all classes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Insurers by Quote Volume</CardTitle>
            <CardDescription>Most active carriers in the marketplace</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                quotes: {
                  label: "Quotes",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topInsurersByVolume}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="insurer" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="quotes" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy Types by Volume</CardTitle>
            <CardDescription>Most quoted classes of business</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                count: {
                  label: "Count",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topPoliciesByVolume}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="policy" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Average Premiums by Class</CardTitle>
          <CardDescription>Pricing trends across different policy types</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              avgPremium: {
                label: "Avg Premium (£)",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insights.avgPremiumByClass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="avgPremium" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketplaceInsights;
