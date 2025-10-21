import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  DollarSign,
  Target,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface DeepComparisonProps {
  insurers: Array<{
    name: string;
    quote_id?: string;
    wording_id?: string;
  }>;
}

const DeepComparison = ({ insurers }: DeepComparisonProps) => {
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runDeepComparison = async () => {
    setLoading(true);
    try {
      console.log('Running deep comparison...', insurers);

      const { data, error } = await supabase.functions.invoke('deep-comparison', {
        body: { insurers }
      });

      if (error) throw error;

      console.log('Deep comparison result:', data);
      setComparison(data.comparison);

      toast({
        title: "Deep Comparison Complete",
        description: `Analyzed ${insurers.length} insurers with forensic detail`,
      });
    } catch (error) {
      console.error('Deep comparison error:', error);
      toast({
        title: "Comparison Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAssessmentIcon = (assessment: string) => {
    if (assessment.includes('better') || assessment.includes('Better')) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (assessment.includes('worse') || assessment.includes('Worse')) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    } else {
      return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAssessmentBadge = (assessment: string) => {
    if (assessment.includes('better') || assessment.includes('Better')) {
      return <Badge variant="default" className="bg-green-600">Better</Badge>;
    } else if (assessment.includes('worse') || assessment.includes('Worse')) {
      return <Badge variant="destructive">Worse</Badge>;
    } else {
      return <Badge variant="secondary">Equal</Badge>;
    }
  };

  const formatCurrency = (amount: number | null, currency: string = 'GBP') => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportToExcel = () => {
    toast({
      title: "Excel Export",
      description: "Excel export functionality coming soon",
    });
  };

  const exportToPDF = async () => {
    if (!comparison) return;

    try {
      toast({
        title: "Generating PDF Report",
        description: "Creating professional side-by-side comparison...",
      });

      const htmlContent = generateComparisonPDFHTML();

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ htmlContent })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to generate PDF');
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      
      const fileName = `Comprehensive_Comparison_${new Date().toISOString().split('T')[0]}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Generated Successfully",
        description: `Report downloaded as ${fileName}`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF Generation Failed",
        description: error.message || "Failed to generate PDF report",
        variant: "destructive",
      });
    }
  };

  const generateComparisonPDFHTML = (): string => {
    const { insurers: insurerResults, deltas } = comparison;
    
    // Extract product sections from the insurer data
    const productSections = [
      { key: 'professional_indemnity', title: 'Professional Indemnity' },
      { key: 'cyber', title: 'Cyber & Data' },
      { key: 'crime', title: 'Crime & Fraud' },
      { key: 'public_products_liability', title: 'Public & Products Liability' },
      { key: 'employers_liability', title: 'Employers\' Liability' },
      { key: 'property', title: 'Property & Business Interruption' },
    ];
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprehensive Insurance Comparison</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #1f2937;
        }
        .page { 
            page-break-after: always; 
            padding: 20mm;
        }
        .page:last-child { page-break-after: auto; }
        
        h1 { 
            font-size: 20pt; 
            font-weight: 700; 
            color: #1e40af;
            margin-bottom: 6mm;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 3mm;
        }
        h2 { 
            font-size: 16pt; 
            font-weight: 600; 
            margin: 6mm 0 4mm 0;
            color: #374151;
        }
        h3 { 
            font-size: 11pt; 
            font-weight: 600; 
            margin-bottom: 2mm;
            color: #4b5563;
        }
        
        .premium-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6mm;
            margin-bottom: 8mm;
        }
        
        .premium-card {
            border: 2px solid #fbbf24;
            border-radius: 3mm;
            padding: 4mm;
            background: #fef3c7;
        }
        
        .premium-total {
            font-size: 20pt;
            font-weight: 700;
            color: #92400e;
            margin: 2mm 0;
        }
        
        .comparison-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            margin-bottom: 6mm;
        }
        
        .insurer-card {
            border: 1.5px solid #d1d5db;
            border-radius: 2mm;
            padding: 4mm;
            background: white;
        }
        
        .insurer-header {
            display: flex;
            align-items: center;
            margin-bottom: 3mm;
            padding-bottom: 2mm;
            border-bottom: 1.5px solid #e5e7eb;
        }
        
        .insurer-name {
            font-size: 13pt;
            font-weight: 700;
            color: #1f2937;
        }
        
        .section-title {
            font-size: 10pt;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 3mm 0 2mm 0;
        }
        
        .key-terms {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        
        .key-terms li {
            padding-left: 4mm;
            margin-bottom: 1.5mm;
            position: relative;
            font-size: 9pt;
            line-height: 1.5;
        }
        
        .key-terms li:before {
            content: "•";
            position: absolute;
            left: 0;
            font-weight: bold;
            color: #3b82f6;
        }
        
        .subjectivities-box {
            background: #fef3c7;
            border: 2px solid #fbbf24;
            border-radius: 2mm;
            padding: 3mm;
            margin: 3mm 0;
        }
        
        .subjectivities-title {
            font-size: 10pt;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 2mm;
            display: flex;
            align-items: center;
        }
        
        .warning-icon {
            margin-right: 2mm;
        }
        
        .subjectivity-item {
            padding-left: 5mm;
            margin-bottom: 1.5mm;
            position: relative;
            font-size: 9pt;
            color: #92400e;
        }
        
        .subjectivity-item:before {
            content: "⚠";
            position: absolute;
            left: 0;
        }
        
        .no-subjectivities {
            color: #059669;
            font-size: 9pt;
            display: flex;
            align-items: center;
        }
        
        .standout-points {
            list-style: none;
            margin: 3mm 0 0 0;
            padding: 0;
            border-top: 1px solid #e5e7eb;
            padding-top: 3mm;
        }
        
        .standout-points li {
            padding-left: 5mm;
            margin-bottom: 2mm;
            position: relative;
            font-size: 9pt;
            line-height: 1.5;
        }
        
        .icon-positive { color: #059669; }
        .icon-negative { color: #dc2626; }
        .icon-warning { color: #d97706; }
        
        .summary-box {
            background: #f3f4f6;
            border-left: 4px solid #3b82f6;
            padding: 4mm;
            margin-top: 4mm;
            font-size: 9pt;
            line-height: 1.6;
        }
        
        .summary-title {
            font-size: 11pt;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 2mm;
        }
        
        @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    ${generatePremiumPage(insurerResults)}
    ${generateProductPagesFromInsurers(productSections, insurerResults, deltas)}
</body>
</html>`;
  };

  const generatePremiumPage = (insurers: any[]): string => {
    return `
    <div class="page">
        <h1>Premium Comparison</h1>
        <div class="premium-grid">
            ${insurers.map(insurer => `
                <div class="premium-card">
                    <h2 style="margin-top: 0;">${insurer.insurer_name}</h2>
                    <div class="premium-total">${formatCurrency(insurer.premiums?.total_payable || insurer.premiums?.annual_premium, insurer.premiums?.currency)}</div>
                    <div style="font-size: 8pt; color: #92400e; margin-top: 2mm;">
                        ${insurer.premiums?.annual_premium ? 'Annual Premium' : 'Total Payable'}
                    </div>
                    
                    ${Object.keys(insurer.premiums?.base_premium_by_section || {}).length > 0 ? `
                        <div style="margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #fbbf24;">
                            <div style="font-size: 8pt; font-weight: 600; color: #78350f; margin-bottom: 1mm;">BREAKDOWN</div>
                            ${Object.entries(insurer.premiums.base_premium_by_section).map(([section, amount]) => `
                                <div style="display: flex; justify-content: space-between; font-size: 8pt; color: #92400e; margin-bottom: 1mm;">
                                    <span>${section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                    <span style="font-weight: 600;">${formatCurrency(Number(amount), insurer.premiums?.currency)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #fbbf24;">
                        <div style="display: flex; justify-content: space-between; font-size: 8pt; color: #92400e;">
                            <span>Insurance Premium Tax</span>
                            <span style="font-weight: 600;">${formatCurrency(insurer.premiums?.ipt, insurer.premiums?.currency)}</span>
                        </div>
                        ${(insurer.premiums?.fees || []).map((fee: any) => `
                            <div style="display: flex; justify-content: space-between; font-size: 8pt; color: #92400e; margin-top: 1mm;">
                                <span>${fee.name}</span>
                                <span style="font-weight: 600;">${formatCurrency(fee.amount, insurer.premiums?.currency)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
  };

  const generateProductPagesFromInsurers = (productSections: any[], insurers: any[], deltas: any[]): string => {
    return productSections.map(section => {
      const sectionData = insurers.map(insurer => ({
        insurer_name: insurer.insurer_name,
        data: insurer[section.key]
      }));
      
      // Find relevant deltas for this section
      const sectionDeltas = deltas?.filter((d: any) => 
        d.path?.toLowerCase().includes(section.key.toLowerCase())
      ) || [];
      
      // Generate key terms for each insurer
      const generateKeyTerms = (insurerName: string, data: any): string[] => {
        if (!data) return [];
        const terms: string[] = [];
        
        if (data.limit?.amount) {
          terms.push(`Limit: ${formatCurrency(data.limit.amount, data.limit.currency)} ${data.limit.basis_of_limit || ''}`);
        }
        if (data.excess?.amount) {
          terms.push(`Excess: ${formatCurrency(data.excess.amount, data.excess.currency)} ${data.excess.basis_of_excess || ''}`);
        }
        if (data.coverage_triggers) {
          terms.push(`Trigger: ${Array.isArray(data.coverage_triggers) ? data.coverage_triggers.join(', ') : data.coverage_triggers}`);
        }
        if (data.territorial_limits) {
          terms.push(`Territory: ${data.territorial_limits}`);
        }
        
        return terms;
      };
      
      return `
        <div class="page">
            <h1>${section.title}</h1>
            
            <div class="comparison-grid">
                ${sectionData.map(({ insurer_name, data }) => `
                    <div class="insurer-card">
                        <div class="insurer-header">
                            <span class="insurer-name">${insurer_name}</span>
                        </div>
                        
                        ${data ? `
                            <div class="section-title">Key Terms</div>
                            <ul class="key-terms">
                                ${generateKeyTerms(insurer_name, data).map(term => `<li>${term}</li>`).join('')}
                            </ul>
                            
                            <div class="subjectivities-box">
                                <div class="subjectivities-title">
                                    <span class="warning-icon">⚠️</span>
                                    Subjectivities (Pre-Binding)
                                </div>
                                ${data.subjectivities && data.subjectivities.length > 0 ? `
                                    ${data.subjectivities.map((subj: any) => `
                                        <div class="subjectivity-item">${typeof subj === 'string' ? subj : subj.text}</div>
                                    `).join('')}
                                ` : `
                                    <div class="no-subjectivities">✓ None - Quote is firm</div>
                                `}
                            </div>
                            
                            ${data.features || data.extensions ? `
                                <div class="section-title">Standout Points</div>
                                <ul class="standout-points">
                                    ${Object.entries(data.features || data.extensions || {}).map(([key, value]) => {
                                      if (value === true || value === false) {
                                        const icon = value ? '✅' : '❌';
                                        const colorClass = value ? 'icon-positive' : 'icon-negative';
                                        return `<li><span class="${colorClass}" style="position: absolute; left: 0;">${icon}</span>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span></li>`;
                                      }
                                      return '';
                                    }).filter(Boolean).join('')}
                                </ul>
                            ` : ''}
                        ` : '<div style="color: #9ca3af;">No data available for this section</div>'}
                    </div>
                `).join('')}
            </div>
            
            ${sectionDeltas.length > 0 ? `
                <div class="summary-box">
                    <div class="summary-title">Key Differences</div>
                    <div>
                        ${sectionDeltas.slice(0, 5).map((delta: any) => `
                            <div style="margin-bottom: 2mm;">
                                <strong>${delta.path}:</strong> ${delta.assessment}
                                ${delta.impact ? `<br/><em style="color: #6b7280;">Impact: ${delta.impact}</em>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
      `;
    }).join('');
  };

  if (!comparison) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-6 w-6" />
            <span>Forensic Deep Comparison</span>
          </CardTitle>
          <CardDescription>
            Extract, normalize, and compare every material coverage term at section and sub-section level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">What is Deep Comparison?</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Forensic extraction of ALL material terms from quotes and wordings</li>
                <li>Normalized data (currency, basis fields, section names)</li>
                <li>Full traceability (document, page, snippet for every data point)</li>
                <li>Delta analysis showing better/worse/equal per field</li>
                <li>Export to Excel and PDF for client presentations</li>
              </ul>
            </div>

            <Button 
              onClick={runDeepComparison} 
              disabled={loading || insurers.length < 2}
              className="w-full"
              size="lg"
            >
              {loading ? 'Analyzing...' : 'Run Forensic Deep Comparison'}
            </Button>

            {insurers.length < 2 && (
              <p className="text-sm text-muted-foreground text-center">
                Need at least 2 insurers with quotes and wordings to compare
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { insurers: insurerResults, deltas } = comparison;

  return (
    <div className="space-y-6">
      {/* Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Deep Comparison Complete</span>
            </span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setComparison(null)}>
                New Comparison
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Premium Comparison - ALWAYS AT TOP */}
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-yellow-600" />
            <span>Premium Comparison</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insurerResults.map((insurer: any) => (
              <Card key={insurer.insurer_name} className="bg-white border-2">
                <CardHeader>
                  <CardTitle className="text-lg">{insurer.insurer_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Total Payable - HIGHLIGHTED */}
                  <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">
                      {insurer.premiums?.annual_premium ? 'Annual Premium' : 'Total Payable'}
                    </div>
                    <div className="text-3xl font-bold text-yellow-900">
                      {formatCurrency(
                        insurer.premiums?.annual_premium || insurer.premiums?.total_payable, 
                        insurer.premiums?.currency
                      )}
                    </div>
                  </div>

                  {/* Premium Breakdown */}
                  <div className="space-y-2 text-sm">
                    {insurer.premiums?.base_premium_by_section && 
                      Object.keys(insurer.premiums.base_premium_by_section).length > 0 && (
                      <div className="space-y-1">
                        <div className="font-medium text-xs text-muted-foreground uppercase">Premium Breakdown</div>
                        {Object.entries(insurer.premiums.base_premium_by_section).map(([section, amount]: [string, any]) => (
                          <div key={section} className="flex justify-between items-center py-1 border-b">
                            <span className="text-muted-foreground capitalize">
                              {section.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono">
                              {formatCurrency(amount, insurer.premiums?.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* IPT */}
                    {insurer.premiums?.ipt && (
                      <div className="flex justify-between items-center py-1 border-b">
                        <span className="text-muted-foreground">Insurance Premium Tax</span>
                        <span className="font-mono">
                          {formatCurrency(insurer.premiums.ipt, insurer.premiums?.currency)}
                        </span>
                      </div>
                    )}

                    {/* Fees */}
                    {insurer.premiums?.fees && insurer.premiums.fees.length > 0 && 
                      insurer.premiums.fees.map((fee: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b">
                          <span className="text-muted-foreground">{fee.name || 'Fee'}</span>
                          <span className="font-mono">
                            {formatCurrency(fee.amount, insurer.premiums?.currency)}
                          </span>
                        </div>
                      ))
                    }

                    {/* Annual Total (if different from total_payable) */}
                    {insurer.premiums?.annual_total && insurer.premiums.annual_total !== insurer.premiums.annual_premium && (
                      <div className="flex justify-between items-center py-2 border-t-2 font-semibold">
                        <span>Annual Total</span>
                        <span className="font-mono text-lg">
                          {formatCurrency(insurer.premiums.annual_total, insurer.premiums?.currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delta Summary */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <span>Key Differences & Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deltas?.slice(0, 10).map((delta: any, idx: number) => (
              <div key={idx} className="flex items-start space-x-3 p-3 bg-white rounded-lg border">
                {getAssessmentIcon(delta.assessment)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{delta.path}</span>
                    {getAssessmentBadge(delta.assessment)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    {insurerResults.map((insurer: any) => (
                      <div key={insurer.insurer_name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">{insurer.insurer_name}:</span>
                        <span className="font-mono">
                          {typeof delta[insurer.insurer_name.toLowerCase()] === 'number' 
                            ? formatCurrency(delta[insurer.insurer_name.toLowerCase()])
                            : delta[insurer.insurer_name.toLowerCase()] ?? 'N/A'
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{delta.assessment}</p>
                  {delta.impact && (
                    <p className="text-xs text-blue-700 mt-1 font-medium">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Impact: {delta.impact}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Comparison Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Section Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="professional_indemnity">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="professional_indemnity">PI</TabsTrigger>
              <TabsTrigger value="cyber">Cyber</TabsTrigger>
              <TabsTrigger value="crime">Crime</TabsTrigger>
              <TabsTrigger value="property">Property</TabsTrigger>
              <TabsTrigger value="meta">Policy Meta</TabsTrigger>
            </TabsList>

            <TabsContent value="professional_indemnity" className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      {insurerResults.map((insurer: any) => (
                        <TableHead key={insurer.insurer_name}>{insurer.insurer_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Limit</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <div className="space-y-1">
                            <div className="font-mono">
                              {formatCurrency(insurer.professional_indemnity?.limit?.amount)}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {insurer.professional_indemnity?.limit?.basis_of_limit || 'N/A'}
                            </Badge>
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Excess</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <div className="space-y-1">
                            <div className="font-mono">
                              {formatCurrency(insurer.professional_indemnity?.excess?.amount)}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {insurer.professional_indemnity?.excess?.basis_of_excess || 'N/A'}
                            </Badge>
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Breach of Contract</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.professional_indemnity?.features?.breach_of_contract ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Covered
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Covered
                            </Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">AI Liability</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.professional_indemnity?.features?.ai_liability ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Covered
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Covered
                            </Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Regulatory Costs & Fines</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.professional_indemnity?.features?.regulatory_costs_and_fines ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Covered
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Covered
                            </Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="cyber" className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      {insurerResults.map((insurer: any) => (
                        <TableHead key={insurer.insurer_name}>{insurer.insurer_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Overall Limit</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <div className="font-mono">
                            {formatCurrency(insurer.cyber?.overall?.limit?.amount)}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Overall Excess</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <div className="font-mono">
                            {formatCurrency(insurer.cyber?.overall?.excess?.amount)}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">BI Waiting Period</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <Badge variant="outline">
                            {insurer.cyber?.business_interruption?.waiting_period_hours || 'N/A'} hours
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">BI Indemnity Period</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <Badge variant="outline">
                            {insurer.cyber?.business_interruption?.indemnity_period || 'N/A'}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Proactive Services</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.cyber?.overall?.proactive_services?.scope ? (
                            <div className="space-y-1">
                              <Badge variant="default" className="bg-blue-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Included
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {insurer.cyber.overall.proactive_services.scope}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="secondary">Not Included</Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="crime" className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Crime Sub-Section</TableHead>
                      {insurerResults.map((insurer: any) => (
                        <TableHead key={insurer.insurer_name}>{insurer.insurer_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {['funds_transfer_fraud', 'invoice_manipulation', 'new_vendor_fraud', 'physical_goods_fraud', 'theft_of_personal_funds'].map((crimeType) => (
                      <TableRow key={crimeType}>
                        <TableCell className="font-medium">
                          {crimeType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </TableCell>
                        {insurerResults.map((insurer: any) => (
                          <TableCell key={insurer.insurer_name}>
                            {insurer.crime?.[crimeType] ? (
                              <div className="space-y-1">
                                <div className="font-mono text-sm">
                                  Limit: {formatCurrency(insurer.crime[crimeType].limit?.amount)}
                                </div>
                                <div className="font-mono text-sm">
                                  Excess: {formatCurrency(insurer.crime[crimeType].excess?.amount)}
                                </div>
                              </div>
                            ) : (
                              <Badge variant="secondary">Not Covered</Badge>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="property" className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property Feature</TableHead>
                      {insurerResults.map((insurer: any) => (
                        <TableHead key={insurer.insurer_name}>{insurer.insurer_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">General Contents</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <div className="font-mono">
                            {formatCurrency(insurer.property?.contents?.general_contents?.limit?.amount)}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Business Interruption</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <div className="space-y-1">
                            <div className="font-mono text-sm">
                              {formatCurrency(insurer.property?.business_interruption?.limit?.amount)}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {insurer.property?.business_interruption?.indemnity_period_months || 'N/A'} months
                            </Badge>
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Bricking</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.property?.bricking?.present ? (
                            <div className="space-y-1">
                              <Badge variant="default" className="bg-green-600">Covered</Badge>
                              <div className="font-mono text-sm">
                                {formatCurrency(insurer.property.bricking.limit?.amount)}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="secondary">Not Covered</Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy Detail</TableHead>
                      {insurerResults.map((insurer: any) => (
                        <TableHead key={insurer.insurer_name}>{insurer.insurer_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Product Name</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.policy_meta?.product_name || 'N/A'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Policy Period</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.policy_meta?.policy_period?.start} to {insurer.policy_meta?.policy_period?.end}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Territorial Limits</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <Badge variant="outline">
                            {insurer.policy_meta?.territorial_limits || 'N/A'}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Separate Towers</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          {insurer.policy_meta?.separate_indemnity_towers ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              No
                            </Badge>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Premium</TableCell>
                      {insurerResults.map((insurer: any) => (
                        <TableCell key={insurer.insurer_name}>
                          <div className="font-mono font-bold text-lg">
                            {formatCurrency(insurer.premiums?.total_payable)}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeepComparison;
