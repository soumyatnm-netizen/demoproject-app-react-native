import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, BarChart3, Users, Shield, Upload, Eye, Download } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import Dashboard from "@/components/Dashboard";
import AuthWrapper from "@/components/AuthWrapper";
import RoiCalculator from "@/components/RoiCalculator";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');
  const { toast } = useToast();

  useEffect(() => {
    const checkRecovery = () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const type = params.get('type');
      const accessToken = params.get('access_token');
      const otpToken = params.get('token');
      const email = params.get('email');
      if (type === 'recovery' && (accessToken || (otpToken && email))) {
        setCurrentView('dashboard');
      }
    };

    checkRecovery();
    const onHashChange = () => checkRecovery();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (currentView === 'dashboard') {
    return (
      <AuthWrapper onBack={() => setCurrentView('landing')}>
        <Dashboard onBack={() => setCurrentView('landing')} />
      </AuthWrapper>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" alt="CoverCompass" className="h-20" />
        </div>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => document.getElementById('roi-calculator')?.scrollIntoView({ behavior: 'smooth' })}
            >
              ROI
            </Button>
            <Button onClick={() => setCurrentView('dashboard')}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 text-sm px-4 py-2" variant="secondary">
            Markets Mapped. Cover Unlocked
          </Badge>
          <h2 className="text-5xl font-bold text-foreground mb-6">
            Instant <span className="text-primary">Coverage Comparison</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Stop spending hours manually comparing insurance documents. CoverCompass&apos;s AI analyses schedules, limits, inner limits, exclusions, subjectives, enhancements, and core wording to compare and create client ready reports.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => setCurrentView('dashboard')}>
              Start Comparing Quotes
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => toast({
                title: "Coming Soon",
                description: "Demo videos will be available shortly.",
              })}
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-foreground mb-4">
              From quote chaos to ranked clarity in minutes
            </h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Create client profiles, upload multiple quotes, and get instant rankings based on coverage quality, competitiveness, and value
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center flex flex-col h-full">
              <CardHeader className="p-8 space-y-6 flex-1 flex flex-col">
                <Upload className="h-16 w-16 text-primary mx-auto" />
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  <CardTitle className="text-2xl">1. Create Client Profile</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    CoverCompass Market Intelligence will automatically match potential insurers using live appetite guides and CoverCompass placement data.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>

            <Card className="text-center flex flex-col h-full">
              <CardHeader className="p-8 space-y-6 flex-1 flex flex-col">
                <Eye className="h-16 w-16 text-primary mx-auto" />
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  <CardTitle className="text-2xl">2. Upload 1-5 Quotes</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Upload PDF quotes from different underwriters. CoverCompassAI analyses schedules, limits, inner limits, exclusions, subjectives, enhancements, and core wording.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>

            <Card className="text-center flex flex-col h-full">
              <CardHeader className="p-8 space-y-6 flex-1 flex flex-col">
                <Download className="h-16 w-16 text-primary mx-auto" />
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  <CardTitle className="text-2xl">3. Instant Comparison Reports</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Get quotes ranked from best to worst with highlighted strengths, concerns, and clear recommendations for quick decision-making.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-foreground mb-4">
              Built for brokers, powered by data
            </h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <FileUp className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Document Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  CoverCompassAI-powered extraction of coverage terms, limits, and conditions from any document format.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Coverage Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Side-by-side analysis highlighting gaps, strengths, and inner limit structures.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Market Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Discover which markets are most competitive for similar risks and industries.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Secure & Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  GDPR compliant with enterprise-grade security for your sensitive insurance data.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section id="roi-calculator" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <RoiCalculator />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">
            Ready to transform your placement process?
          </h3>
          <p className="text-lg mb-8 opacity-90">
            Join brokers who are already saving hours and winning more business with CoverCompass.
          </p>
          <Button size="lg" variant="secondary" onClick={() => setCurrentView('dashboard')}>
            Start Your Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4 text-center">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <img src="/lovable-uploads/117007fd-e5c4-4ee6-a580-ee7bde7ad08a.png" alt="CoverCompass" className="h-12" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Markets Mapped. Cover Unlocked
        </p>
        <div className="border-t pt-6 mt-6">
          <h4 className="text-sm font-semibold mb-2">Contact Us</h4>
          <a 
            href="mailto:hello@covercompass.co.uk" 
            className="text-sm text-primary hover:underline"
          >
            hello@covercompass.co.uk
          </a>
        </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;