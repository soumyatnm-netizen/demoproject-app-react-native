import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Key, Copy, Check, Settings, Mail, Eye, Trash2, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientAccountsProps {
  onManageFeatures?: (companyId: string) => void;
}

const ClientAccounts = ({ onManageFeatures }: ClientAccountsProps = {}) => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCompanyInvitesDialog, setShowCompanyInvitesDialog] = useState(false);
  const [showCompanyDetailsDialog, setShowCompanyDetailsDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [companyInvites, setCompanyInvites] = useState<any[]>([]);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [companyDocuments, setCompanyDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [showDeleteCompanyDialog, setShowDeleteCompanyDialog] = useState(false);
  
  // Form states
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("basic");
  const [maxUsers, setMaxUsers] = useState("10");
  
  // Invite form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("broker");
  
  useEffect(() => {
    loadCompanies();
    loadPendingInvites();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_companies')
        .select('*, profiles(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPendingInvites = async () => {
    try {
      // First get the invites
      const { data: invites, error: invitesError } = await supabase
        .from('company_invites')
        .select('*')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;

      if (!invites || invites.length === 0) {
        setPendingInvites([]);
        return;
      }

      // Then get company names separately
      const companyIds = [...new Set(invites.map(inv => inv.company_id))];
      const { data: companiesData, error: companiesError } = await supabase
        .from('broker_companies')
        .select('id, name')
        .in('id', companyIds);

      if (companiesError) throw companiesError;

      // Map company names to invites
      const companiesMap = new Map(companiesData?.map(c => [c.id, c.name]) || []);
      const invitesWithCompanyNames = invites.map(invite => ({
        ...invite,
        company_name: companiesMap.get(invite.company_id) || 'Unknown',
      }));

      setPendingInvites(invitesWithCompanyNames);
    } catch (error) {
      console.error('Error loading pending invites:', error);
    }
  };

  const createCompany = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_companies')
        .insert({
          name: companyName,
          domain: companyDomain || null,
          subscription_tier: subscriptionTier,
          max_users: parseInt(maxUsers),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Company "${companyName}" created successfully`,
      });

      setShowCreateDialog(false);
      setCompanyName("");
      setCompanyDomain("");
      setSubscriptionTier("basic");
      setMaxUsers("10");
      loadCompanies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createInvite = async () => {
    if (!selectedCompany) return;

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const email = inviteEmail.toLowerCase().trim();

      // First check if there's an existing pending invite
      const { data: existingInvites, error: checkError } = await supabase
        .from('company_invites')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('email', email)
        .is('used_at', null);

      if (checkError) {
        console.warn('Error checking existing invites:', checkError);
      }

      // If there are existing invites, delete them first
      if (existingInvites && existingInvites.length > 0) {
        const { error: deleteError } = await supabase
          .from('company_invites')
          .delete()
          .eq('company_id', selectedCompany.id)
          .eq('email', email)
          .is('used_at', null);

        if (deleteError) {
          console.warn('Error deleting existing invites:', deleteError);
          // Continue anyway - maybe the constraint will handle it
        }
      }

      // Generate new invite code
      const { data: inviteData, error: inviteError } = await supabase
        .rpc('generate_invite_code')
        .single();

      if (inviteError) throw inviteError;

      const inviteCode = inviteData || await generateFallbackCode();

      // Create new invite
      const { error } = await supabase
        .from('company_invites')
        .insert([{
          company_id: selectedCompany.id,
          email: email,
          role: inviteRole as any,
          invited_by: userId,
          invite_code: inviteCode,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }]);

      if (error) throw error;

      // Send invite email
      try {
        await supabase.functions.invoke('send-company-invite', {
          body: {
            email: email,
            companyName: selectedCompany.name,
            inviteCode: inviteCode,
            role: inviteRole,
          },
        });
        
        toast({
          title: "Success",
          description: `Invitation sent to ${email}`,
        });
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
        toast({
          title: "Partial Success",
          description: `Invite created for ${email} but email failed to send`,
          variant: "destructive",
        });
      }

      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("broker");
      loadPendingInvites(); // Refresh pending invites
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('company_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invite deleted successfully",
      });

      // Refresh all invite lists
      loadPendingInvites();
      if (selectedCompany) {
        loadCompanyInvites(selectedCompany.id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setDeleteInviteId(null);
    }
  };

  const confirmDeleteInvite = (inviteId: string) => {
    setDeleteInviteId(inviteId);
    setShowDeleteDialog(true);
  };

  const deleteCompany = async (companyId: string) => {
    try {
      const { error } = await supabase
        .from('broker_companies')
        .delete()
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company deleted successfully",
      });

      loadCompanies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setShowDeleteCompanyDialog(false);
      setDeleteCompanyId(null);
    }
  };

  const confirmDeleteCompany = (companyId: string) => {
    setDeleteCompanyId(companyId);
    setShowDeleteCompanyDialog(true);
  };

  const generateFallbackCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };

  const loadCompanyInvites = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_invites')
        .select('*')
        .eq('company_id', companyId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanyInvites(data || []);
    } catch (error) {
      console.error('Error loading company invites:', error);
      toast({
        title: "Error",
        description: "Failed to load company invites",
        variant: "destructive",
      });
    }
  };

  const loadCompanyUsers = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanyUsers(data || []);
    } catch (error) {
      console.error('Error loading company users:', error);
      toast({
        title: "Error",
        description: "Failed to load company users",
        variant: "destructive",
      });
    }
  };

  const loadCompanyDocuments = async (companyId: string) => {
    setLoadingDocuments(true);
    try {
      // Fetch quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('structured_quotes')
        .select('id, client_name, insurer_name, created_at, document_id, premium_amount, premium_currency')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      // Fetch policy wordings
      const { data: wordings, error: wordingsError } = await supabase
        .from('policy_wordings')
        .select('id, insurer_name, policy_version, created_at, document_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (wordingsError) throw wordingsError;

      // Fetch documents for storage paths
      const documentIds = [
        ...(quotes?.map(q => q.document_id).filter(Boolean) || []),
        ...(wordings?.map(w => w.document_id).filter(Boolean) || [])
      ];

      let documentsMap = new Map();
      if (documentIds.length > 0) {
        const { data: docs, error: docsError } = await supabase
          .from('documents')
          .select('id, filename, storage_path')
          .in('id', documentIds);

        if (!docsError && docs) {
          documentsMap = new Map(docs.map(d => [d.id, d]));
        }
      }

      // Combine and format documents
      const allDocs = [
        ...(quotes?.map(q => ({
          id: q.id,
          type: 'quote',
          name: `${q.client_name} - ${q.insurer_name}`,
          insurer: q.insurer_name,
          client: q.client_name,
          created_at: q.created_at,
          document_id: q.document_id,
          filename: documentsMap.get(q.document_id)?.filename,
          storage_path: documentsMap.get(q.document_id)?.storage_path,
          premium: q.premium_amount ? `${q.premium_currency} ${Number(q.premium_amount).toLocaleString()}` : null,
        })) || []),
        ...(wordings?.map(w => ({
          id: w.id,
          type: 'wording',
          name: `${w.insurer_name} - Policy Wording${w.policy_version ? ` (${w.policy_version})` : ''}`,
          insurer: w.insurer_name,
          created_at: w.created_at,
          document_id: w.document_id,
          filename: documentsMap.get(w.document_id)?.filename,
          storage_path: documentsMap.get(w.document_id)?.storage_path,
        })) || [])
      ];

      // Sort by date
      allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setCompanyDocuments(allDocs);
    } catch (error) {
      console.error('Error loading company documents:', error);
      toast({
        title: "Error",
        description: "Failed to load company documents",
        variant: "destructive",
      });
    } finally {
      setLoadingDocuments(false);
    }
  };

  const downloadDocument = async (doc: any) => {
    if (!doc.storage_path) {
      toast({
        title: "Error",
        description: "Document file not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // All documents are stored in the 'documents' bucket
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename || `document-${doc.id}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Document downloaded successfully",
      });
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const viewCompanyInvites = async (company: any) => {
    setSelectedCompany(company);
    await loadCompanyInvites(company.id);
    setShowCompanyInvitesDialog(true);
  };

  const viewCompanyDetails = async (company: any) => {
    setSelectedCompany(company);
    await Promise.all([
      loadCompanyUsers(company.id),
      loadCompanyDocuments(company.id)
    ]);
    setShowCompanyDetailsDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Pending Invites Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            {pendingInvites.length === 0 
              ? "No pending invitations at the moment" 
              : `${pendingInvites.length} active invite(s) waiting to be used`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingInvites.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending invites</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invite Code</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>{invite.company_name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invite.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCode(invite.invite_code)}
                      >
                        {copiedCode === invite.invite_code ? (
                          <Check className="h-4 w-4 mr-2" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        {invite.invite_code}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDeleteInvite(invite.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Companies Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Client Organisations</CardTitle>
              <CardDescription>Manage client accounts and access codes</CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Company
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Company</DialogTitle>
                  <DialogDescription>Set up a new client organisation</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Insurance Brokers"
                    />
                  </div>
                  <div>
                    <Label htmlFor="domain">Domain (Optional)</Label>
                    <Input
                      id="domain"
                      value={companyDomain}
                      onChange={(e) => setCompanyDomain(e.target.value)}
                      placeholder="acme.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tier">Subscription Tier</Label>
                    <Select value={subscriptionTier} onValueChange={setSubscriptionTier}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="maxUsers">Max Users</Label>
                    <Input
                      id="maxUsers"
                      type="number"
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                  <Button onClick={createCompany} className="w-full">
                    Create Company
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading companies...</p>
          ) : companies.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No companies yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Company Code</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{company.name}</p>
                        {company.domain && (
                          <p className="text-sm text-muted-foreground">{company.domain}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.subscription_tier}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {company.profiles?.[0]?.count || 0} / {company.max_users}
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.company_code ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCode(company.company_code)}
                        >
                          {copiedCode === company.company_code ? (
                            <Check className="h-4 w-4 mr-2" />
                          ) : (
                            <Copy className="h-4 w-4 mr-2" />
                          )}
                          {company.company_code}
                        </Button>
                      ) : (
                        <Badge variant="secondary">No code</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewCompanyInvites(company)}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Invites
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewCompanyDetails(company)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCompany(company);
                            setShowInviteDialog(true);
                          }}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Invite
                        </Button>
                        {onManageFeatures && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onManageFeatures(company.id)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Features
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDeleteCompany(company.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invite</DialogTitle>
            <DialogDescription>
              Invite a user to {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createInvite} className="w-full">
              Create Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Invites Dialog */}
      <Dialog open={showCompanyInvitesDialog} onOpenChange={setShowCompanyInvitesDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pending Invites - {selectedCompany?.name}</DialogTitle>
            <DialogDescription>
              Active invitations for this company
            </DialogDescription>
          </DialogHeader>
          {companyInvites.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending invites</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invite Code</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invite.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCode(invite.invite_code)}
                      >
                        {copiedCode === invite.invite_code ? (
                          <Check className="h-4 w-4 mr-2" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        {invite.invite_code}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDeleteInvite(invite.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Company Details Dialog */}
      <Dialog open={showCompanyDetailsDialog} onOpenChange={setShowCompanyDetailsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Company Details - {selectedCompany?.name}</DialogTitle>
            <DialogDescription>
              View company information and users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Company Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-sm font-medium">Company Name</Label>
                <p className="text-sm">{selectedCompany?.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Subscription Tier</Label>
                <Badge>{selectedCompany?.subscription_tier}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium">Company Code</Label>
                <p className="text-sm font-mono">{selectedCompany?.company_code}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Max Users</Label>
                <p className="text-sm">{selectedCompany?.max_users}</p>
              </div>
              {selectedCompany?.domain && (
                <div>
                  <Label className="text-sm font-medium">Domain</Label>
                  <p className="text-sm">{selectedCompany.domain}</p>
                </div>
              )}
            </div>

            {/* Users List */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Active Users ({companyUsers.length})</h3>
              {companyUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No users yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyUsers.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{user.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.last_login_at 
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Documents List */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                <FileText className="h-5 w-5 inline mr-2" />
                Documents ({companyDocuments.length})
              </h3>
              {loadingDocuments ? (
                <p className="text-center text-muted-foreground py-8">Loading documents...</p>
              ) : companyDocuments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No documents uploaded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Insurer</TableHead>
                      <TableHead>Premium</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyDocuments.map((doc) => (
                      <TableRow key={`${doc.type}-${doc.id}`}>
                        <TableCell>
                          <Badge variant={doc.type === 'quote' ? "default" : "secondary"}>
                            {doc.type === 'quote' ? 'Quote' : 'Wording'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {doc.name}
                        </TableCell>
                        <TableCell>{doc.client || '-'}</TableCell>
                        <TableCell>{doc.insurer}</TableCell>
                        <TableCell className="text-sm">
                          {doc.premium || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadDocument(doc)}
                            disabled={!doc.storage_path}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invite</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invitation? This action cannot be undone.
              The invite code will be permanently removed and can no longer be used.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteInviteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteInviteId && deleteInvite(deleteInviteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Company Confirmation Dialog */}
      <AlertDialog open={showDeleteCompanyDialog} onOpenChange={setShowDeleteCompanyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone.
              All associated users, invites, and data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteCompanyId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCompanyId && deleteCompany(deleteCompanyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientAccounts;
