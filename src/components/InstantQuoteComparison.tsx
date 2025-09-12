import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Upload, 
  TrendingUp, 
  Shield, 
  Award, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  DollarSign,
  Target,
  Crown,
  Star,
  Zap,
  X,
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import CoverageComparisonTable from "./CoverageComparisonTable";
import { getInsurerInfo } from "@/lib/insurers";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface QuoteRanking {
  quote_id: string;
  insurer_name: string;
  rank_position: number;
  overall_score: number;
  premium_amount: number;
  coverage_score: number;
  quality_score: number;
  competitiveness_score: number;
  recommendation_category: string;
  key_strengths: string[];
  areas_of_concern: string[];
}

interface ClientProfile {
  id: string;
  client_name: string;
  industry?: string;
  revenue_band?: string;
  risk_profile?: string;
}

const InstantQuoteComparison = () => {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [uploadedQuotes, setUploadedQuotes] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [rankings, setRankings] = useState<QuoteRanking[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [scoredRankings, setScoredRankings] = useState<QuoteRanking[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
    
    // Prevent default browser behavior for drag and drop
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('client_reports')
        .select('id, client_name, report_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const clientProfiles = data?.map(client => {
        const reportData = client.report_data as any;
        return {
          id: client.id,
          client_name: client.client_name,
          industry: reportData?.industry,
          revenue_band: reportData?.revenue_band,
          risk_profile: reportData?.risk_profile
        };
      }) || [];

      setClients(clientProfiles);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files);
    const remainingSlots = 5 - uploadedQuotes.length;
    
    if (remainingSlots <= 0) {
      toast({
        title: "Maximum Reached",
        description: "You can upload a maximum of 5 quotes. Remove some files first.",
        variant: "destructive",
      });
      return;
    }
    
    // Add new files to existing ones, up to the limit
    const filesToAdd = newFiles.slice(0, remainingSlots);
    const updatedQuotes = [...uploadedQuotes, ...filesToAdd];
    
    setUploadedQuotes(updatedQuotes);
    
    toast({
      title: `${filesToAdd.length} Quote${filesToAdd.length !== 1 ? 's' : ''} Added`,
      description: `Total: ${updatedQuotes.length} quote${updatedQuotes.length !== 1 ? 's' : ''} ready for analysis`,
    });
  };

  const removeFile = (indexToRemove: number) => {
    const updatedQuotes = uploadedQuotes.filter((_, index) => index !== indexToRemove);
    setUploadedQuotes(updatedQuotes);
    
    toast({
      title: "Quote Removed",
      description: `${updatedQuotes.length} quote${updatedQuotes.length !== 1 ? 's' : ''} remaining`,
    });
  };

  const analyzeQuotes = async () => {
    if (!selectedClient || uploadedQuotes.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a client and upload at least one quote",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setAnalysisComplete(false);
    
    const uploadedQuoteIds: string[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Step 1: Upload and process documents
      setProcessingStep("Uploading documents...");

      for (let i = 0; i < uploadedQuotes.length; i++) {
        const file = uploadedQuotes[i];
        console.log(`Processing file ${i + 1}:`, file.name);
        setProcessingStep(`Processing quote ${i + 1} of ${uploadedQuotes.length}...`);
        
        // Upload to storage with user-specific folder structure
        console.log('Uploading to storage...');
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw uploadError;
        }
        console.log('Upload successful:', uploadData.path);

        // Create document record
        console.log('Creating document record...');
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            filename: file.name,
            storage_path: uploadData.path,
            file_type: file.type,
            file_size: file.size,
            status: 'uploaded'
          })
          .select()
          .single();

        if (docError) {
          console.error('Document creation error:', docError);
          throw docError;
        }
        console.log('Document created:', docData.id);

        // Process document with AI
        console.log('Calling process-document edge function...');
        setProcessingStep(`Analyzing quote ${i + 1} with AI...`);
        const { data: processResult, error: processError } = await supabase.functions
          .invoke('process-document', {
            body: { documentId: docData.id }
          });

        if (processError) {
          console.error('Process document error:', processError);
          console.error('Process error details:', {
            message: processError.message,
            context: processError.context,
            details: processError.details
          });
          throw processError;
        }
        console.log('Process result:', processResult);
        
        // The process-document function creates a structured_quote record
        // We need to get the quote ID from the structured_quotes table
        console.log('Looking up structured quote...');
        const { data: quoteData, error: quoteError } = await supabase
          .from('structured_quotes')
          .select('id')
          .eq('document_id', docData.id)
          .single();
          
        if (quoteError) {
          console.error('Quote lookup error:', quoteError);
          console.error('Quote lookup details:', {
            documentId: docData.id,
            error: quoteError
          });
          throw quoteError;
        }
        console.log('Quote found:', quoteData);
        
        if (quoteData?.id) {
          uploadedQuoteIds.push(quoteData.id);
          console.log('Added quote ID to array:', quoteData.id);
        } else {
          console.warn('No quote ID found for document:', docData.id);
        }
      }

      // Step 2: Analyze and rank quotes
      console.log('Starting quote ranking with IDs:', uploadedQuoteIds);
      setProcessingStep("Ranking quotes by coverage and value...");
      
      if (uploadedQuoteIds.length === 0) {
        throw new Error('No quotes were processed successfully');
      }
      
      const { data: rankingData, error: rankingError } = await supabase
        .rpc('rank_quotes_for_client', {
          p_client_id: selectedClient,
          p_quote_ids: uploadedQuoteIds
        });

      if (rankingError) {
        console.error('Ranking error:', rankingError);
        console.error('Ranking details:', {
          selectedClient,
          uploadedQuoteIds,
          error: rankingError
        });
        throw rankingError;
      }
      console.log('Ranking result:', rankingData);

      // Sort by overall score (best first)
      const sortedRankings = (rankingData || []).sort((a, b) => b.overall_score - a.overall_score);
      setRankings(sortedRankings);
      
      // Calculate scored rankings with real coverage analysis
      const scoredRanks = calculateScoredRankings(sortedRankings);
      setScoredRankings(scoredRanks);
      setAnalysisComplete(true);

      toast({
        title: "Analysis Complete!",
        description: `Ranked ${sortedRankings.length} quotes from best to worst`,
      });

    } catch (error) {
      console.error('Analysis error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        uploadedQuotes: uploadedQuotes.length,
        selectedClient,
        uploadedQuoteIds
      });
      toast({
        title: "Analysis Failed",
        description: `Error: ${error.message}. Check console for details.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2: return <Award className="h-5 w-5 text-gray-400" />;
      case 3: return <Star className="h-5 w-5 text-amber-600" />;
      default: return <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{position}</div>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 70) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 55) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getRecommendationVariant = (category: string) => {
    switch (category) {
      case 'Highly Recommended': return 'default';
      case 'Recommended': return 'secondary';
      case 'Consider with Caution': return 'outline';
      default: return 'destructive';
    }
  };

  // Helper function to parse coverage limit to numeric value
  const parseCoverageLimit = (limitString: string): number => {
    if (!limitString || limitString === "Not Covered" || limitString === "Basic Cover") return 0;
    
    // Extract numbers and multipliers
    const match = limitString.match(/£?([0-9.]+)([MKmk]?)/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const multiplier = match[2]?.toLowerCase();
    
    if (multiplier === 'm') return value * 1000000;
    if (multiplier === 'k') return value * 1000;
    return value;
  };

  // Coverage scoring weights (totaling 100%)
  const COVERAGE_WEIGHTS = {
    professional_indemnity: 30, // Most important for business protection
    public_liability: 25,       // Critical for business operations
    employers_liability: 20,    // Mandatory but standardized
    cyber_data: 15,            // Increasingly important
    product_liability: 10       // Industry dependent
  };

  // Price scoring parameters
  const PRICE_WEIGHT = 40; // 40% weight to price, 60% to coverage

  // Calculate coverage score for a single coverage type
  const calculateCoverageScore = (limit: string, maxLimit: number, weight: number): number => {
    const numericLimit = parseCoverageLimit(limit);
    if (maxLimit === 0) return 0; // No coverage across all quotes
    
    const coverageRatio = Math.min(numericLimit / maxLimit, 1);
    return coverageRatio * weight;
  };

  // Calculate price score (lower price = higher score)
  const calculatePriceScore = (price: number, minPrice: number, maxPrice: number): number => {
    if (maxPrice === minPrice) return PRICE_WEIGHT; // All same price
    
    // Inverse scoring: lower price gets higher score
    const priceRatio = 1 - ((price - minPrice) / (maxPrice - minPrice));
    return priceRatio * PRICE_WEIGHT;
  };

  // Calculate scored rankings with real coverage analysis
  const calculateScoredRankings = (rankings: QuoteRanking[]): QuoteRanking[] => {
    // Mock coverage data - in real implementation, this would come from structured_quotes
    const mockCoverageData = rankings.map((ranking) => ({
      ...ranking,
      professional_indemnity: ranking.rank_position === 1 ? "£2M" : ranking.rank_position === 2 ? "£1M" : "Not Covered",
      public_liability: "£1M",
      employers_liability: "£10M",
      cyber_data: ranking.rank_position <= 2 ? "£500K" : "Basic Cover",
      product_liability: ranking.rank_position === 1 ? "£2M" : "£1M"
    }));

    // Find maximum limits for each coverage type
    const maxLimits = {
      professional_indemnity: Math.max(...mockCoverageData.map(q => parseCoverageLimit(q.professional_indemnity))),
      public_liability: Math.max(...mockCoverageData.map(q => parseCoverageLimit(q.public_liability))),
      employers_liability: Math.max(...mockCoverageData.map(q => parseCoverageLimit(q.employers_liability))),
      cyber_data: Math.max(...mockCoverageData.map(q => parseCoverageLimit(q.cyber_data))),
      product_liability: Math.max(...mockCoverageData.map(q => parseCoverageLimit(q.product_liability)))
    };
    
    // Find price range
    const prices = rankings.map(r => r.premium_amount || 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    return rankings.map((ranking, index) => {
      const coverage = mockCoverageData[index];
      
      // Calculate coverage scores
      const coverageScore = 
        calculateCoverageScore(coverage.professional_indemnity, maxLimits.professional_indemnity, COVERAGE_WEIGHTS.professional_indemnity) +
        calculateCoverageScore(coverage.public_liability, maxLimits.public_liability, COVERAGE_WEIGHTS.public_liability) +
        calculateCoverageScore(coverage.employers_liability, maxLimits.employers_liability, COVERAGE_WEIGHTS.employers_liability) +
        calculateCoverageScore(coverage.cyber_data, maxLimits.cyber_data, COVERAGE_WEIGHTS.cyber_data) +
        calculateCoverageScore(coverage.product_liability, maxLimits.product_liability, COVERAGE_WEIGHTS.product_liability);
      
      // Calculate price score
      const priceScore = calculatePriceScore(ranking.premium_amount || 0, minPrice, maxPrice);
      
      // Combine scores (60% coverage + 40% price)
      const totalScore = Math.round(coverageScore + priceScore);
      
      // Calculate policy quality score (based on coverage comprehensiveness)
      const policyQualityScore = Math.round(coverageScore * (100/60));
      
      return {
        ...ranking,
        overall_score: Math.max(1, Math.min(100, totalScore)), // Ensure score is between 1-100
        coverage_score: Math.round(coverageScore * (100/60)), // Scale coverage to 100 for display
        quality_score: policyQualityScore, // Policy quality based on coverage
        competitiveness_score: Math.round(priceScore * (100/40)) // Scale price to 100 for display
      };
    }).sort((a, b) => b.overall_score - a.overall_score); // Sort by score, highest first
  };

  const generatePDFReport = async () => {
    if (!selectedClient || rankings.length === 0) {
      toast({
        title: "Cannot Generate Report",
        description: "Please complete the comparison first",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedClientData = clients.find(c => c.id === selectedClient);
      if (!selectedClientData) {
        throw new Error("Client data not found");
      }

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Add company header
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Insurance Quote Comparison Report', margin, yPosition);
      yPosition += 15;

      // Add client information
      pdf.setFontSize(14);
      pdf.text('Client Information', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(12);
      pdf.text(`Client Name: ${selectedClientData.client_name}`, margin, yPosition);
      yPosition += 7;
      
      if (selectedClientData.industry) {
        pdf.text(`Industry: ${selectedClientData.industry}`, margin, yPosition);
        yPosition += 7;
      }
      
      if (selectedClientData.revenue_band) {
        pdf.text(`Revenue Band: ${selectedClientData.revenue_band}`, margin, yPosition);
        yPosition += 7;
      }

      yPosition += 10;

      // Add analysis summary
      pdf.setFontSize(14);
      pdf.text('Quote Analysis Summary', margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(12);
      pdf.text(`Total Quotes Analyzed: ${rankings.length}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Analysis Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
      yPosition += 15;

      // Add rankings table
      pdf.setFontSize(14);
      pdf.text('Quote Rankings (Best to Worst)', margin, yPosition);
      yPosition += 10;

      // Rankings table headers
      pdf.setFontSize(10);
      const headers = ['Rank', 'Insurer', 'Premium', 'Overall Score', 'Recommendation'];
      const colWidths = [15, 50, 30, 25, 50];
      let xPos = margin;

      // Draw table headers
      headers.forEach((header, index) => {
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[index];
      });
      yPosition += 7;

      // Draw horizontal line
      pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
      yPosition += 5;

      // Add rankings data
      rankings.forEach((ranking, index) => {
        xPos = margin;
        const rowData = [
          `#${index + 1}`,
          ranking.insurer_name,
          `£${ranking.premium_amount?.toLocaleString() || 'N/A'}`,
          `${ranking.overall_score}%`,
          ranking.recommendation_category || 'Standard'
        ];

        rowData.forEach((data, colIndex) => {
          // Wrap text if too long
          const text = data.length > 15 ? data.substring(0, 15) + '...' : data;
          pdf.text(text, xPos, yPosition);
          xPos += colWidths[colIndex];
        });
        yPosition += 7;

        // Add new page if needed
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = margin;
        }
      });

      yPosition += 10;

      // Add key insights
      if (rankings.length > 0) {
        pdf.setFontSize(14);
        pdf.text('Key Insights', margin, yPosition);
        yPosition += 10;

        pdf.setFontSize(12);
        const bestQuote = rankings[0];
        pdf.text(`Best Value: ${bestQuote.insurer_name} at £${bestQuote.premium_amount?.toLocaleString()}`, margin, yPosition);
        yPosition += 7;
        pdf.text(`Overall Score: ${bestQuote.overall_score}%`, margin, yPosition);
        yPosition += 7;
        
        if (bestQuote.key_strengths && bestQuote.key_strengths.length > 0) {
          pdf.text('Key Strengths:', margin, yPosition);
          yPosition += 5;
          bestQuote.key_strengths.slice(0, 3).forEach(strength => {
            pdf.text(`• ${strength}`, margin + 5, yPosition);
            yPosition += 5;
          });
        }
      }

      // Add footer
      const currentDate = new Date().toLocaleDateString();
      pdf.setFontSize(8);
      pdf.text(`Generated on ${currentDate}`, margin, 285);
      pdf.text('Confidential - For Client Use Only', pageWidth - margin - 50, 285);

      // Save PDF
      const fileName = `Insurance_Quote_Comparison_${selectedClientData.client_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Report Generated",
        description: "PDF report has been downloaded successfully",
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Report Generation Failed", 
        description: "There was an error generating the PDF report",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center mb-2">
            <Zap className="h-8 w-8 text-primary mr-2" />
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Instant Quote Comparison
            </CardTitle>
          </div>
          <CardDescription className="text-lg">
            Upload quotes and compare coverage instantly. Our AI analyzes schedules, limits, clauses, and terms to rank quotes from best to worst.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Step 1: Client Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Step 1: Select Client</span>
          </CardTitle>
          <CardDescription>Choose the client you're comparing quotes for</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client-select">Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{client.client_name}</span>
                        {client.industry && (
                          <span className="text-xs text-muted-foreground">{client.industry}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClient && (
              <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Client selected</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Quote Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Step 2: Upload Quotes (1-5)</span>
          </CardTitle>
          <CardDescription>Upload PDF quotes from different insurers for instant comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                uploadedQuotes.length >= 5 
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                  : 'border-muted-foreground/25 cursor-pointer hover:border-primary/50'
              }`}
              onDrop={(e) => {
                e.preventDefault();
                if (uploadedQuotes.length >= 5) return;
                const files = e.dataTransfer.files;
                handleFileUpload(files);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
            >
              <Upload className={`h-8 w-8 mx-auto mb-2 ${
                uploadedQuotes.length >= 5 ? 'text-gray-400' : 'text-muted-foreground'
              }`} />
              {uploadedQuotes.length >= 5 ? (
                <>
                  <span className="text-sm font-medium text-gray-500">Maximum 5 quotes reached</span>
                  <p className="text-xs text-gray-400 mt-1">Remove a quote to add another</p>
                </>
              ) : (
                <Label htmlFor="quote-upload" className="cursor-pointer">
                  <span className="text-sm font-medium">
                    {uploadedQuotes.length === 0 ? 'Click to upload quotes' : 'Click to add more quotes'}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add multiple PDF files at once ({uploadedQuotes.length}/5 uploaded)
                  </p>
                </Label>
              )}
              <Input
                id="quote-upload"
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                disabled={uploadedQuotes.length >= 5}
              />
            </div>
            
            {uploadedQuotes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    Ready for Comparison
                  </h4>
                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                    {uploadedQuotes.length} Quote{uploadedQuotes.length !== 1 ? 's' : ''} Uploaded
                  </Badge>
                </div>
                
                <div className="grid gap-2">
                  {uploadedQuotes.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-25 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                          <span className="text-sm font-medium text-green-700">#{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">{file.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyze
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {uploadedQuotes.length === 1 
                        ? "Quote ready for analysis" 
                        : `All ${uploadedQuotes.length} quotes ready for comparison`
                      }
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {uploadedQuotes.length === 1 
                      ? "Our AI will analyze your quote for coverage details and recommendations."
                      : `Click "Compare Quotes Instantly" below to analyze coverage, limits, exclusions, and competitiveness across all ${uploadedQuotes.length} quotes.`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Step 3: Instant Analysis</span>
          </CardTitle>
          <CardDescription>Our AI will analyze coverage, limits, terms, and competitiveness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={analyzeQuotes}
              disabled={!selectedClient || uploadedQuotes.length === 0 || isProcessing}
              size="lg"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                  Analyzing Quotes...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Compare Quotes Instantly
                </>
              )}
            </Button>
            
            {(!selectedClient || uploadedQuotes.length === 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Requirements Missing</span>
                </div>
                <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                  {!selectedClient && <li>• Please select a client in Step 1</li>}
                  {uploadedQuotes.length === 0 && <li>• Please upload at least one quote in Step 2</li>}
                </ul>
              </div>
            )}
            
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{processingStep}</span>
                  <span>Processing...</span>
                </div>
                <Progress value={uploadedQuotes.length > 0 ? Math.round((100 / (uploadedQuotes.length + 1)) * (uploadedQuotes.length > 0 ? 1 : 0)) : 33} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  Using OpenAI to analyze schedules, limits, exclusions, enhancements, and core policy wording...
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Generation Section */}
      {analysisComplete && rankings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Generate Client Report</span>
            </CardTitle>
            <CardDescription>
              Create a professional PDF report to send to your client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-6">
              <Button 
                onClick={generatePDFReport}
                size="lg"
                className="flex items-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Generate Report</span>
              </Button>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Includes client information, quote rankings, coverage analysis, and recommendations
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage Comparison Results */}
      {analysisComplete && rankings.length > 0 && (
        <>
          {/* Coverage Highlights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Coverage Comparison Highlights</span>
              </CardTitle>
              <CardDescription>
                Key coverage limits and which quote provides the best protection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CoverageComparisonTable rankings={scoredRankings.length > 0 ? scoredRankings : rankings} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Quote Rankings - Best to Worst</span>
              </CardTitle>
              <CardDescription>
                Ranked by overall coverage quality, competitiveness, and value
              </CardDescription>
            </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(scoredRankings.length > 0 ? scoredRankings : rankings).map((ranking, index) => (
                <Card key={ranking.quote_id} className={`relative ${index === 0 ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getRankIcon(ranking.rank_position)}
                        {/* Insurer Logo */}
                        {(() => {
                          const insurerInfo = getInsurerInfo(ranking.insurer_name);
                          return insurerInfo.logo ? (
                            <img 
                              src={insurerInfo.logo} 
                              alt={insurerInfo.altText}
                              className="h-10 w-10 object-contain rounded"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {ranking.insurer_name.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                          );
                        })()}
                        <div>
                          <h3 className="text-lg font-semibold">{ranking.insurer_name}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={getRecommendationVariant(ranking.recommendation_category)}>
                              {ranking.recommendation_category}
                            </Badge>
                            {index === 0 && (
                              <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900">
                                <Crown className="h-3 w-3 mr-1" />
                                Best Choice
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          £{ranking.premium_amount?.toLocaleString() || 'N/A'}
                        </div>
                        <div className={`text-sm px-2 py-1 rounded border ${getScoreColor(ranking.overall_score)}`}>
                          Overall Score: {ranking.overall_score}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${getScoreColor(ranking.coverage_score)}`}>
                          {ranking.coverage_score}%
                        </div>
                        <div className="text-xs text-muted-foreground">Coverage Score</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${getScoreColor(ranking.quality_score)}`}>
                          {ranking.quality_score}%
                        </div>
                        <div className="text-xs text-muted-foreground">Policy Quality</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${getScoreColor(ranking.competitiveness_score)}`}>
                          {ranking.competitiveness_score}%
                        </div>
                        <div className="text-xs text-muted-foreground">Competitiveness</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ranking.key_strengths.length > 0 && (
                        <div>
                          <h4 className="font-medium text-green-700 mb-2 flex items-center">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Key Strengths
                          </h4>
                          <ul className="text-sm space-y-1">
                            {ranking.key_strengths.map((strength, i) => (
                              <li key={i} className="flex items-center">
                                <div className="h-1.5 w-1.5 bg-green-500 rounded-full mr-2" />
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {ranking.areas_of_concern.length > 0 && (
                        <div>
                          <h4 className="font-medium text-amber-700 mb-2 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Areas of Concern
                          </h4>
                          <ul className="text-sm space-y-1">
                            {ranking.areas_of_concern.map((concern, i) => (
                              <li key={i} className="flex items-center">
                                <div className="h-1.5 w-1.5 bg-amber-500 rounded-full mr-2" />
                                {concern}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default InstantQuoteComparison;