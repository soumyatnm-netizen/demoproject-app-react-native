import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Mail, Target, FileText, TrendingUp, BookOpen, Sword, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import ClientManagement from "./broker/ClientManagement";
import InsurerMatching from "./broker/InsurerMatching";
import EmailIntegration from "./broker/EmailIntegration";
import BrokerProfile from "./broker/BrokerProfile";
import QuoteComparison from "./broker/QuoteComparison";
import InstantQuoteComparison from "./InstantQuoteComparison";
import AppetiteGuidesViewer from "./broker/AppetiteGuidesViewer";
import DocumentManagement from "./broker/DocumentManagement";
import MarketIntelligenceDashboard from "./MarketIntelligenceDashboard";
import CategoryManager from "./broker/CategoryManager";
import AttackingBrokerIntelligence from "./AttackingBrokerIntelligence";

interface BrokerPortalProps {
  onBack: () => void;
}

interface BrokerStats {
  totalClients: number;
  activeQuotes: number;
  matchesFound: number;
  emailsSent: number;
}

const BrokerPortal = ({ onBack }: BrokerPortalProps) => {
  const [stats, setStats] = useState<BrokerStats>({
    totalClients: 0,
    activeQuotes: 0,
    matchesFound: 0,
    emailsSent: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("instant-comparison");
  const { toast } = useToast();

  useEffect(() => {
    fetchBrokerStats();
  }, []);

  const fetchBrokerStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Fetch client reports (proxy for clients)
      const { data: clients, error: clientsError } = await supabase
        .from('client_reports')
        .select('id')
        .eq('user_id', user.id);

      if (clientsError) throw clientsError;

      // Fetch quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('structured_quotes')
        .select('quote_status')
        .eq('user_id', user.id);

      if (quotesError) throw quotesError;

      // Fetch gap analyses (proxy for matches)
      const { data: matches, error: matchesError } = await supabase
        .from('gap_analyses')
        .select('id')
        .eq('user_id', user.id);

      if (matchesError) throw matchesError;

      setStats({
        totalClients: clients?.length || 0,
        activeQuotes: quotes?.filter(q => q.quote_status === 'quoted').length || 0,
        matchesFound: matches?.length || 0,
        emailsSent: Math.floor((matches?.length || 0) * 1.5) // Estimated
      });
    } catch (error) {
      console.error('Error fetching broker stats:', error);
      toast({
        title: "Error",
        description: "Failed to load broker statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading broker portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            <Button variant="ghost" size="sm" onClick={onBack} className="flex-shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">Broker Portal</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge variant="default" className="hidden sm:flex">CoverCompass Broker</Badge>
            <Button 
              variant={activeTab === "profile" ? "default" : "outline"} 
              size="sm"
              onClick={() => setActiveTab("profile")}
              className="flex-shrink-0"
            >
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">My Profile</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Broker Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setActiveTab("clients")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                Active relationships
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeQuotes}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting placement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matches Found</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.matchesFound}</div>
              <p className="text-xs text-muted-foreground">
                Insurer opportunities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.emailsSent}</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="instant-comparison">Instant Comparison</TabsTrigger>
            <TabsTrigger value="clients">Client Management</TabsTrigger>
            <TabsTrigger value="documents-appetites">Documents & Appetites</TabsTrigger>
            <TabsTrigger value="matching">Insurer Matching</TabsTrigger>
            <TabsTrigger value="attack-intel">Attack Intelligence</TabsTrigger>
            <TabsTrigger value="market-intel">Market Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="instant-comparison">
            <InstantQuoteComparison />
          </TabsContent>

          <TabsContent value="clients">
            <ClientManagement onStatsUpdate={fetchBrokerStats} />
          </TabsContent>

          <TabsContent value="documents-appetites">
            <Tabs defaultValue="documents" className="space-y-4">
              <TabsList>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="appetites">Appetite Guides</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
              </TabsList>
              <TabsContent value="documents">
                <DocumentManagement />
              </TabsContent>
              <TabsContent value="appetites">
                <AppetiteGuidesViewer />
              </TabsContent>
              <TabsContent value="categories">
                <CategoryManager />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="matching">
            <InsurerMatching />
          </TabsContent>

          <TabsContent value="attack-intel">
            <AttackingBrokerIntelligence />
          </TabsContent>

          <TabsContent value="market-intel">
            <MarketIntelligenceDashboard />
          </TabsContent>

          <TabsContent value="profile">
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="email">Email Integration</TabsTrigger>
              </TabsList>
              <TabsContent value="profile">
                <BrokerProfile />
              </TabsContent>
              <TabsContent value="email">
                <EmailIntegration />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BrokerPortal;