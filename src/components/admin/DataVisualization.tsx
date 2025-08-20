import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Database, FileText, Eye, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ExtractedData {
  id: string;
  underwriter_name: string;
  target_sectors: string[];
  specialty_focus: string[];
  risk_appetite: string;
  minimum_premium: number;
  maximum_premium: number;
  created_at: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DataVisualization = () => {
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({
    sectorData: [] as { name: string; value: number }[],
    riskAppetiteData: [] as { name: string; value: number }[],
    premiumRanges: [] as { range: string; count: number }[]
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchExtractedData();
  }, []);

  const fetchExtractedData = async () => {
    try {
      const { data, error } = await supabase
        .from('underwriter_appetite_data')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setExtractedData(data || []);
      processChartData(data || []);
    } catch (error) {
      console.error('Error fetching extracted data:', error);
      toast({
        title: "Error",
        description: "Failed to load data visualization",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data: ExtractedData[]) => {
    // Process sector data
    const sectorCount: { [key: string]: number } = {};
    data.forEach(item => {
      item.target_sectors?.forEach(sector => {
        sectorCount[sector] = (sectorCount[sector] || 0) + 1;
      });
    });
    
    const sectorData = Object.entries(sectorCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Process risk appetite data
    const riskCount: { [key: string]: number } = {};
    data.forEach(item => {
      if (item.risk_appetite) {
        riskCount[item.risk_appetite] = (riskCount[item.risk_appetite] || 0) + 1;
      }
    });
    
    const riskAppetiteData = Object.entries(riskCount)
      .map(([name, value]) => ({ name, value }));

    // Process premium ranges
    const ranges = [
      { range: '£0-10k', min: 0, max: 10000 },
      { range: '£10k-50k', min: 10000, max: 50000 },
      { range: '£50k-100k', min: 50000, max: 100000 },
      { range: '£100k-500k', min: 100000, max: 500000 },
      { range: '£500k+', min: 500000, max: Infinity }
    ];

    const premiumRanges = ranges.map(range => ({
      range: range.range,
      count: data.filter(item => {
        const min = item.minimum_premium || 0;
        const max = item.maximum_premium || Infinity;
        return (min >= range.min && min < range.max) || 
               (max >= range.min && max < range.max) ||
               (min <= range.min && max >= range.max);
      }).length
    }));

    setChartData({
      sectorData,
      riskAppetiteData,
      premiumRanges
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Data Visualization</h2>
        <p className="text-muted-foreground">Insights from extracted PDF data and market intelligence</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{extractedData.length}</div>
            <p className="text-xs text-muted-foreground">
              Structured records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sectors Covered</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chartData.sectorData.length}</div>
            <p className="text-xs text-muted-foreground">
              Unique industries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Underwriters</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(extractedData.map(d => d.underwriter_name)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Active in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Premium</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{Math.round(extractedData.reduce((acc, item) => acc + (item.minimum_premium || 0), 0) / extractedData.length || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum premium
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Target Sectors Distribution</CardTitle>
            <CardDescription>Most common industry sectors covered by underwriters</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.sectorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Appetite Distribution</CardTitle>
            <CardDescription>Breakdown of underwriter risk appetites</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.riskAppetiteData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.riskAppetiteData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Premium Range Distribution</CardTitle>
          <CardDescription>Distribution of underwriter premium ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.premiumRanges}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Extractions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Data Extractions</CardTitle>
          <CardDescription>Latest structured data from PDF processing</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Underwriter</TableHead>
                <TableHead>Target Sectors</TableHead>
                <TableHead>Risk Appetite</TableHead>
                <TableHead>Premium Range</TableHead>
                <TableHead>Extracted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractedData.slice(0, 10).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.underwriter_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.target_sectors?.slice(0, 2).map((sector) => (
                        <Badge key={sector} variant="outline" className="text-xs">
                          {sector}
                        </Badge>
                      ))}
                      {item.target_sectors?.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.target_sectors.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      item.risk_appetite === 'high' ? 'destructive' :
                      item.risk_appetite === 'medium' ? 'default' : 'secondary'
                    }>
                      {item.risk_appetite || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.minimum_premium && item.maximum_premium ? (
                      `£${item.minimum_premium.toLocaleString()} - £${item.maximum_premium.toLocaleString()}`
                    ) : item.minimum_premium ? (
                      `£${item.minimum_premium.toLocaleString()}+`
                    ) : 'Not specified'}
                  </TableCell>
                  <TableCell>
                    {new Date(item.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataVisualization;