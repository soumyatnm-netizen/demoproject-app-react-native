import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import type { User, Session } from '@supabase/supabase-js';

// Validation schemas
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one number");

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

const adminSignUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  jobTitle: z.string().min(2, "Job title must be at least 2 characters"),
  companyDomain: z.string().optional(),
});

interface AuthWrapperProps {
  children: React.ReactNode;
  onBack?: () => void;
}

const AuthWrapper = ({ children, onBack }: AuthWrapperProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAdminSignUp, setIsAdminSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);
  const [companyCode, setCompanyCode] = useState("");
  const [companyData, setCompanyData] = useState<any>(null);
  const [signupType, setSignupType] = useState<'invite' | 'company' | 'none'>('none');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [showAccessGate, setShowAccessGate] = useState(true);
  
  // Admin signup fields
  const [companyName, setCompanyName] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle post-signup profile creation
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            const adminSignUpData = isAdminSignUp ? {
              companyName,
              firstName: adminFirstName,
              lastName: adminLastName,
              jobTitle,
              companyDomain
            } : null;
            
            createOrUpdateProfile(session.user, inviteData, adminSignUpData, companyData);
            
            // Check user role and redirect if needed
            checkUserRoleAndRedirect(session.user.id);
          }, 100);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Check role on initial load if user is already signed in
      if (session?.user) {
        checkUserRoleAndRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [inviteData, companyData, isAdminSignUp, companyName, adminFirstName, adminLastName, jobTitle, companyDomain]);

  // Check user role and redirect CC Staff to /cc
  const checkUserRoleAndRedirect = async (userId: string) => {
    // Skip if already on CC routes or auth/reset
    if (location.pathname.startsWith('/cc') || location.pathname === '/auth/reset') {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'CC_STAFF')
        .maybeSingle();

      if (!error && data) {
        navigate('/cc', { replace: true });
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const createOrUpdateProfile = async (user: User, inviteInfo?: any, adminData?: any, companyInfo?: any) => {
    console.log('createOrUpdateProfile called with:', { 
      userId: user.id, 
      hasInviteInfo: !!inviteInfo,
      hasAdminData: !!adminData,
      hasCompanyInfo: !!companyInfo,
      adminData
    });

    try {
      // Build profile data based on signup type
      let profileData: any = {
        user_id: user.id,
        subscription_tier: 'basic',
      };

      // If user is signing up with an invite code
      if (inviteInfo) {
        console.log('Processing invite signup:', inviteInfo);
        profileData.company_id = inviteInfo.company_id;
        profileData.role = inviteInfo.role;
        profileData.invited_by = inviteInfo.invited_by;
        profileData.invited_at = new Date().toISOString();

        // Mark invite as used
        await supabase
          .from('company_invites')
          .update({
            used_at: new Date().toISOString(),
            used_by: user.id
          })
          .eq('invite_code', inviteInfo.invite_code);
      }
      // If user is signing up with a company code
      else if (companyInfo || user.user_metadata?.company_id) {
        const companyId = companyInfo?.company_id || user.user_metadata?.company_id;
        console.log('Processing company code signup:', { companyInfo, metadataCompanyId: user.user_metadata?.company_id });
        profileData.company_id = companyId;
        profileData.role = 'broker'; // Default role for company code signups
      }
      // If user is admin creating a company
      else if (adminData) {
        console.log('Processing admin signup:', adminData);
        try {
          // First create the company
          const { data: newCompany, error: companyError } = await supabase
            .from('broker_companies')
            .insert({
              name: adminData.companyName,
              domain: adminData.companyDomain || null,
            })
            .select()
            .single();

          if (companyError) {
            console.error('Company creation error:', companyError);
            throw companyError;
          }

          console.log('Company created successfully:', newCompany);

          profileData.company_id = newCompany.id;
          profileData.role = 'company_admin';
          profileData.first_name = adminData.firstName;
          profileData.last_name = adminData.lastName;
          profileData.job_title = adminData.jobTitle;
          profileData.company_name = adminData.companyName;
        } catch (companyCreationError) {
          console.error('Failed to create company:', companyCreationError);
          throw companyCreationError;
        }
      }

      console.log('Attempting to create/update profile with data:', profileData);

      // First try to update existing profile (handles race conditions where profile was auto-created)
      const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingProfile) {
        // Profile exists - update it with new data
        console.log('Profile exists, updating with:', profileData);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            company_id: profileData.company_id,
            role: profileData.role,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            job_title: profileData.job_title,
            company_name: profileData.company_name,
            invited_by: profileData.invited_by,
            invited_at: profileData.invited_at,
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error updating existing profile:', updateError);
          // Don't throw - profile exists, just couldn't update some fields
        } else {
          console.log('Profile updated successfully');
        }
      } else {
        // Profile doesn't exist - create it
        console.log('Creating new profile');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(profileData);

        if (insertError) {
          // If insert fails due to duplicate, try update instead
          if (insertError.code === '23505') {
            console.log('Insert failed with duplicate, attempting update');
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                company_id: profileData.company_id,
                role: profileData.role,
              })
              .eq('user_id', user.id);
            
            if (updateError) {
              console.error('Fallback update also failed:', updateError);
            }
          } else {
            console.error('Error creating profile:', insertError);
            throw insertError;
          }
        } else {
          console.log('Profile created successfully');
        }
      }

      if (adminData) {
        toast({
          title: "Company Created!",
          description: `${adminData.companyName} has been set up successfully. You can now invite team members.`,
        });
      }
    } catch (error) {
      console.error('Error in createOrUpdateProfile:', error);
      toast({
        title: "Account Setup Error",
        description: "There was an issue setting up your account. Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  const validateInviteCode = async (code: string) => {
    if (!code.trim()) {
      setInviteData(null);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('validate_invite_code', {
        p_invite_code: code.trim(),
        p_email: email || 'temp@temp.com' // Use temp email if not entered yet
      });

      if (error) throw error;

      if (!data || data.length === 0 || !data[0].is_valid) {
        toast({
          title: "Invalid Invite Code",
          description: "This invite code is invalid or has expired",
          variant: "destructive",
        });
        setInviteData(null);
        return;
      }

      setInviteData(data[0]);
      setSignupType('invite');
      toast({
        title: "Invite Code Valid",
        description: `You're invited to join ${data[0].company_name}`,
      });
    } catch (error) {
      console.error('Error validating invite code:', error);
      setInviteData(null);
    }
  };

  const validateCompanyCode = async (code: string) => {
    if (!code.trim()) {
      setCompanyData(null);
      setSignupType('none');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('validate_company_code', {
        p_code: code.trim()
      });

      if (error) throw error;

      if (!data || data.length === 0 || !data[0].is_valid) {
        toast({
          title: "Invalid Company Code",
          description: "This company code is invalid or has expired",
          variant: "destructive",
        });
        setCompanyData(null);
        setSignupType('none');
        return;
      }

      setCompanyData(data[0]);
      setSignupType('company');
      toast({
        title: "Company Code Valid",
        description: `You can join ${data[0].company_name}`,
      });
    } catch (error) {
      console.error('Error validating company code:', error);
      setCompanyData(null);
      setSignupType('none');
    }
  };

  useEffect(() => {
    if (inviteCode) {
      const timeoutId = setTimeout(() => {
        validateInviteCode(inviteCode);
        if (inviteCode.trim()) setShowAccessGate(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (companyCode) {
      const timeoutId = setTimeout(() => {
        validateCompanyCode(companyCode);
        if (companyCode.trim()) setShowAccessGate(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [companyCode]);

  const validateForm = (isSignIn: boolean = false) => {
    setValidationErrors({});
    const errors: Record<string, string> = {};

    try {
      if (isSignIn) {
        signInSchema.parse({ email, password });
      } else if (isAdminSignUp) {
        adminSignUpSchema.parse({
          email,
          password,
          companyName,
          firstName: adminFirstName,
          lastName: adminLastName,
          jobTitle,
          companyDomain
        });
      } else {
        signUpSchema.parse({ email, password });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((err) => {
          if (err.path.length > 0) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm(!isSignUp && !isAdminSignUp)) {
      return;
    }

    setAuthLoading(true);

    try {
      if (isSignUp || isAdminSignUp) {
        const signUpData: any = {
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              invite_code: inviteCode || null,
              company_code: companyCode || null,
              company_id: companyData?.company_id || null,
              company_name: companyData?.company_name || null,
              is_admin_signup: isAdminSignUp || false,
              signup_type: signupType
            }
          }
        };

        const { error } = await supabase.auth.signUp(signUpData);
        if (error) throw error;
        
        toast({
          title: "Success",
          description: inviteData 
            ? `Account created! You'll be added to ${inviteData.company_name}.`
            : companyData
            ? `Account created! You'll be added to ${companyData.company_name}.`
            : isAdminSignUp
            ? "Company admin account created! Please check your email to confirm."
            : "Please check your email to confirm your account",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Successfully signed in",
        });
      }
    } catch (error: any) {
      let errorMessage = "An error occurred. Please try again.";
      
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please check your credentials and try again.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Please check your email and click the confirmation link before signing in.";
      } else if (error.message.includes("User already registered")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (error.message.includes("Password should be at least")) {
        errorMessage = "Password must be at least 6 characters long.";
      }

      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully",
    });
  };

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyingRecovery, setVerifyingRecovery] = useState(false);

  // Check for password reset via either access_token (magic link) or token+email (OTP) in hash
  useEffect(() => {
    const checkRecoveryFlow = async () => {
      const rawHash = window.location.hash || '';
      const hash = rawHash.startsWith('#') ? rawHash.substring(1) : rawHash;
      const params = new URLSearchParams(hash);
      const type = params.get('type');
      const accessToken = params.get('access_token');
      const otpToken = params.get('token');
      const emailParam = params.get('email');

      console.log('Recovery hash check:', { type, hasAccessToken: !!accessToken, hasOtpToken: !!otpToken });

      if (type === 'recovery' && accessToken) {
        setIsResettingPassword(true);
        setLoading(false);
        return;
      }

      if (type === 'recovery' && otpToken && emailParam && !verifyingRecovery) {
        try {
          setVerifyingRecovery(true);
          const { error } = await supabase.auth.verifyOtp({
            email: emailParam,
            token: otpToken,
            type: 'recovery'
          });
          if (error) throw error;
          setIsResettingPassword(true);
          setLoading(false);
          // Prevent re-verification
          window.location.hash = 'type=recovery';
        } catch (err: any) {
          console.error('verifyOtp recovery failed:', err);
          toast({
            title: 'Reset link expired',
            description: 'Please request a new password reset email.',
            variant: 'destructive',
          });
          setShowForgotPassword(true);
          setForgotPasswordEmail(emailParam || '');
        } finally {
          setVerifyingRecovery(false);
        }
      }
    };

    checkRecoveryFlow();
    const handleHashChange = () => {
      checkRecoveryFlow();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [verifyingRecovery]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    try {
      emailSchema.parse(forgotPasswordEmail);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid Email",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setForgotPasswordLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for password reset instructions from Cover Compass. The email may take a few minutes to arrive.",
      });
      
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    try {
      passwordSchema.parse(newPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid Password",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated.",
      });
      
      setIsResettingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      
      // Clear the URL hash
      window.location.hash = '';
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setValidationErrors({});
    setCompanyName("");
    setAdminFirstName("");
    setAdminLastName("");
    setJobTitle("");
    setCompanyDomain("");
    setInviteCode("");
    setInviteData(null);
    setCompanyCode("");
    setCompanyData(null);
    setSignupType('none');
    setShowForgotPassword(false);
    setForgotPasswordEmail("");
    setShowAccessGate(true);
  };

  const switchTab = (signUp: boolean, admin: boolean) => {
    setIsSignUp(signUp);
    setIsAdminSignUp(admin);
    clearForm();
    // Always show access gate when switching to signup/admin unless they have a code
    if ((signUp || admin) && !inviteCode && !companyCode) {
      setShowAccessGate(true);
    } else {
      setShowAccessGate(false);
    }
  };

  if (loading && !isResettingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show password reset form even if user is not logged in
  if (isResettingPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {onBack && (
            <div className="mb-6">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Homepage
              </Button>
            </div>
          )}
          
          <div className="text-center mb-8">
            <img src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" alt="CoverCompass" className="h-20 mx-auto mb-4" />
            <p className="text-muted-foreground mt-2">
              Markets Mapped. Cover Unlocked
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reset Your Password</CardTitle>
              <CardDescription>
                Enter your new password below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {onBack && (
            <div className="mb-6">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Homepage
              </Button>
            </div>
          )}
          
          <div className="text-center mb-8">
            <img src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" alt="CoverCompass" className="h-20 mx-auto mb-4" />
            <p className="text-muted-foreground mt-2">
              Markets Mapped. Cover Unlocked
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isResettingPassword ? (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-lg font-semibold">Reset Your Password</h2>
                    <p className="text-sm text-muted-foreground">Enter your new password below</p>
                  </div>
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter your new password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={authLoading}>
                      {authLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </div>
              ) : showAccessGate && (isSignUp || isAdminSignUp) ? (
                <div className="space-y-6 text-center py-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-3">🚀 Ready to Join CoverCompass?</h2>
                    <div className="space-y-3 text-muted-foreground">
                      <p>To get started, please contact us for access.</p>
                      <p className="font-medium">Once approved, we'll send you a <span className="text-primary">Broker Sign-Up Code</span> so you can create your account.</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <Button 
                      onClick={() => window.location.href = 'mailto:dan@covercompass.co.uk?subject=Request for Broker Access'}
                      size="lg"
                      className="w-full"
                    >
                      👉 Contact Us for Access
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => switchTab(false, false)}
                      className="w-full"
                    >
                      Already have an account? Sign In
                    </Button>
                  </div>
                  
                  <div className="pt-6 border-t">
                    <p className="text-sm text-muted-foreground mb-3">Already have a code?</p>
                    <Button 
                      variant="secondary"
                      onClick={() => setShowAccessGate(false)}
                      className="w-full"
                    >
                      Enter Your Code
                    </Button>
                  </div>
                </div>
              ) : (
              <Tabs value={isAdminSignUp ? "admin" : isSignUp ? "signup" : "signin"} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="signin" onClick={() => switchTab(false, false)}>
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" onClick={() => switchTab(true, false)}>
                    Sign Up
                  </TabsTrigger>
                  <TabsTrigger value="admin" onClick={() => switchTab(true, true)}>
                    Admin Setup
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin" className="space-y-4 mt-4">
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={validationErrors.email ? "border-red-500" : ""}
                      />
                      {validationErrors.email && (
                        <p className="text-sm text-red-500">{validationErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className={validationErrors.password ? "border-red-500" : ""}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {validationErrors.password && (
                        <p className="text-sm text-red-500">{validationErrors.password}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={authLoading}>
                      {authLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                    
                    <div className="text-center">
                      <Button 
                        type="button" 
                        variant="link" 
                        size="sm"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        Forgot your password?
                      </Button>
                    </div>
                  </form>
                  
                  {showForgotPassword && (
                    <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                      <h3 className="text-sm font-medium mb-3">Reset Password</h3>
                      <form onSubmit={handleForgotPassword} className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="forgot-email">Email Address</Label>
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="Enter your email address"
                            value={forgotPasswordEmail}
                            onChange={(e) => setForgotPasswordEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="submit" 
                            size="sm" 
                            disabled={forgotPasswordLoading}
                            className="flex-1"
                          >
                            {forgotPasswordLoading ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              "Send Reset Email"
                            )}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowForgotPassword(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="signup" className="space-y-4 mt-4">
                  <form onSubmit={handleAuth} className="space-y-4">
                    <Tabs value={signupType === 'invite' ? 'invite' : signupType === 'company' ? 'company' : 'invite'} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="invite" onClick={() => { setSignupType('invite'); setCompanyCode(''); setCompanyData(null); }}>
                          Invite Code
                        </TabsTrigger>
                        <TabsTrigger value="company" onClick={() => { setSignupType('company'); setInviteCode(''); setInviteData(null); }}>
                          Company Code
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="invite" className="space-y-2 mt-4">
                        <Label htmlFor="invite-code">Invite Code (Optional)</Label>
                        <Input
                          id="invite-code"
                          type="text"
                          placeholder="Enter personal invite code"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          className="uppercase"
                        />
                        {inviteData && (
                          <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                            <p className="text-sm font-medium text-primary">
                              🎉 You're invited to join {inviteData.company_name}!
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Role: {inviteData.role}
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Use the personal invite code sent to your email
                        </p>
                      </TabsContent>
                      
                      <TabsContent value="company" className="space-y-2 mt-4">
                        <Label htmlFor="company-code">Company Code</Label>
                        <Input
                          id="company-code"
                          type="text"
                          placeholder="Enter company code (e.g., ABC123)"
                          value={companyCode}
                          onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                          className="uppercase"
                        />
                        {companyData && (
                          <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                            <p className="text-sm font-medium text-primary">
                              🏢 Ready to join {companyData.company_name}!
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              You'll be added as a broker
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Ask your company admin for the reusable company code
                        </p>
                      </TabsContent>
                    </Tabs>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={validationErrors.email ? "border-red-500" : ""}
                      />
                      {validationErrors.email && (
                        <p className="text-sm text-red-500">{validationErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className={validationErrors.password ? "border-red-500" : ""}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {validationErrors.password && (
                        <p className="text-sm text-red-500">{validationErrors.password}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Password must be at least 8 characters with uppercase, lowercase, and number
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={authLoading}>
                      {authLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="admin" className="space-y-4 mt-4">
                  <div className="text-center mb-4">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Create a new company and become the admin
                    </p>
                  </div>
                  
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-first-name">First Name</Label>
                        <Input
                          id="admin-first-name"
                          type="text"
                          placeholder="John"
                          value={adminFirstName}
                          onChange={(e) => setAdminFirstName(e.target.value)}
                          required
                          className={validationErrors.firstName ? "border-red-500" : ""}
                        />
                        {validationErrors.firstName && (
                          <p className="text-sm text-red-500">{validationErrors.firstName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-last-name">Last Name</Label>
                        <Input
                          id="admin-last-name"
                          type="text"
                          placeholder="Doe"
                          value={adminLastName}
                          onChange={(e) => setAdminLastName(e.target.value)}
                          required
                          className={validationErrors.lastName ? "border-red-500" : ""}
                        />
                        {validationErrors.lastName && (
                          <p className="text-sm text-red-500">{validationErrors.lastName}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="admin-company-name">Company Name</Label>
                      <Input
                        id="admin-company-name"
                        type="text"
                        placeholder="Acme Insurance Brokers"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        className={validationErrors.companyName ? "border-red-500" : ""}
                      />
                      {validationErrors.companyName && (
                        <p className="text-sm text-red-500">{validationErrors.companyName}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="admin-job-title">Job Title</Label>
                      <Input
                        id="admin-job-title"
                        type="text"
                        placeholder="Managing Director"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        required
                        className={validationErrors.jobTitle ? "border-red-500" : ""}
                      />
                      {validationErrors.jobTitle && (
                        <p className="text-sm text-red-500">{validationErrors.jobTitle}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="admin-company-domain">Company Domain (Optional)</Label>
                      <Input
                        id="admin-company-domain"
                        type="text"
                        placeholder="acmeinsurance.com"
                        value={companyDomain}
                        onChange={(e) => setCompanyDomain(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="your@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={validationErrors.email ? "border-red-500" : ""}
                      />
                      {validationErrors.email && (
                        <p className="text-sm text-red-500">{validationErrors.email}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="admin-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className={validationErrors.password ? "border-red-500" : ""}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {validationErrors.password && (
                        <p className="text-sm text-red-500">{validationErrors.password}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Password must be at least 8 characters with uppercase, lowercase, and number
                      </p>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={authLoading}>
                      {authLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating company...
                        </>
                      ) : (
                        "Create Company & Account"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
};

export default AuthWrapper;