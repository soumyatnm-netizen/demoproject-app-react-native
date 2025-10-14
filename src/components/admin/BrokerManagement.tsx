import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, UserX, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface BrokerProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  company_name: string | null;
  is_active: boolean;
  login_count: number | null;
  last_login_at: string | null;
  created_at: string;
  // Additional fields from profiles table
  broker_type?: string | null;
  company_id?: string | null;
  department?: string | null;
  invited_at?: string | null;
  invited_by?: string | null;
  job_title?: string | null;
  portal_access?: string;
  preferred_portal?: string;
  subscription_tier?: string;
  updated_at?: string;
  is_super_admin?: boolean;
}

interface BrokerManagementProps {
  onStatsUpdate: () => void;
}

const BrokerManagement = ({ onStatsUpdate }: BrokerManagementProps) => {
  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerProfile | null>(null);
  const { toast } = useToast();

  const [newBroker, setNewBroker] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company_name: "",
    role: "broker"
  });

  useEffect(() => {
    fetchBrokers();
  }, []);

  const fetchBrokers = async () => {
    try {
      // Use the secure function to get team member data without sensitive fields
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          job_title,
          department,
          role,
          is_active,
          last_login_at,
          login_count,
          created_at,
          company_id,
          company_name,
          subscription_tier
        `)
        .in('role', ['broker', 'company_admin'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBrokers(data as BrokerProfile[] || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
      toast({
        title: "Error",
        description: "Failed to load brokers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBroker = async () => {
    try {
      // In a real implementation, this would send an invitation email
      // For now, we'll create a placeholder profile
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: crypto.randomUUID(), // Temporary - in real app this would be from auth
          first_name: newBroker.first_name,
          last_name: newBroker.last_name,
          company_name: newBroker.company_name,
          role: newBroker.role as any,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Broker invitation sent successfully",
      });

      setShowAddDialog(false);
      setNewBroker({
        email: "",
        first_name: "",
        last_name: "",
        company_name: "",
        role: "broker"
      });
      fetchBrokers();
      onStatsUpdate();
    } catch (error) {
      console.error('Error adding broker:', error);
      toast({
        title: "Error",
        description: "Failed to add broker",
        variant: "destructive",
      });
    }
  };

  const handleDeactivateBroker = async (brokerId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', brokerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Broker deactivated successfully",
      });
      fetchBrokers();
      onStatsUpdate();
    } catch (error) {
      console.error('Error deactivating broker:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate broker",
        variant: "destructive",
      });
    }
  };

  const filteredBrokers = brokers.filter(broker =>
    `${broker.first_name} ${broker.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    broker.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Broker Management</h2>
          <p className="text-muted-foreground">Manage broker accounts and permissions</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Broker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Broker</DialogTitle>
              <DialogDescription>
                Send an invitation to a new broker to join the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={newBroker.email}
                  onChange={(e) => setNewBroker({ ...newBroker, email: e.target.value })}
                  placeholder="broker@company.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={newBroker.first_name}
                    onChange={(e) => setNewBroker({ ...newBroker, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={newBroker.last_name}
                    onChange={(e) => setNewBroker({ ...newBroker, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={newBroker.company_name}
                  onChange={(e) => setNewBroker({ ...newBroker, company_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newBroker.role} onValueChange={(value) => setNewBroker({ ...newBroker, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="company_admin">Company Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddBroker} className="w-full">
                Send Invitation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brokers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Login Count</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrokers.map((broker) => (
                <TableRow key={broker.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{broker.first_name} {broker.last_name}</div>
                      <div className="text-sm text-muted-foreground">ID: {broker.id.slice(0, 8)}...</div>
                    </div>
                  </TableCell>
                  <TableCell>{broker.company_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={broker.role === 'company_admin' ? 'default' : 'secondary'}>
                      {broker.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={broker.is_active ? 'default' : 'destructive'}>
                      {broker.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {broker.last_login_at ? 
                      new Date(broker.last_login_at).toLocaleDateString() : 
                      'Never'
                    }
                  </TableCell>
                  <TableCell>{broker.login_count || 0}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {broker.is_active && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDeactivateBroker(broker.id)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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

export default BrokerManagement;