import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, FileText, Database, BarChart3, Settings, Upload, BookOpen, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import BrokerManagement from "./admin/BrokerManagement";
import ClientOverview from "./admin/ClientOverview";
import PDFManagement from "./admin/PDFManagement";
import DataVisualization from "./admin/DataVisualization";
import SystemSettings from "./admin/SystemSettings";
import UnderwriterAppetiteManager from "./UnderwriterAppetiteManager";

interface AdminPortalProps {
  onBack: () => void;
}

interface AdminStats {
  totalBrokers: number;
  activeBrokers: number;
  totalClients: number;
  totalPDFs: number;
  processedPDFs: number;
  totalAppetiteGuides: number;
  processedAppetiteGuides: number;
}

const AdminPortal = ({ onBack }: AdminPortalProps) => {
  const [activeTab, setActiveTab] = useState('brokers');
  const [stats, setStats] = useState<AdminStats>({
    totalBrokers: 0,
    activeBrokers: 0,
    totalClients: 0,
    totalPDFs: 0,
    processedPDFs: 0,
    totalAppetiteGuides: 0,
    processedAppetiteGuides: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      // Fetch broker stats
      const { data: brokers, error: brokersError } = await supabase
        .from('profiles')
        .select('is_active')
        .in('role', ['broker', 'company_admin']);

      if (brokersError) throw brokersError;

      // Fetch client reports count as proxy for clients
      const { data: clients, error: clientsError } = await supabase
        .from('client_reports')
        .select('id');

      if (clientsError) throw clientsError;

      // Fetch PDF stats (underwriter appetites)
      const { data: pdfs, error: pdfsError } = await supabase
        .from('underwriter_appetites')
        .select('status');

      if (pdfsError) throw pdfsError;

      setStats({
        totalBrokers: brokers?.length || 0,
        activeBrokers: brokers?.filter(b => b.is_active !== false).length || 0,
        totalClients: clients?.length || 0,
        totalPDFs: pdfs?.length || 0,
        processedPDFs: pdfs?.filter(p => p.status === 'processed').length || 0,
        totalAppetiteGuides: pdfs?.length || 0,
        processedAppetiteGuides: pdfs?.filter(p => p.status === 'processed').length || 0
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      toast({
        title: "Error",
        description: "Failed to load admin statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
      onBack();
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="default">CoverCompass Admin</Badge>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Brokers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBrokers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeBrokers} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                Across all brokers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Appetite Guides</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppetiteGuides}</div>
              <p className="text-xs text-muted-foreground">
                {stats.processedAppetiteGuides} processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Points</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processedPDFs * 12}</div>
              <p className="text-xs text-muted-foreground">
                Extracted insights
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalPDFs - stats.processedPDFs}
              </div>
              <p className="text-xs text-muted-foreground">
                In queue
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Navigation Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Button
              variant={activeTab === 'brokers' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('brokers')}
              className={`text-lg px-6 py-3 font-semibold min-w-[180px] ${
                activeTab === 'brokers' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}
            >
              Team Management
            </Button>
            <Button
              variant={activeTab === 'appetites' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('appetites')}
              className={`text-lg px-6 py-3 font-semibold min-w-[180px] ${
                activeTab === 'appetites' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}
            >
              ⚡ Appetite Guides
            </Button>
            <Button
              variant={activeTab === 'clients' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('clients')}
              className={`text-lg px-6 py-3 font-semibold min-w-[180px] ${
                activeTab === 'clients' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary/10 text-secondary border-secondary/20'
              }`}
            >
              Client Overview
            </Button>
            <Button
              variant={activeTab === 'pdfs' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('pdfs')}
              className={`text-lg px-6 py-3 font-semibold min-w-[180px] ${
                activeTab === 'pdfs' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary/10 text-secondary border-secondary/20'
              }`}
            >
              PDF Management
            </Button>
            <Button
              variant={activeTab === 'data' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('data')}
              className={`text-lg px-6 py-3 font-semibold min-w-[180px] ${
                activeTab === 'data' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary/10 text-secondary border-secondary/20'
              }`}
            >
              Data Visualization
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('settings')}
              className={`text-lg px-6 py-3 font-semibold min-w-[180px] ${
                activeTab === 'settings' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary/10 text-secondary border-secondary/20'
              }`}
            >
              System Settings
            </Button>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'brokers' && <BrokerManagement onStatsUpdate={fetchAdminStats} />}
          {activeTab === 'clients' && <ClientOverview />}
          {activeTab === 'appetites' && <UnderwriterAppetiteManager />}
          {activeTab === 'pdfs' && <PDFManagement onStatsUpdate={fetchAdminStats} />}
          {activeTab === 'data' && <DataVisualization />}
          {activeTab === 'settings' && <SystemSettings />}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;