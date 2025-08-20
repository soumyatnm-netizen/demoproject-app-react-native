import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, BarChart3, TrendingUp, Upload, Users, Building2, Target } from "lucide-react";
import FileUpload from "./FileUpload";
import ComparisonView from "./ComparisonView";
import CompanyManagement from "./CompanyManagement";
import ClientReportGenerator from "./ClientReportGenerator";
import AttackingBrokerIntelligence from "./AttackingBrokerIntelligence";
import PlacementOutcomeTracker from "./PlacementOutcomeTracker";
import PredictiveAnalyticsDashboard from "./PredictiveAnalyticsDashboard";
import DocumentProcessingSuccess from "./DocumentProcessingSuccess";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
  role: 'company_admin' | 'broker' | 'viewer';
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
  const { toast } = useToast();

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
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
          <Badge variant="secondary">Beta</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents.length}</div>
              <p className="text-xs text-muted-foreground">
                Total uploaded
              </p>
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {documents.filter(d => d.status === 'processing').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Documents in queue
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="upload">Upload & Process</TabsTrigger>
            <TabsTrigger value="reports">Client Reports</TabsTrigger>
            <TabsTrigger value="intelligence">Attack Intelligence</TabsTrigger>
            <TabsTrigger value="tracking">Placement Tracking</TabsTrigger>
            <TabsTrigger value="predictions">Predictive Analytics</TabsTrigger>
            <TabsTrigger value="team">Team Management</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Documents</CardTitle>
                  <CardDescription>
                    Upload insurance quotes, policy wordings, and schedules for AI processing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload onUploadSuccess={handleUploadSuccess} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Documents</CardTitle>
                  <CardDescription>
                    Your recently uploaded documents and their processing status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documents.slice(0, 5).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={doc.status === 'processed' ? 'default' : 
                                  doc.status === 'processing' ? 'secondary' : 'destructive'}
                        >
                          {doc.status}
                        </Badge>
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No documents uploaded yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <ClientReportGenerator />
          </TabsContent>

          <TabsContent value="intelligence">
            <AttackingBrokerIntelligence />
          </TabsContent>

          <TabsContent value="tracking">
            <PlacementOutcomeTracker />
          </TabsContent>

          <TabsContent value="predictions">
            <PredictiveAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="team">
            <CompanyManagement userProfile={userProfile} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;