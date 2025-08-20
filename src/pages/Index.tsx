import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, BarChart3, Users, Shield, Upload, Eye, Download } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import Dashboard from "@/components/Dashboard";
import AuthWrapper from "@/components/AuthWrapper";

const Index = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>('landing');

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
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">CoverCompass</h1>
          </div>
          <Button onClick={() => setCurrentView('dashboard')}>
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4" variant="secondary">
            The placement intelligence layer for insurance broking
          </Badge>
          <h2 className="text-5xl font-bold text-foreground mb-6">
            Remove the guesswork from <br />
            <span className="text-primary">insurance placement</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Upload quotes, compare coverage instantly, and discover the best markets for your clients. 
            Stop spending hours collating policies - let AI do the heavy lifting.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => setCurrentView('dashboard')}>
              Start Comparing Quotes
            </Button>
            <Button size="lg" variant="outline">
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
              Three steps to better placements
            </h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your documents, get instant comparisons, and make data-driven placement decisions
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>1. Upload Documents</CardTitle>
                <CardDescription>
                  Drag and drop insurer quotes, policy wordings, and schedules. Supports PDF, Word, and Excel.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Eye className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>2. AI Analysis</CardTitle>
                <CardDescription>
                  Our AI instantly extracts coverage details, limits, and terms, structuring everything for comparison.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Download className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>3. Client-Ready Reports</CardTitle>
                <CardDescription>
                  Get professional comparison reports highlighting strengths, gaps, and recommendations for your clients.
                </CardDescription>
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
                  AI-powered extraction of coverage terms, limits, and conditions from any document format.
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
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold">CoverCompass</span>
          </div>
          <p className="text-sm text-muted-foreground">
            The placement intelligence layer for insurance broking
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;