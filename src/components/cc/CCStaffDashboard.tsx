import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, BarChart3, Package, FileText, LogOut, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ClientAccounts from "./ClientAccounts";
import FeaturesManagement from "./FeaturesManagement";
import SystemAnalytics from "./SystemAnalytics";
import MarketplaceInsights from "./MarketplaceInsights";
import GlobalReports from "./GlobalReports";
import coverCompassLogo from "@/assets/covercompass-logo-new.png";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CCStaffDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("accounts");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/');
        return;
      }

      // Check if user has CC_STAFF role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'CC_STAFF')
        .single();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access the CC Staff Dashboard",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setUserRole('CC_STAFF');
    } catch (error) {
      console.error('Access check error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <img src={coverCompassLogo} alt="Cover Compass" className="h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!userRole) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={coverCompassLogo} alt="Cover Compass" className="h-8" />
            <div>
              <h1 className="text-xl font-bold">CC Staff Dashboard</h1>
              <p className="text-sm text-muted-foreground">System Control Center</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Privacy Notice for Super Admin */}
        <Alert className="mb-6 border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            <strong>Privacy Mode Active:</strong> Client PII (names, emails, addresses) is redacted in this view to protect user privacy.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="accounts" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Features</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <ClientAccounts onManageFeatures={(companyId) => {
              setSelectedCompanyId(companyId);
              setActiveTab('features');
            }} />
          </TabsContent>

          <TabsContent value="features">
            <FeaturesManagement selectedCompanyId={selectedCompanyId} />
          </TabsContent>

          <TabsContent value="analytics">
            <SystemAnalytics />
          </TabsContent>

          <TabsContent value="marketplace">
            <MarketplaceInsights />
          </TabsContent>

          <TabsContent value="reports">
            <GlobalReports />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CCStaffDashboard;
