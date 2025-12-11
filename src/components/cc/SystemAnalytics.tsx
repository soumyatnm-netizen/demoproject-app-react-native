import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, TrendingUp, Clock, Activity, BarChart3 } from "lucide-react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useSuperAdminCheck } from "@/hooks/useSuperAdminCheck";
import { REDACTED_TEXT } from "@/utils/piiRedaction";

const SystemAnalytics = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalDocuments: 0,
    totalQuotes: 0,
    totalPlacements: 0,
    avgComparisonTime: 0,
    p95ComparisonTime: 0,
    documentsToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [brokerActivity, setBrokerActivity] = useState<any[]>([]);
  const [underwriterActivity, setUnderwriterActivity] = useState<any[]>([]);
  const { isSuperAdmin } = useSuperAdminCheck();
  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // Total users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Active users (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_login_at', sevenDaysAgo);

      // Total documents
      const { count: docCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      // Documents today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // Total quotes
      const { count: quoteCount } = await supabase
        .from('structured_quotes')
        .select('*', { count: 'exact', head: true });

      // Total placements
      const { count: placementCount } = await supabase
        .from('placement_outcomes')
        .select('*', { count: 'exact', head: true });

      // Broker activity (top 10)
      const { data: brokerData } = await supabase
        .from('documents')
        .select('user_id, profiles(first_name, last_name)')
        .limit(1000);

      const brokerCounts = brokerData?.reduce((acc: any, doc: any) => {
        const userId = doc.user_id;
        const name = doc.profiles ? 
          `${doc.profiles.first_name} ${doc.profiles.last_name}` : 
          'Unknown';
        acc[userId] = acc[userId] || { name, count: 0 };
        acc[userId].count++;
        return acc;
      }, {});

      const topBrokers = Object.values(brokerCounts || {})
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10)
        .map((broker: any, index: number) => ({
          ...broker,
          displayName: broker.name, // Keep original for possible future use
        }));

      // Underwriter activity (top 10)
      const { data: underwriterData } = await supabase
        .from('structured_quotes')
        .select('insurer_name')
        .limit(1000);

      const underwriterCounts = underwriterData?.reduce((acc: any, quote: any) => {
        const insurer = quote.insurer_name || 'Unknown';
        acc[insurer] = (acc[insurer] || 0) + 1;
        return acc;
      }, {});

      const topUnderwriters = Object.entries(underwriterCounts || {})
        .map(([name, count]) => ({ name, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

      // Get processing time stats for comparisons
      const { data: processingStats } = await supabase
        .rpc('get_processing_time_stats', { days_back: 30 });

      const comparisonStats = processingStats?.find(
        (stat: any) => 
          stat.operation_type === 'comprehensive_comparison' || 
          stat.operation_type === 'generate_comparison'
      );

      const avgComparisonMs = comparisonStats?.avg_duration_ms || 0;
      const p95ComparisonMs = comparisonStats?.p95_duration_ms || 0;

      // Activity over last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: activityDocs } = await supabase
        .from('documents')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const dailyActivity = activityDocs?.reduce((acc: any, doc: any) => {
        const date = new Date(doc.created_at).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const activityChart = Object.entries(dailyActivity || {})
        .map(([date, count]) => ({ date, documents: count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-14); // Last 14 days

      setStats({
        totalUsers: userCount || 0,
        activeUsers: activeCount || 0,
        totalDocuments: docCount || 0,
        totalQuotes: quoteCount || 0,
        totalPlacements: placementCount || 0,
        avgComparisonTime: avgComparisonMs / 1000, // Convert to seconds
        p95ComparisonTime: p95ComparisonMs / 1000, // Convert to seconds
        documentsToday: todayCount || 0,
      });

      setActivityData(activityChart);
      setBrokerActivity(topBrokers as any);
      setUnderwriterActivity(topUnderwriters);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers} active (last 7 days)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Scanned</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.documentsToday} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotes Processed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuotes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalPlacements} placements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Comparison Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgComparisonTime > 0 ? `${stats.avgComparisonTime.toFixed(1)}s` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              P95: {stats.p95ComparisonTime > 0 ? `${stats.p95ComparisonTime.toFixed(1)}s` : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="brokers">Top Brokers</TabsTrigger>
          <TabsTrigger value="underwriters">Top Underwriters</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Processing (Last 14 Days)</CardTitle>
              <CardDescription>Daily document upload volume</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  documents: {
                    label: "Documents",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="documents" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brokers">
          <Card>
            <CardHeader>
              <CardTitle>Most Active Brokers</CardTitle>
              <CardDescription>Top 10 users by document uploads</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Documents",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[400px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={brokerActivity.map((b, i) => ({
                      ...b,
                      name: isSuperAdmin ? `Broker ${i + 1}` : b.name
                    }))} 
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="underwriters">
          <Card>
            <CardHeader>
              <CardTitle>Most Active Underwriters</CardTitle>
              <CardDescription>Top 10 insurers by quote volume</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Quotes",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[400px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={underwriterActivity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemAnalytics;
