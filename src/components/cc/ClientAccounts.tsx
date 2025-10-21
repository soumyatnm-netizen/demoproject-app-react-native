import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Key, Copy, Check, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientAccountsProps {
  onManageFeatures?: (companyId: string) => void;
}

const ClientAccounts = ({ onManageFeatures }: ClientAccountsProps = {}) => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
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

      // Call the function to generate the invite code
      const { data: inviteData, error: inviteError } = await supabase
        .rpc('generate_invite_code')
        .single();

      if (inviteError) throw inviteError;

      const inviteCode = inviteData || await generateFallbackCode();

      const { error } = await supabase
        .from('company_invites')
        .insert([{
          company_id: selectedCompany.id,
          email: inviteEmail,
          role: inviteRole as any,
          invited_by: userId,
          invite_code: inviteCode,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invite created for ${inviteEmail}`,
      });

      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("BROKER");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Client Organizations</CardTitle>
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
                  <DialogDescription>Set up a new client organization</DialogDescription>
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
    </div>
  );
};

export default ClientAccounts;
