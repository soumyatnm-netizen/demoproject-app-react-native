import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Eye, Mail, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ClientData {
  id: string;
  client_name: string;
  report_title: string;
  report_status: string;
  created_at: string;
  report_data: any;
}

interface ClientManagementProps {
  onStatsUpdate: () => void;
}

const ClientManagement = ({ onStatsUpdate }: ClientManagementProps) => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  const [newClient, setNewClient] = useState({
    client_name: "",
    industry: "",
    revenue_band: "",
    employee_count: "",
    risk_profile: "",
    coverage_requirements: "",
    contact_email: "",
    contact_phone: "",
    notes: ""
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('client_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const clientData = {
        industry: newClient.industry,
        revenue_band: newClient.revenue_band,
        employee_count: parseInt(newClient.employee_count) || 0,
        risk_profile: newClient.risk_profile,
        coverage_requirements: newClient.coverage_requirements.split(',').map(s => s.trim()),
        contact_info: {
          email: newClient.contact_email,
          phone: newClient.contact_phone
        },
        notes: newClient.notes
      };

      const { error } = await supabase
        .from('client_reports')
        .insert({
          user_id: user.id,
          client_name: newClient.client_name,
          report_title: `${newClient.client_name} - Initial Assessment`,
          report_data: clientData,
          report_status: 'draft'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client added successfully",
      });

      setShowAddDialog(false);
      setNewClient({
        client_name: "",
        industry: "",
        revenue_band: "",
        employee_count: "",
        risk_profile: "",
        coverage_requirements: "",
        contact_email: "",
        contact_phone: "",
        notes: ""
      });
      fetchClients();
      onStatsUpdate();
    } catch (error) {
      console.error('Error adding client:', error);
      toast({
        title: "Error",
        description: "Failed to add client",
        variant: "destructive",
      });
    }
  };

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.report_title.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-bold">Client Management</h2>
          <p className="text-muted-foreground">Manage your client relationships and their insurance needs</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Enter client details and their insurance requirements
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  value={newClient.client_name}
                  onChange={(e) => setNewClient({ ...newClient, client_name: e.target.value })}
                  placeholder="ABC Corporation Ltd"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={newClient.industry} onValueChange={(value) => setNewClient({ ...newClient, industry: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="construction">Construction</SelectItem>
                      <SelectItem value="professional_services">Professional Services</SelectItem>
                      <SelectItem value="financial_services">Financial Services</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="revenue_band">Revenue Band</Label>
                  <Select value={newClient.revenue_band} onValueChange={(value) => setNewClient({ ...newClient, revenue_band: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select revenue band" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1m">£0 - £1M</SelectItem>
                      <SelectItem value="1-5m">£1M - £5M</SelectItem>
                      <SelectItem value="5-10m">£5M - £10M</SelectItem>
                      <SelectItem value="10-50m">£10M - £50M</SelectItem>
                      <SelectItem value="50m+">£50M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee_count">Employee Count</Label>
                  <Input
                    id="employee_count"
                    type="number"
                    value={newClient.employee_count}
                    onChange={(e) => setNewClient({ ...newClient, employee_count: e.target.value })}
                    placeholder="50"
                  />
                </div>
                
                <div>
                  <Label htmlFor="risk_profile">Risk Profile</Label>
                  <Select value={newClient.risk_profile} onValueChange={(value) => setNewClient({ ...newClient, risk_profile: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="coverage_requirements">Coverage Requirements</Label>
                <Input
                  id="coverage_requirements"
                  value={newClient.coverage_requirements}
                  onChange={(e) => setNewClient({ ...newClient, coverage_requirements: e.target.value })}
                  placeholder="Public Liability, Employers Liability, Professional Indemnity"
                />
                <p className="text-xs text-muted-foreground mt-1">Separate multiple coverages with commas</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={newClient.contact_email}
                    onChange={(e) => setNewClient({ ...newClient, contact_email: e.target.value })}
                    placeholder="contact@client.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={newClient.contact_phone}
                    onChange={(e) => setNewClient({ ...newClient, contact_phone: e.target.value })}
                    placeholder="+44 20 1234 5678"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newClient.notes}
                  onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  placeholder="Additional notes about the client..."
                  rows={3}
                />
              </div>

              <Button onClick={handleAddClient} className="w-full">
                Add Client
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
                placeholder="Search clients..."
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
                <TableHead>Client Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{client.client_name}</div>
                        <div className="text-sm text-muted-foreground">{client.report_title}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.report_data?.industry ? (
                      <Badge variant="outline">
                        {client.report_data.industry}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={client.report_status === 'completed' ? 'default' : 'secondary'}
                    >
                      {client.report_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(client.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Mail className="h-4 w-4" />
                      </Button>
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

export default ClientManagement;