import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Copy, Mail, Building2, Crown, Shield, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface CompanyManagementProps {
  userProfile: any;
}

const CompanyManagement = ({ userProfile }: CompanyManagementProps) => {
  const [company, setCompany] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"broker" | "viewer">("broker");
  const [inviteLoading, setInviteLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.company_id) {
      fetchCompanyData();
    } else {
      setLoading(false);
    }
  }, [userProfile]);

  const fetchCompanyData = async () => {
    try {
      // Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from('broker_companies')
        .select('*')
        .eq('id', userProfile.company_id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;
      setTeamMembers(membersData || []);

      // Fetch pending invites (only if user is admin)
      if (userProfile.role === 'company_admin') {
        const { data: invitesData, error: invitesError } = await supabase
          .from('company_invites')
          .select('*')
          .eq('company_id', userProfile.company_id)
          .is('used_at', null)
          .order('created_at', { ascending: false });

        if (invitesError) throw invitesError;
        setInvites(invitesData || []);
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
      toast({
        title: "Error",
        description: "Failed to load company data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setInviteLoading(true);
    try {
      // Generate invite code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_invite_code');

      if (codeError) throw codeError;

      // Create invite
      const { data, error } = await supabase
        .from('company_invites')
        .insert({
          company_id: userProfile.company_id,
          invited_by: userProfile.id,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invite_code: codeData
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Invite Sent",
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteEmail("");
      setInvites(prev => [data, ...prev]);
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invite",
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Invite code copied to clipboard",
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'company_admin':
        return <Crown className="h-4 w-4 text-amber-500" />;
      case 'broker':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-500" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: any = {
      company_admin: "default",
      broker: "secondary",
      viewer: "outline"
    };
    return (
      <Badge variant={variants[role] || "outline"} className="flex items-center gap-1">
        {getRoleIcon(role)}
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!userProfile?.company_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Setup Required
          </CardTitle>
          <CardDescription>
            You need to be part of a company to access team management features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contact your administrator or use an invite code to join a company.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {company?.name}
          </CardTitle>
          <CardDescription>
            {company?.domain && `${company.domain} • `}
            {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="team" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="invites" disabled={userProfile.role !== 'company_admin'}>
            Invites {invites.length > 0 && `(${invites.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage your company's CoverCompass users
                  </CardDescription>
                </div>
                {userProfile.role === 'company_admin' && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                          Send an invitation to join {company?.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email">Email Address</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="colleague@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="invite-role">Role</Label>
                          <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="broker">Broker - Full access to quotes and comparisons</SelectItem>
                              <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={sendInvite} disabled={inviteLoading} className="w-full">
                          {inviteLoading ? "Sending..." : "Send Invitation"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers?.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          {member.first_name || member.last_name ? 
                            `${member.first_name || ''} ${member.last_name || ''}`.trim() : 
                            'Unnamed User'
                          }
                          {member.job_title && (
                            <div className="text-xs text-muted-foreground">{member.job_title}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell>{member.department || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? "default" : "secondary"}>
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Invitations sent to join your company
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invites.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending invitations</p>
                </div>
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
                    {invites?.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>{getRoleBadge(invite.role)}</TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            {invite.invite_code}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invite.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteCode(invite.invite_code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompanyManagement;