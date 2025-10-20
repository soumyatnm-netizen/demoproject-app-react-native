import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Building2, BarChart3, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useRole } from '@/hooks/useRole';

const CCStaffDashboard = () => {
  const [activeTab, setActiveTab] = useState('provisioning');
  const { toast } = useToast();
  const { role } = useRole();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
              CoverCompass Staff Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge variant="default">{role}</Badge>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="provisioning">
              <Building2 className="h-4 w-4 mr-2" />
              Provisioning
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Cross-Org Analytics
            </TabsTrigger>
            <TabsTrigger value="health">
              <Activity className="h-4 w-4 mr-2" />
              System Health
            </TabsTrigger>
          </TabsList>

          <TabsContent value="provisioning">
            <Card>
              <CardHeader>
                <CardTitle>Organization Provisioning</CardTitle>
                <CardDescription>
                  Create and manage organizations, assign admins, and issue access codes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Create New Organization</h3>
                    <p className="text-sm text-muted-foreground">
                      Set up new broker companies with initial admin users
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Manage Access Codes</h3>
                    <p className="text-sm text-muted-foreground">
                      Issue and revoke cross-org access codes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Cross-Organization Analytics</CardTitle>
                <CardDescription>
                  Performance metrics and usage statistics across all organizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Active Users</h3>
                    <p className="text-sm text-muted-foreground">DAU/WAU/MAU metrics</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Scanner Performance</h3>
                    <p className="text-sm text-muted-foreground">P50/P95 processing times</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Top Brokers</h3>
                    <p className="text-sm text-muted-foreground">Most active users</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Policy Mix</h3>
                    <p className="text-sm text-muted-foreground">Distribution by class</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health">
            <Card>
              <CardHeader>
                <CardTitle>System Health & Operations</CardTitle>
                <CardDescription>
                  Real-time monitoring and operational metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">API Performance</h3>
                    <p className="text-sm text-muted-foreground">
                      Response times, error rates, and throughput
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Document Processing</h3>
                    <p className="text-sm text-muted-foreground">
                      Queue depth, success rates, and average processing time
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Database Health</h3>
                    <p className="text-sm text-muted-foreground">
                      Connection pool, query performance, and storage usage
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CCStaffDashboard;
