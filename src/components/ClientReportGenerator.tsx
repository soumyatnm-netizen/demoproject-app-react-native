import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Eye, Send, Building, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ComparisonData {
  id: string;
  name: string;
  client_name: string;
  quote_ids: string[];
  comparison_data: any;
  created_at: string;
}

interface ClientReport {
  id: string;
  report_title: string;
  client_name: string;
  broker_company_name: string;
  report_status: string;
  key_changes: any;
  recommendations: string[];
  created_at: string;
}

const ClientReportGenerator = () => {
  const [comparisons, setComparisons] = useState<ComparisonData[]>([]);
  const [clientReports, setClientReports] = useState<ClientReport[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [clientComparisons, setClientComparisons] = useState<ComparisonData[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<ComparisonData | null>(null);
  const [reportForm, setReportForm] = useState({
    title: "",
    clientName: "",
    brokerCompany: "",
    executiveSummary: "",
    customRecommendations: ""
  });
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  // Get unique client names from both comparisons and existing reports
  const uniqueClients = Array.from(new Set([
    ...comparisons.map(c => c.client_name).filter(Boolean),
    ...clientReports.map(r => r.client_name).filter(Boolean)
  ])).sort();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      const filtered = comparisons.filter(c => c.client_name === selectedClient);
      setClientComparisons(filtered);
      setSelectedComparison(null);
    } else {
      setClientComparisons([]);
    }
  }, [selectedClient, comparisons]);

  const fetchData = async () => {
    try {
      // Fetch existing comparisons
      const { data: comparisonsData, error: compError } = await supabase
        .from('comparisons')
        .select('*')
        .order('created_at', { ascending: false });

      if (compError) throw compError;

      // Fetch existing client reports
      const { data: reportsData, error: repError } = await supabase
        .from('client_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (repError) throw repError;

      setComparisons(comparisonsData || []);
      setClientReports(reportsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    }
  };

  const generateClientReport = async () => {
    if (!selectedComparison || !reportForm.title || !reportForm.clientName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setGenerating(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate key changes and analysis
      const keyChanges = analyseChanges(selectedComparison.comparison_data);
      const recommendations = generateRecommendations(selectedComparison.comparison_data);

      // Create client report
      const { data: report, error } = await supabase
        .from('client_reports')
        .insert({
          user_id: user.id,
          comparison_id: selectedComparison.id,
          report_title: reportForm.title,
          client_name: reportForm.clientName,
          broker_company_name: reportForm.brokerCompany,
          report_data: {
            comparison: selectedComparison.comparison_data,
            executive_summary: reportForm.executiveSummary,
            custom_recommendations: reportForm.customRecommendations
          },
          key_changes: keyChanges,
          recommendations: recommendations,
          report_status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client report generated successfully",
      });

      // Reset form and refresh data
      setReportForm({
        title: "",
        clientName: "",
        brokerCompany: "",
        executiveSummary: "",
        customRecommendations: ""
      });
      setSelectedClient("");
      setSelectedComparison(null);
      fetchData();

    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate client report",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const analyseChanges = (comparisonData: any) => {
    // Analyse comparison data to identify key changes
    return {
      premium_changes: comparisonData?.premium_comparison || {},
      coverage_improvements: comparisonData?.coverage_analysis?.improvements || [],
      coverage_reductions: comparisonData?.coverage_analysis?.reductions || [],
      key_highlights: [
        "Premium comparison analysis",
        "Coverage limit changes",
        "Terms and conditions updates"
      ]
    };
  };

  const generateRecommendations = (comparisonData: any) => {
    return [
      "Review coverage limits against current business needs",
      "Consider premium savings opportunities",
      "Evaluate new policy features and benefits",
      "Assess impact of any coverage changes"
    ];
  };

  const exportReportPDF = async (reportId: string) => {
    toast({
      title: "Coming Soon",
      description: "PDF export functionality will be available soon",
    });
  };

  return (
    <div className="space-y-6">
      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Client-Ready Report
          </CardTitle>
          <CardDescription>
            Generate professional, branded reports for client presentations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client-select">1. Select Client *</Label>
              <Select 
                value={selectedClient} 
                onValueChange={(value) => {
                  setSelectedClient(value);
                  setReportForm(prev => ({
                    ...prev,
                    clientName: value,
                    title: `${value} Insurance Review ${new Date().getFullYear()}`
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueClients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comparison-select">2. Select Comparison *</Label>
              <Select 
                value={selectedComparison?.id || ""} 
                onValueChange={(value) => {
                  const comp = clientComparisons.find(c => c.id === value);
                  setSelectedComparison(comp || null);
                }}
                disabled={!selectedClient}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedClient ? "Choose a comparison" : "Select client first"} />
                </SelectTrigger>
                <SelectContent>
                  {clientComparisons.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name} ({new Date(comp.created_at).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-title">Report Title *</Label>
              <Input
                id="report-title"
                placeholder="e.g., Annual Insurance Review 2024"
                value={reportForm.title}
                onChange={(e) => setReportForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name *</Label>
              <Input
                id="client-name"
                placeholder="Client company name"
                value={reportForm.clientName}
                onChange={(e) => setReportForm(prev => ({ ...prev, clientName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="broker-company">Broker Company</Label>
              <Input
                id="broker-company"
                placeholder="Your brokerage name"
                value={reportForm.brokerCompany}
                onChange={(e) => setReportForm(prev => ({ ...prev, brokerCompany: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="executive-summary">Executive Summary</Label>
            <Textarea
              id="executive-summary"
              placeholder="Brief overview of the renewal situation and key findings..."
              value={reportForm.executiveSummary}
              onChange={(e) => setReportForm(prev => ({ ...prev, executiveSummary: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-recommendations">Additional Recommendations</Label>
            <Textarea
              id="custom-recommendations"
              placeholder="Any specific recommendations for this client..."
              value={reportForm.customRecommendations}
              onChange={(e) => setReportForm(prev => ({ ...prev, customRecommendations: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <Button 
            onClick={generateClientReport} 
            disabled={generating || !selectedComparison}
            className="w-full"
          >
            {generating ? "Generating Report..." : "Generate Client Report"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Client Reports</CardTitle>
          <CardDescription>
            Manage and export your generated client reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {clientReports.map((report) => (
              <div key={report.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{report.report_title}</h4>
                    <p className="text-sm text-muted-foreground">
                      Client: {report.client_name}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge 
                        variant={
                          report.report_status === 'finalized' ? 'default' :
                          report.report_status === 'sent' ? 'secondary' : 'outline'
                        }
                      >
                        {report.report_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportReportPDF(report.id)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>

                {/* Key Changes Preview */}
                {report.key_changes && (
                  <div className="bg-muted/50 rounded p-3 mt-3">
                    <h5 className="text-sm font-medium mb-2">Key Changes Identified:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span>Premium Analysis</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-blue-600" />
                        <span>Coverage Updates</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        <span>Terms Changes</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations Preview */}
                {report.recommendations && report.recommendations.length > 0 && (
                  <div className="mt-2">
                    <h5 className="text-sm font-medium mb-1">Recommendations:</h5>
                    <div className="flex flex-wrap gap-1">
                      {report.recommendations.slice(0, 2).map((rec, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {rec.length > 40 ? rec.substring(0, 40) + '...' : rec}
                        </Badge>
                      ))}
                      {report.recommendations.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{report.recommendations.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {clientReports.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">No client reports generated yet</p>
                <p className="text-sm">Create your first professional client report above</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientReportGenerator;
