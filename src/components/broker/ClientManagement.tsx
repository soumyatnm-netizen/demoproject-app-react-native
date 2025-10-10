import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Eye, Mail, Building2, FileUp, Target, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { DocumentUpload } from "./DocumentUpload";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import ClientInsurerMatching from "./ClientInsurerMatching";

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
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editingClientData, setEditingClientData] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientData | null>(null);
  const { toast } = useToast();

  // Status options with their corresponding colors
  const statusOptions = [
    { value: 'quote_stage', label: 'Quote Stage', color: 'bg-blue-500' },
    { value: 'negotiation', label: 'Negotiation', color: 'bg-purple-500' },
    { value: 'current_client', label: 'Current Client', color: 'bg-green-500' },
    { value: 'renewal_approaching', label: 'Renewal Approaching', color: 'bg-orange-500' },
    { value: 'lost_client', label: 'Lost Client', color: 'bg-red-500' },
    { value: 'draft', label: 'Draft', color: 'bg-gray-500' }
  ];

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.color : 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.label : status;
  };

  const handleStatusChange = async (clientId: string, newStatus: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('client_reports')
        .update({ report_status: newStatus })
        .eq('id', clientId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client status updated successfully",
      });

      // Refresh the clients list
      await fetchClients();
      onStatsUpdate();

    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error", 
        description: "Failed to update client status",
        variant: "destructive",
      });
    }
  };

  const [newClient, setNewClient] = useState({
    client_name: "",
    industry: "",
    revenue_band: "",
    employee_count: "",
    coverage_requirements: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
    main_address: "",
    postcode: "",
    date_established: "",
    organisation_type: "",
    website: "",
    wage_roll: ""
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
        coverage_requirements: "",
        contact_email: "",
        contact_phone: "",
        notes: "",
        main_address: "",
        postcode: "",
        date_established: "",
        organisation_type: "",
        website: "",
        wage_roll: ""
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

  const handleClientExtracted = (extractedData: any) => {
    // Map extracted data to newClient format - using actual API field names
    const mappedClient = {
      client_name: extractedData["Business/Client name"] || extractedData.client_name || "",
      industry: extractedData["Industry"] || extractedData.industry || "",
      revenue_band: extractedData["Revenue Band"] || extractedData.revenue_band || "",
      employee_count: extractedData["Employee Count"]?.toString() || extractedData["Total number of employees"]?.toString() || extractedData.employee_count?.toString() || "",
      coverage_requirements: Array.isArray(extractedData["Coverage Requirements"]) 
        ? extractedData["Coverage Requirements"].join(', ')
        : Array.isArray(extractedData.coverage_requirements)
        ? extractedData.coverage_requirements.join(', ') 
        : extractedData["Coverage Requirements"] || extractedData.coverage_requirements || "",
      contact_email: extractedData["Contact Email"] || extractedData.contact_email || "",
      contact_phone: extractedData["Contact Phone"] || extractedData.contact_phone || "",
      notes: `Auto-extracted from document${extractedData["Website"] || extractedData.website ? `\nWebsite: ${extractedData["Website"] || extractedData.website}` : ''}`,
      main_address: extractedData["Main address"] || extractedData.main_address || "",
      postcode: extractedData["Postcode"] || extractedData.postcode || "",
      date_established: extractedData["Date business established"] || extractedData.date_established || "",
      organisation_type: extractedData["Type of organisation"] || extractedData.organisation_type || "",
      website: extractedData["Website"] || extractedData.website || "",
      wage_roll: (extractedData["Total wage roll"] || extractedData.wage_roll)?.toString() || ""
    };

    setNewClient(mappedClient);
    setShowUploadDialog(false);
    setShowAddDialog(true);
  };

  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.report_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewClient = (client: ClientData) => {
    setSelectedClient(client);
    setEditingClientData({
      client_name: client.client_name,
      industry: client.report_data?.industry || '',
      revenue_band: client.report_data?.revenue_band || '',
      employee_count: client.report_data?.employee_count?.toString() || '',
      contact_email: client.report_data?.contact_info?.email || '',
      contact_phone: client.report_data?.contact_info?.phone || '',
      coverage_requirements: Array.isArray(client.report_data?.coverage_requirements) 
        ? client.report_data.coverage_requirements.join(', ')
        : client.report_data?.coverage_requirements || '',
      notes: client.report_data?.notes || '',
      main_address: client.report_data?.main_address || '',
      postcode: client.report_data?.postcode || '',
      date_established: client.report_data?.date_established || '',
      organisation_type: client.report_data?.organisation_type || '',
      website: client.report_data?.website || '',
      wage_roll: client.report_data?.wage_roll?.toString() || '',
      report_title: client.report_title,
      report_status: client.report_status || 'draft'
    });
    setShowClientDetails(true);
  };

  const handleEditClient = () => {
    setIsEditingClient(true);
  };

  const handleCancelEdit = () => {
    setIsEditingClient(false);
    // Reset editing data to original values
    if (selectedClient) {
      setEditingClientData({
        client_name: selectedClient.client_name,
        industry: selectedClient.report_data?.industry || '',
        revenue_band: selectedClient.report_data?.revenue_band || '',
        employee_count: selectedClient.report_data?.employee_count?.toString() || '',
        contact_email: selectedClient.report_data?.contact_info?.email || '',
        contact_phone: selectedClient.report_data?.contact_info?.phone || '',
        coverage_requirements: Array.isArray(selectedClient.report_data?.coverage_requirements) 
          ? selectedClient.report_data.coverage_requirements.join(', ')
          : selectedClient.report_data?.coverage_requirements || '',
        notes: selectedClient.report_data?.notes || '',
        main_address: selectedClient.report_data?.main_address || '',
        postcode: selectedClient.report_data?.postcode || '',
        date_established: selectedClient.report_data?.date_established || '',
        organisation_type: selectedClient.report_data?.organisation_type || '',
        website: selectedClient.report_data?.website || '',
        wage_roll: selectedClient.report_data?.wage_roll?.toString() || '',
        report_title: selectedClient.report_title,
        report_status: selectedClient.report_status || 'draft'
      });
    }
  };

  const handleSaveClient = async () => {
    if (!selectedClient || !editingClientData) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const updatedClientData = {
        industry: editingClientData.industry,
        revenue_band: editingClientData.revenue_band,
        employee_count: parseInt(editingClientData.employee_count) || 0,
        coverage_requirements: editingClientData.coverage_requirements.split(',').map((s: string) => s.trim()).filter(Boolean),
        contact_info: {
          email: editingClientData.contact_email,
          phone: editingClientData.contact_phone
        },
        notes: editingClientData.notes,
        main_address: editingClientData.main_address,
        postcode: editingClientData.postcode,
        date_established: editingClientData.date_established,
        organisation_type: editingClientData.organisation_type,
        website: editingClientData.website,
        wage_roll: editingClientData.wage_roll
      };

      const { error } = await supabase
        .from('client_reports')
        .update({
          client_name: editingClientData.client_name,
          report_title: editingClientData.report_title,
          report_data: updatedClientData,
          report_status: editingClientData.report_status
        })
        .eq('id', selectedClient.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client information updated successfully",
      });

      // Refresh the clients list and update the selected client
      await fetchClients();
      
      // Update the selected client with new data
      const updatedClient = {
        ...selectedClient,
        client_name: editingClientData.client_name,
        report_title: editingClientData.report_title,
        report_data: updatedClientData,
        report_status: editingClientData.report_status
      };
      setSelectedClient(updatedClient);
      setIsEditingClient(false);
      onStatsUpdate();

    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: "Failed to update client information",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('client_reports')
        .delete()
        .eq('id', clientToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client deleted successfully",
      });

      setDeleteDialogOpen(false);
      setClientToDelete(null);
      
      // If the deleted client was being viewed, close the details dialog
      if (selectedClient?.id === clientToDelete.id) {
        setShowClientDetails(false);
        setSelectedClient(null);
      }

      await fetchClients();
      onStatsUpdate();

    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteClient = (client: ClientData) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

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
        
        <div className="flex space-x-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
          </Dialog>
          
          <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
            <FileUp className="h-4 w-4 mr-2" />
            AI Client Upload
          </Button>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="main_address">Main Address</Label>
                  <Input
                    id="main_address"
                    value={newClient.main_address}
                    onChange={(e) => setNewClient({ ...newClient, main_address: e.target.value })}
                    placeholder="123 Business Street, London"
                  />
                </div>
                
                <div>
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={newClient.postcode}
                    onChange={(e) => setNewClient({ ...newClient, postcode: e.target.value })}
                    placeholder="SW1A 1AA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_established">Date Established</Label>
                  <Input
                    id="date_established"
                    value={newClient.date_established}
                    onChange={(e) => setNewClient({ ...newClient, date_established: e.target.value })}
                    placeholder="01/01/2010"
                  />
                </div>
                
                <div>
                  <Label htmlFor="organisation_type">Organisation Type</Label>
                  <Input
                    id="organisation_type"
                    value={newClient.organisation_type}
                    onChange={(e) => setNewClient({ ...newClient, organisation_type: e.target.value })}
                    placeholder="Ltd, PLC, Partnership, etc."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={newClient.website}
                  onChange={(e) => setNewClient({ ...newClient, website: e.target.value })}
                  placeholder="https://www.client.com"
                />
              </div>

              <div>
                <Label htmlFor="wage_roll">Total Wage Roll (£)</Label>
                <Input
                  id="wage_roll"
                  type="number"
                  value={newClient.wage_roll}
                  onChange={(e) => setNewClient({ ...newClient, wage_roll: e.target.value })}
                  placeholder="2500000"
                />
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

        <DocumentUpload 
          open={showUploadDialog} 
          onOpenChange={setShowUploadDialog}
          onClientExtracted={handleClientExtracted}
        />
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 hover:bg-transparent"
                        >
                          <Badge 
                            variant="secondary"
                            className={`text-white ${getStatusColor(client.report_status || 'draft')} cursor-pointer hover:opacity-80 flex items-center gap-1`}
                          >
                            {getStatusLabel(client.report_status || 'draft')}
                            <ChevronDown className="h-3 w-3" />
                          </Badge>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0 bg-background border shadow-lg" align="start">
                        <Command>
                          <CommandList>
                            <CommandGroup>
                              {statusOptions.map((status) => (
                                <CommandItem
                                  key={status.value}
                                  value={status.value}
                                  onSelect={() => handleStatusChange(client.id, status.value)}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                                  <span>{status.label}</span>
                                  {client.report_status === status.value && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    {new Date(client.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewClient(client)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => confirmDeleteClient(client)}
                        className="hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Client Details Modal */}
      <Dialog open={showClientDetails} onOpenChange={(open) => {
        setShowClientDetails(open);
        if (!open) {
          setIsEditingClient(false);
          setSelectedClient(null);
          setEditingClientData(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>{isEditingClient ? editingClientData?.client_name : selectedClient?.client_name}</span>
              </div>
              <div className="flex items-center space-x-2">
                {!isEditingClient ? (
                  <Button onClick={handleEditClient} size="sm" variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleCancelEdit} size="sm" variant="outline">
                      Cancel
                    </Button>
                    <Button onClick={handleSaveClient} size="sm">
                      Save Changes
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
            <DialogDescription>
              {isEditingClient ? 'Edit client profile and information' : 'Comprehensive client profile and information'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedClient && editingClientData && (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Client Name</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.client_name}
                          onChange={(e) => setEditingClientData({...editingClientData, client_name: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.client_name}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Industry</Label>
                      {isEditingClient ? (
                        <Select value={editingClientData.industry} onValueChange={(value) => setEditingClientData({...editingClientData, industry: value})}>
                          <SelectTrigger className="mt-1">
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
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.industry || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Revenue Band</Label>
                      {isEditingClient ? (
                        <Select value={editingClientData.revenue_band} onValueChange={(value) => setEditingClientData({...editingClientData, revenue_band: value})}>
                          <SelectTrigger className="mt-1">
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
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.revenue_band || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Employee Count</Label>
                      {isEditingClient ? (
                        <Input
                          type="number"
                          value={editingClientData.employee_count}
                          onChange={(e) => setEditingClientData({...editingClientData, employee_count: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.employee_count || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      {isEditingClient ? (
                        <Select value={editingClientData.report_status} onValueChange={(value) => setEditingClientData({...editingClientData, report_status: value})}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-50">
                            {statusOptions.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                <div className="flex items-center space-x-2">
                                  <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                                  <span>{status.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge 
                          variant="secondary"
                          className={`text-white ${getStatusColor(selectedClient.report_status || 'draft')} mt-1`}
                        >
                          {getStatusLabel(selectedClient.report_status || 'draft')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                      {isEditingClient ? (
                        <Input
                          type="email"
                          value={editingClientData.contact_email}
                          onChange={(e) => setEditingClientData({...editingClientData, contact_email: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.contact_info?.email || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.contact_phone}
                          onChange={(e) => setEditingClientData({...editingClientData, contact_phone: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.contact_info?.phone || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Coverage Requirements */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Coverage Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditingClient ? (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Coverage Requirements</Label>
                      <Input
                        value={editingClientData.coverage_requirements}
                        onChange={(e) => setEditingClientData({...editingClientData, coverage_requirements: e.target.value})}
                        placeholder="Public Liability, Employers Liability, Professional Indemnity"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Separate multiple coverages with commas</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedClient.report_data?.coverage_requirements?.map((requirement: string, index: number) => (
                        <Badge key={index} variant="secondary">
                          {requirement}
                        </Badge>
                      )) || <p className="text-sm text-muted-foreground">No coverage requirements specified</p>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Additional Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Additional Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Main Address</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.main_address}
                          onChange={(e) => setEditingClientData({...editingClientData, main_address: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.main_address || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Postcode</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.postcode}
                          onChange={(e) => setEditingClientData({...editingClientData, postcode: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.postcode || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Date Established</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.date_established}
                          onChange={(e) => setEditingClientData({...editingClientData, date_established: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.date_established || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Organisation Type</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.organisation_type}
                          onChange={(e) => setEditingClientData({...editingClientData, organisation_type: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_data?.organisation_type || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Website</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.website}
                          onChange={(e) => setEditingClientData({...editingClientData, website: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">
                          {selectedClient.report_data?.website ? (
                            <a 
                              href={selectedClient.report_data.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {selectedClient.report_data.website}
                            </a>
                          ) : 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Total Wage Roll</Label>
                      {isEditingClient ? (
                        <Input
                          type="number"
                          value={editingClientData.wage_roll}
                          onChange={(e) => setEditingClientData({...editingClientData, wage_roll: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">
                          {selectedClient.report_data?.wage_roll ? 
                            `£${Number(selectedClient.report_data.wage_roll).toLocaleString()}` : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditingClient ? (
                    <Textarea
                      value={editingClientData.notes}
                      onChange={(e) => setEditingClientData({...editingClientData, notes: e.target.value})}
                      placeholder="Additional notes about the client..."
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{selectedClient.report_data?.notes || 'No notes available'}</p>
                  )}
                </CardContent>
              </Card>

              {/* Report Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Report Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Report Title</Label>
                      {isEditingClient ? (
                        <Input
                          value={editingClientData.report_title}
                          onChange={(e) => setEditingClientData({...editingClientData, report_title: e.target.value})}
                          className="mt-1"
                        />
                      ) : (
                        <p className="text-sm">{selectedClient.report_title}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Created Date</Label>
                      <p className="text-sm">{new Date(selectedClient.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Insurer Matching Section */}
              {!isEditingClient && (
                <ClientInsurerMatching client={selectedClient} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{clientToDelete?.client_name}</strong> and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClientToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteClient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientManagement;