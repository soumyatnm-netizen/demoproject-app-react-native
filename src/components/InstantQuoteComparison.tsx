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
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
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
    
    const fileArray = Array.from(files).slice(0, 5); // Max 5 quotes
    
    // Clear previous uploads first
    setUploadedQuotes([]);
    
    // Add all files
    setUploadedQuotes(fileArray);
    
    toast({
      title: "Quotes Uploaded",
      description: `${fileArray.length} quote${fileArray.length !== 1 ? 's' : ''} ready for analysis`,
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
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Step 1: Upload and process documents
      setProcessingStep("Uploading documents...");
      const uploadedQuoteIds: string[] = [];

      for (let i = 0; i < uploadedQuotes.length; i++) {
        const file = uploadedQuotes[i];
        console.log(`Processing file ${i + 1}:`, file.name);
        setProcessingStep(`Processing quote ${i + 1} of ${uploadedQuotes.length}...`);
        
        // Upload to storage with user-specific folder structure
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Create document record
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

        if (docError) throw docError;

        // Process document with AI
        setProcessingStep(`Analyzing quote ${i + 1} with AI...`);
        const { data: processResult, error: processError } = await supabase.functions
          .invoke('process-document', {
            body: { documentId: docData.id }
          });

        if (processError) {
          console.error('Process document error:', processError);
          throw processError;
        }
        
        // The process-document function creates a structured_quote record
        // We need to get the quote ID from the structured_quotes table
        const { data: quoteData, error: quoteError } = await supabase
          .from('structured_quotes')
          .select('id')
          .eq('document_id', docData.id)
          .single();
          
        if (quoteError) {
          console.error('Quote lookup error:', quoteError);
          throw quoteError;
        }
        
        if (quoteData?.id) {
          uploadedQuoteIds.push(quoteData.id);
        }
      }

      // Step 2: Analyze and rank quotes
      setProcessingStep("Ranking quotes by coverage and value...");
      
      const { data: rankingData, error: rankingError } = await supabase
        .rpc('rank_quotes_for_client', {
          p_client_id: selectedClient,
          p_quote_ids: uploadedQuoteIds
        });

      if (rankingError) throw rankingError;

      // Sort by overall score (best first)
      const sortedRankings = (rankingData || []).sort((a, b) => b.overall_score - a.overall_score);
      setRankings(sortedRankings);
      setAnalysisComplete(true);

      toast({
        title: "Analysis Complete!",
        description: `Ranked ${sortedRankings.length} quotes from best to worst`,
      });

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "There was an error analyzing your quotes. Please try again.",
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
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <Label htmlFor="quote-upload" className="cursor-pointer">
                <span className="text-sm font-medium">Click to upload quotes</span>
                <p className="text-xs text-muted-foreground mt-1">PDF files, up to 5 quotes</p>
              </Label>
              <Input
                id="quote-upload"
                type="file"
                multiple
                accept=".pdf"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
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
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  ))}
                </div>
                
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">All quotes ready for instant comparison</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click "Compare Quotes Instantly" below to analyze coverage, limits, exclusions, and competitiveness across all {uploadedQuotes.length} quotes.
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

      {/* Results */}
      {analysisComplete && rankings.length > 0 && (
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
              {rankings.map((ranking, index) => (
                <Card key={ranking.quote_id} className={`relative ${index === 0 ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getRankIcon(ranking.rank_position)}
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
      )}
    </div>
  );
};

export default InstantQuoteComparison;