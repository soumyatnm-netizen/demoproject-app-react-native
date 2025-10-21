import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one number");

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isValidLink, setIsValidLink] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    validateResetLink();
  }, []);

  const validateResetLink = async () => {
    setValidating(true);
    setLinkError("");
    setErrorMessage(null);

    try {
      // Check for code parameter (new PKCE flow)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        console.log('Exchanging code for session...');
        // Exchange code for session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('Code exchange error:', error);
          setLinkError(error.message || "This reset link is invalid or has expired.");
          setIsValidLink(false);
        } else {
          console.log('Code exchange successful');
          setIsValidLink(true);
        }
      } else {
        // Check hash for legacy flow
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const type = params.get('type');
        const accessToken = params.get('access_token');
        const otpToken = params.get('token');
        const emailParam = params.get('email');

        console.log('Legacy flow check:', { type, hasAccessToken: !!accessToken, hasOtpToken: !!otpToken, hasEmail: !!emailParam });

        if (type === 'recovery' && otpToken && emailParam) {
          // Legacy OTP-style recovery link
          const { error } = await supabase.auth.verifyOtp({
            email: emailParam,
            token: otpToken,
            type: 'recovery'
          });
          if (error) {
            console.error('verifyOtp error:', error);
            setLinkError(error.message || 'This password reset link has expired or is invalid.');
            setIsValidLink(false);
          } else {
            // prevent re-verification on hashchange
            window.location.hash = 'type=recovery';
            setIsValidLink(true);
          }
        } else if (type === 'recovery' && accessToken) {
          // Verify session is valid
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error || !session) {
            console.error('Invalid session:', error);
            setLinkError('This password reset link has expired or is invalid.');
            setIsValidLink(false);
          } else {
            console.log('Valid legacy recovery session');
            setIsValidLink(true);
          }
        } else {
          console.log('No valid reset link found');
          setLinkError('Please use the password reset link from your Cover Compass email.');
          setIsValidLink(false);
        }
      }
    } catch (error: any) {
      console.error('Reset link validation error:', error);
      setLinkError("This reset link is invalid or has expired. Please request a new one.");
      setIsValidLink(false);
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }

    // Validate password strength
    try {
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrorMessage(error.issues[0].message);
        toast({
          title: "Invalid Password",
          description: error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        let errorMsg = "Failed to update password. Please try again.";
        
        if (error.message.includes('token expired') || error.message.includes('expired')) {
          errorMsg = "This reset link has expired. Please request a new password reset email.";
        } else if (error.message.includes('similar')) {
          errorMsg = "The new password is too similar to your previous password.";
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        setErrorMessage(errorMsg);
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      setSuccess(true);
      toast({
        title: "Password Updated Successfully",
        description: "Your password has been reset. Redirecting to login...",
      });

      // Clear URL hash for security
      window.history.pushState({}, document.title, window.location.pathname);
      
      // Sign out and redirect to home/login
      await supabase.auth.signOut();

      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      const errorMsg = "A critical error occurred. Please try again.";
      setErrorMessage(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestNewLink = () => {
    navigate('/', { state: { showForgotPassword: true } });
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Shield className="h-12 w-12 text-primary animate-pulse" />
              <p className="text-center text-muted-foreground">
                Validating password reset link...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Password Reset Successful</CardTitle>
            <CardDescription>
              Your password has been updated. Redirecting you to the login page...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isValidLink) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <img 
              src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" 
              alt="Cover Compass" 
              className="h-16 mx-auto mb-4" 
            />
            <p className="text-muted-foreground">Markets Mapped. Cover Unlocked</p>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex justify-center mb-4">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-center">Invalid Reset Link</CardTitle>
              <CardDescription className="text-center">
                {linkError || "This password reset link is invalid or has expired."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Password reset links expire after a certain time for security reasons. 
                  Please request a new password reset link from Cover Compass.
                </AlertDescription>
              </Alert>
              <Button 
                onClick={handleRequestNewLink} 
                className="w-full"
              >
                Request New Reset Link
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Need help? Contact us at{" "}
                <a href="mailto:dan@covercompass.co.uk" className="text-primary hover:underline">
                  dan@covercompass.co.uk
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img 
            src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" 
            alt="Cover Compass" 
            className="h-16 mx-auto mb-4" 
          />
          <p className="text-muted-foreground">Markets Mapped. Cover Unlocked</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Set New Password</CardTitle>
            <CardDescription className="text-center">
              Choose a strong password for your Cover Compass account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive text-center">{errorMessage}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your new password"
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={submitting || !password || !confirmPassword}
              >
                {submitting ? "Updating Password..." : "Reset Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
