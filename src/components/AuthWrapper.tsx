import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface AuthWrapperProps {
  children: React.ReactNode;
  onBack?: () => void;
}

const AuthWrapper = ({ children, onBack }: AuthWrapperProps) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle post-signup profile creation
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(async () => {
            await createOrUpdateProfile(session.user, inviteData);
          }, 100);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [inviteData]);

  const createOrUpdateProfile = async (user: any, inviteInfo?: any) => {
    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!existingProfile) {
        // Create new profile
        const profileData: any = {
          user_id: user.id,
          subscription_tier: 'basic',
        };

        // If user is signing up with an invite code
        if (inviteInfo) {
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

        const { error } = await supabase
          .from('profiles')
          .insert(profileData);

        if (error) {
          console.error('Error creating profile:', error);
        }
      }
    } catch (error) {
      console.error('Error in createOrUpdateProfile:', error);
    }
  };

  const validateInviteCode = async (code: string) => {
    if (!code.trim()) {
      setInviteData(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_invites')
        .select(`
          *,
          company:broker_companies(*),
          inviter:profiles!invited_by(*)
        `)
        .eq('invite_code', code.toUpperCase())
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        toast({
          title: "Invalid Invite Code",
          description: "The invite code is invalid, expired, or already used.",
          variant: "destructive",
        });
        setInviteData(null);
        return;
      }

      setInviteData(data);
      setEmail(data.email); // Pre-fill email from invite
      toast({
        title: "Invite Code Valid",
        description: `You're invited to join ${data.company.name}`,
      });
    } catch (error) {
      console.error('Error validating invite code:', error);
      setInviteData(null);
    }
  };

  useEffect(() => {
    if (inviteCode) {
      const timeoutId = setTimeout(() => {
        validateInviteCode(inviteCode);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [inviteCode]);

  const handleTestAccount = async () => {
    setAuthLoading(true);
    const testEmail = 'demo@covercompass.co.uk';
    const testPassword = 'demo123456';

    try {
      // First try to sign in with existing test account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (signInError && signInError.message.includes('Invalid login credentials')) {
        // Test account doesn't exist, create it
        const { error: signUpError } = await supabase.auth.signUp({
          email: testEmail,
          password: testPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              test_account: true
            }
          }
        });

        if (signUpError) throw signUpError;

        // If signup requires email confirmation, try signing in immediately
        // (this works if email confirmation is disabled)
        const { error: immediateSignInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });

        if (immediateSignInError && !immediateSignInError.message.includes('Email not confirmed')) {
          throw immediateSignInError;
        }

        toast({
          title: "Test Account Created",
          description: "Welcome to CoverCompass! You're now signed in with a demo account.",
        });
      } else if (signInError) {
        throw signInError;
      } else {
        toast({
          title: "Welcome Back",
          description: "Signed in with test account successfully",
        });
      }
    } catch (error: any) {
      console.error('Test account error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create test account",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              invite_code: inviteCode || null
            }
          }
        });
        if (error) throw error;
        
        toast({
          title: "Success",
          description: inviteData 
            ? `Account created! You'll be added to ${inviteData.company.name}.`
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
      toast({
        title: "Error",
        description: error.message,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
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
            <img src="/lovable-uploads/7efe2624-58cc-456e-877b-95332a0fa92d.png" alt="CoverCompass" className="h-16 mx-auto mb-4" />
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
              <Tabs value={isSignUp ? "signup" : "signin"} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin" onClick={() => setIsSignUp(false)}>
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" onClick={() => setIsSignUp(true)}>
                    Sign Up
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
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
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleTestAccount}
                      disabled={authLoading}
                    >
                      {authLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Test Account...
                        </>
                      ) : (
                        "🚀 Try Test Account"
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup" className="space-y-4 mt-4">
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-code">Invite Code (Optional)</Label>
                      <Input
                        id="invite-code"
                        type="text"
                        placeholder="Enter company invite code"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        className="uppercase"
                      />
                      {inviteData && (
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                          <p className="text-sm font-medium text-primary">
                            🎉 You're invited to join {inviteData.company.name}!
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Role: {inviteData.role}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={!!inviteData} // Disable if invite code is used
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Choose a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
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
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleTestAccount}
                      disabled={authLoading}
                    >
                      {authLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Test Account...
                        </>
                      ) : (
                        "🚀 Try Test Account"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {/* Add sign out option in a corner */}
      <div className="fixed top-4 right-4 z-50">
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </>
  );
};

export default AuthWrapper;