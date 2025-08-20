import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Building2, TrendingUp, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ClientOverview {
  id: string;
  client_name: string;
  broker_name: string;
  industry: string;
  report_status: string;
  created_at: string;
  user_id: string;
}

const ClientOverview = () => {
  const [clients, setClients] = useState<ClientOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    topIndustries: [] as { industry: string; count: number }[]
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    try {
      // Fetch all client reports with broker information
      const { data: clientReports, error: reportsError } = await supabase
        .from('client_reports')
        .select(`
          *,
          broker:profiles!inner(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      const formattedClients = clientReports?.map(report => ({
        id: report.id,
        client_name: report.client_name,
        broker_name: `${report.broker.first_name || ''} ${report.broker.last_name || ''}`.trim() || 'Unknown',
        industry: (report.report_data as any)?.industry || 'Unknown',
        report_status: report.report_status,
        created_at: report.created_at,
        user_id: report.user_id
      })) || [];

      setClients(formattedClients);

      // Calculate stats
      const totalClients = formattedClients.length;
      const activeClients = formattedClients.filter(c => c.report_status !== 'archived').length;
      
      const industryCount: { [key: string]: number } = {};
      formattedClients.forEach(client => {
        industryCount[client.industry] = (industryCount[client.industry] || 0) + 1;
      });
      
      const topIndustries = Object.entries(industryCount)
        .map(([industry, count]) => ({ industry, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalClients,
        activeClients,
        topIndustries
      });

    } catch (error) {
      console.error('Error fetching client data:', error);
      toast({
        title: "Error",
        description: "Failed to load client overview",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
        <h2 className="text-2xl font-bold">Client Overview</h2>
        <p className="text-muted-foreground">View all clients across all brokers</p>
      </div>

      {/* Client Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeClients} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Industry</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.topIndustries[0]?.industry || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.topIndustries[0]?.count || 0} clients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12%</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Industry Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Industry Breakdown</CardTitle>
          <CardDescription>Client distribution by industry sector</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.topIndustries.map((industry, index) => (
              <div key={industry.industry} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{index + 1}</Badge>
                  <span className="font-medium">{industry.industry}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${(industry.count / stats.totalClients) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-muted-foreground">{industry.count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Recent Clients</span>
          </CardTitle>
          <CardDescription>Latest client additions across all brokers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.slice(0, 10).map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{client.client_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{client.broker_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{client.industry}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.report_status === 'completed' ? 'default' : 'secondary'}>
                      {client.report_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(client.created_at).toLocaleDateString()}
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

export default ClientOverview;