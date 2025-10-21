import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Phone, Building2, MapPin, Calendar, Shield, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface BrokerProfileData {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  department: string | null;
  role: string;
  subscription_tier: string;
  created_at: string;
  last_login_at: string | null;
  login_count: number | null;
  // Additional fields that might come from the database
  broker_type?: string | null;
  company_id?: string | null;
  invited_at?: string | null;
  invited_by?: string | null;
  portal_access?: string;
  preferred_portal?: string;
  updated_at?: string;
  is_super_admin?: boolean;
  is_active?: boolean;
}

interface CompanyData {
  id: string;
  name: string;
}

interface SensitiveData {
  phone: string | null;
  personal_address: string | null;
  emergency_contact: any;
  sensitive_notes: string | null;
}

const BrokerProfile = () => {
  const [profile, setProfile] = useState<BrokerProfileData | null>(null);
  const [sensitiveData, setSensitiveData] = useState<SensitiveData | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    phone: "",
    job_title: "",
    department: "",
    bio: "",
    specializations: [] as string[],
    notification_preferences: {
      email_notifications: true,
      sms_notifications: false,
      push_notifications: true
    }
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Store user email
      setUserEmail(user.email || '');

      // Fetch basic profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData as BrokerProfileData);

      // Fetch company data if company_id exists
      if (profileData.company_id) {
        const { data: company, error: companyError } = await supabase
          .from('broker_companies')
          .select('id, name')
          .eq('id', profileData.company_id)
          .single();

        if (!companyError && company) {
          setCompanyData(company);
        }
      }

      // Fetch sensitive data separately
      const { data: sensitiveDataResult, error: sensitiveError } = await supabase
        .from('profile_sensitive_data')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // It's OK if sensitive data doesn't exist yet
      if (!sensitiveError) {
        setSensitiveData(sensitiveDataResult);
      }

      setProfileData({
        first_name: profileData.first_name || "",
        last_name: profileData.last_name || "",
        company_name: profileData.company_name || "",
        phone: sensitiveDataResult?.phone || "",
        job_title: profileData.job_title || "",
        department: profileData.department || "",
        bio: "",
        specializations: [],
        notification_preferences: {
          email_notifications: true,
          sms_notifications: false,
          push_notifications: true
        }
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Update basic profile data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          company_name: profileData.company_name,
          job_title: profileData.job_title,
          department: profileData.department
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Update sensitive data separately
      const { error: sensitiveError } = await supabase
        .from('profile_sensitive_data')
        .upsert({
          user_id: user.id,
          phone: profileData.phone || null
        });

      if (sensitiveError) throw sensitiveError;

      // Log the profile access for audit purposes
      await supabase.rpc('log_profile_access', {
        p_accessed_user_id: user.id,
        p_access_type: 'update',
        p_accessed_fields: ['first_name', 'last_name', 'company_name', 'job_title', 'department', 'phone'],
        p_access_reason: 'User profile update'
      });

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      fetchProfile(); // Refresh the profile data
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const getInitials = () => {
    const first = profileData.first_name?.charAt(0) || '';
    const last = profileData.last_name?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || 'U';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Overview */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <Avatar className="w-24 h-24 mx-auto">
              <AvatarImage src="" alt="Profile" />
              <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
            </Avatar>
            <CardTitle>{profileData.first_name} {profileData.last_name}</CardTitle>
            <CardDescription>{profileData.job_title || 'Insurance Broker'}</CardDescription>
            <Badge variant="default">{profile?.role}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{userEmail || 'No email'}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{companyData?.name || 'No company set'}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Member since {new Date(profile?.created_at || '').toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Subscription: {profile?.subscription_tier}</span>
            </div>
            {profile?.last_login_at && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Last login: {new Date(profile.last_login_at).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Personal Information</span>
              </CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed from this screen</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="company_name">Company/Organisation Name</Label>
                <Input
                  id="company_name"
                  value={companyData?.name || 'No company assigned'}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">Contact your administrator to change company assignment</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="job_title">Job Title</Label>
                  <Input
                    id="job_title"
                    value={profileData.job_title}
                    onChange={(e) => setProfileData({ ...profileData, job_title: e.target.value })}
                    placeholder="Senior Broker, Account Manager, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={profileData.department}
                    onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                    placeholder="Commercial Lines, Personal Lines, etc."
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+44 20 1234 5678"
                />
              </div>
              
              <div>
                <Label htmlFor="bio">Professional Bio</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  placeholder="Brief description of your experience and specializations..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Specializations */}
          <Card>
            <CardHeader>
              <CardTitle>Areas of Specialization</CardTitle>
              <CardDescription>Select your areas of expertise</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  'Professional Indemnity',
                  'Public Liability',
                  'Employers Liability',
                  'Cyber Insurance',
                  'Directors & Officers',
                  'Commercial Property',
                  'Motor Fleet',
                  'Construction Insurance'
                ].map((specialization) => (
                  <div key={specialization} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={specialization}
                      checked={profileData.specializations.includes(specialization)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setProfileData({
                            ...profileData,
                            specializations: [...profileData.specializations, specialization]
                          });
                        } else {
                          setProfileData({
                            ...profileData,
                            specializations: profileData.specializations.filter(s => s !== specialization)
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={specialization} className="text-sm">
                      {specialization}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Account Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Account Statistics</CardTitle>
              <CardDescription>Your platform usage and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{profile?.login_count || 0}</div>
                  <p className="text-sm text-muted-foreground">Total Logins</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-sm text-muted-foreground">Clients Served</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-sm text-muted-foreground">Policies Placed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrokerProfile;