import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, User, LayoutDashboard, Users, TrendingUp, FileText, Target, Upload, UserPlus, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useRole } from '@/hooks/useRole';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('team-management');
  const { toast } = useToast();
  const { role } = useRole();
  const navigate = useNavigate();

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
              Client Admin Portal
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge variant="default">{role}</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app')}
            >
              <LayoutDashboard className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Broker Portal</span>
            </Button>
            <Button
              variant={activeTab === "profile" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("profile")}
            >
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
            <TabsTrigger value="team-management">
              <Users className="h-4 w-4 mr-2" />
              Team
            </TabsTrigger>
            <TabsTrigger value="market-intel">
              <TrendingUp className="h-4 w-4 mr-2" />
              Market
            </TabsTrigger>
            <TabsTrigger value="clients">
              <FileText className="h-4 w-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="comparison">
              <Target className="h-4 w-4 mr-2" />
              Compare
            </TabsTrigger>
            <TabsTrigger value="documents">
              <Upload className="h-4 w-4 mr-2" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="matching">Matching</TabsTrigger>
            <TabsTrigger value="attack-intel">Attack</TabsTrigger>
            <TabsTrigger value="invite-codes">
              <UserPlus className="h-4 w-4 mr-2" />
              Invites
            </TabsTrigger>
            <TabsTrigger value="usage">
              <BarChart3 className="h-4 w-4 mr-2" />
              Usage
            </TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="team-management">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Team Management</h2>
              <p className="text-muted-foreground">
                Invite users, assign roles (BROKER/ADMIN), deactivate users, and manage team access.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="market-intel">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Market Intelligence</h2>
              <p className="text-muted-foreground">
                Org-level dashboards, trends, and export capabilities.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="clients">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Client Management</h2>
              <p className="text-muted-foreground">
                Full org client list, ownership, broker assignment, and health tags.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="comparison">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Instant Comparison</h2>
              <p className="text-muted-foreground">
                Same engine as broker portal, org-wide with audit trail.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Documents & Appetite Guides</h2>
              <p className="text-muted-foreground">
                Upload, version, and publish guides to org brokers.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="matching">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Insurer Matching</h2>
              <p className="text-muted-foreground">
                Configure appetite metadata and preferred markets for the org.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="attack-intel">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Attack Intelligence</h2>
              <p className="text-muted-foreground">
                Org-level feed and client targeting.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="invite-codes">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Company Invitation Codes</h2>
              <p className="text-muted-foreground">
                Mint, list, and revoke codes for staff onboarding.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="usage">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">Company Usage</h2>
              <p className="text-muted-foreground">
                Broker activity (DAU/WAU), docs scanned, comparisons run, and analytics.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-2xl font-bold mb-4">My Profile</h2>
              <p className="text-muted-foreground">
                Admin details and billing/plan management.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
