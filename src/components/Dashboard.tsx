import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, BarChart3, TrendingUp, Upload, Users, Building2, Target, Star, LogOut } from "lucide-react";
import FileUpload from "./FileUpload";
import ComparisonView from "./ComparisonView";
import CompanyManagement from "./CompanyManagement";
import ClientReportGenerator from "./ClientReportGenerator";
import ClientManagement from "./broker/ClientManagement";
import AttackingBrokerIntelligence from "./AttackingBrokerIntelligence";
import MarketIntelligenceDashboard from "./MarketIntelligenceDashboard";
import PlacementOutcomeTracker from "./PlacementOutcomeTracker";
import PredictiveAnalyticsDashboard from "./PredictiveAnalyticsDashboard";
import DocumentProcessingSuccess from "./DocumentProcessingSuccess";
import UnderwriterMatchingResults from "./UnderwriterMatchingResults";
import BrokerPortal from "./BrokerPortal";
import AdminPortal from "./AdminPortal";
import ComingSoonAlert from "./ComingSoonAlert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

interface DashboardProps {
  onBack: () => void;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  created_at: string;
}

interface StructuredQuote {
  id: string;
  document_id: string;
  insurer_name: string;
  product_type: string;
  premium_amount: number;
  premium_currency: string;
  quote_status: string;
  coverage_limits: any;
  deductible_amount: number;
  inclusions: string[];
  exclusions: string[];
  industry: string;
  revenue_band: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  company_id: string | null;
  role: 'company_admin' | 'broker' | 'viewer' | 'hr_admin' | 'CC_STAFF';
  first_name: string | null;
  last_name: string | null;
  subscription_tier: string;
}

const Dashboard = ({ onBack }: DashboardProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [quotes, setQuotes] = useState<StructuredQuote[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProcessingSuccess, setShowProcessingSuccess] = useState<StructuredQuote | null>(null);
  const [selectedDocumentForMatching, setSelectedDocumentForMatching] = useState<{ id: string; name: string } | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'broker-portal' | 'admin-portal'>('dashboard');
  const { toast } = useToast();
  const { hasFeature, loading: featuresLoading } = useFeatureAccess();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          company:broker_companies(*)
        `)
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        // Create profile if it doesn't exist
        const { data: newProfileData, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            subscription_tier: 'basic',
            role: 'broker'
          })
          .select()
          .single();
        
        if (createError) throw createError;
        setUserProfile(newProfileData);
      } else {
        setUserProfile(profileData);
      }

      // Fetch documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (documentsError) throw documentsError;

      // Fetch structured quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('structured_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      console.log('Fetched quotes:', quotesData);
      console.log('Quotes with client names:', quotesData?.filter(q => q.client_name));

      setDocuments(documentsData || []);
      setQuotes(quotesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchData();
    toast({
      title: "Success",
      description: "Document uploaded and processing started",
    });
    
    // Check if we have a new processed quote to show recommendations for
    setTimeout(async () => {
      try {
        const { data: latestQuote, error } = await supabase
          .from('structured_quotes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && latestQuote) {
          setShowProcessingSuccess(latestQuote);
        }
      } catch (error) {
        console.error('Error fetching latest quote:', error);
      }
    }, 3000); // Wait 3 seconds for processing
  };

  if (loading || featuresLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show different views based on currentView
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

  if (currentView === 'broker-portal') {
    return <BrokerPortal onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'admin-portal') {
    return <AdminPortal onBack={() => setCurrentView('dashboard')} />;
  }

  // Show processing success modal
  if (showProcessingSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-3">
                <img src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" alt="CoverCompass" className="h-8" />
                <h1 className="text-2xl font-bold text-foreground">CoverCompass Dashboard</h1>
              </div>
            </div>
            <Badge variant="secondary">Beta</Badge>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <DocumentProcessingSuccess 
            quote={showProcessingSuccess}
            onClose={() => setShowProcessingSuccess(null)}
            onViewRecommendations={() => {
              // Could navigate to recommendations tab
              setShowProcessingSuccess(null);
            }}
          />
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
              <div className="flex items-center space-x-3">
                <img src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" alt="CoverCompass" className="h-8" />
                <h1 className="text-2xl font-bold text-foreground">CoverCompass Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary">Beta</Badge>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Portal Access Cards */}
        <div className={`grid gap-6 mb-8 ${
          (userProfile?.role === 'company_admin' || userProfile?.role === 'CC_STAFF') 
            ? 'grid-cols-1 md:grid-cols-2' 
            : 'grid-cols-1 max-w-4xl mx-auto'
        }`}>
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20" 
            onClick={() => setCurrentView('broker-portal')}
          >
            <CardHeader className="pb-4">
              <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                <div className="p-3 sm:p-4 bg-primary/10 rounded-lg flex-shrink-0">
                  <Target className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl sm:text-3xl mb-2">Broker Portal</CardTitle>
                  <CardDescription className="text-base sm:text-lg">
                    Instant quote comparison, client management, and market intelligence
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex justify-center sm:justify-start">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-base sm:text-lg px-6 py-3 font-semibold">
                  ⚡ Instant Quote Comparison
                </Badge>
              </div>
            </CardContent>
          </Card>

          {(userProfile?.role === 'company_admin' || userProfile?.role === 'CC_STAFF') && (
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20" 
              onClick={() => setCurrentView('admin-portal')}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                  <div className="p-3 sm:p-4 bg-secondary/10 rounded-lg flex-shrink-0">
                    <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl sm:text-3xl mb-2">Admin Portal</CardTitle>
                    <CardDescription className="text-base sm:text-lg">
                      Team management, appetite guides, and system administration
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-sm">Team Management</Badge>
                  <Badge variant="outline" className="text-sm">Appetite Guides</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotes Processed</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quotes.length}</div>
              <p className="text-xs text-muted-foreground">
                Structured data points
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Insurers</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(quotes.map(q => q.insurer_name)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                In your portfolio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Client Reports</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userProfile?.role === 'company_admin' ? '12' : '8'}
              </div>
              <p className="text-xs text-muted-foreground">
                Active projects
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="clients" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-12">
            <TabsTrigger value="clients" className="text-base py-3 px-4 font-medium">Client Management</TabsTrigger>
            <TabsTrigger value="comparison" className="text-base py-3 px-4 font-medium">Quick Comparison</TabsTrigger>
            <TabsTrigger value="reports" className="text-base py-3 px-4 font-medium">Client Reports</TabsTrigger>
            <TabsTrigger value="intelligence" className="text-base py-3 px-4 font-medium">Market Intelligence</TabsTrigger>
            <TabsTrigger value="tracking" className="text-base py-3 px-4 font-medium">Placement Tracking</TabsTrigger>
            <TabsTrigger value="team" className="text-base py-3 px-4 font-medium">Team Management</TabsTrigger>
          </TabsList>

          <TabsContent value="clients">
            <ClientManagement onStatsUpdate={() => {}} />
          </TabsContent>

          <TabsContent value="comparison">
            {hasFeature('quote_comparison') || hasFeature('document_processing') ? (
              <ComparisonView quotes={quotes} onRefresh={fetchData} />
            ) : (
              <ComingSoonAlert featureName="Quick Comparison" />
            )}
          </TabsContent>

          <TabsContent value="reports">
            {hasFeature('custom_reporting') ? (
              <ClientReportGenerator />
            ) : (
              <ComingSoonAlert featureName="Client Reports" />
            )}
          </TabsContent>

          <TabsContent value="intelligence">
            {hasFeature('market_intelligence') ? (
              <MarketIntelligenceDashboard />
            ) : (
              <ComingSoonAlert featureName="Market Intelligence" />
            )}
          </TabsContent>

          <TabsContent value="tracking">
            {hasFeature('placement_tracking') ? (
              <PlacementOutcomeTracker />
            ) : (
              <ComingSoonAlert featureName="Placement Tracking" />
            )}
          </TabsContent>

          <TabsContent value="predictions">
            {hasFeature('predictive_analytics') ? (
              <PredictiveAnalyticsDashboard />
            ) : (
              <ComingSoonAlert featureName="Predictive Analytics" />
            )}
          </TabsContent>

          <TabsContent value="team">
            <CompanyManagement userProfile={userProfile} />
          </TabsContent>
        </Tabs>

        {/* Underwriter Matching Dialog */}
        {selectedDocumentForMatching && (
          <UnderwriterMatchingResults
            documentId={selectedDocumentForMatching.id}
            documentName={selectedDocumentForMatching.name}
            isOpen={!!selectedDocumentForMatching}
            onClose={() => setSelectedDocumentForMatching(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;