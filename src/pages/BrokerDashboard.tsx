import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, User, LayoutDashboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useRole } from '@/hooks/useRole';
import { useNavigate } from 'react-router-dom';
import ClientManagement from '@/components/broker/ClientManagement';
import InstantQuoteComparison from '@/components/InstantQuoteComparison';
import DocumentManagement from '@/components/broker/DocumentManagement';
import AppetiteGuidesViewer from '@/components/broker/AppetiteGuidesViewer';
import InsurerMatching from '@/components/broker/InsurerMatching';
import AttackingBrokerIntelligence from '@/components/AttackingBrokerIntelligence';
import MarketIntelligenceDashboard from '@/components/MarketIntelligenceDashboard';
import BrokerProfile from '@/components/broker/BrokerProfile';

const BrokerDashboard = () => {
  const [activeTab, setActiveTab] = useState('instant-comparison');
  const { toast } = useToast();
  const { role, isAdmin } = useRole();
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
              Broker Portal
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge variant="default">{role}</Badge>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin')}
              >
                <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin Portal</span>
              </Button>
            )}
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
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="instant-comparison">Instant Comparison</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="appetites">Appetites</TabsTrigger>
            <TabsTrigger value="matching">Matching</TabsTrigger>
            <TabsTrigger value="attack-intel">Attack Intel</TabsTrigger>
            <TabsTrigger value="market-intel">Market Intel</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="instant-comparison">
            <InstantQuoteComparison />
          </TabsContent>

          <TabsContent value="clients">
            <ClientManagement onStatsUpdate={() => {}} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentManagement />
          </TabsContent>

          <TabsContent value="appetites">
            <AppetiteGuidesViewer />
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
            <BrokerProfile />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BrokerDashboard;
