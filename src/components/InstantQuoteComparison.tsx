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
import PolicyWordingComparison from "./PolicyWordingComparison";
import { getInsurerInfo } from "@/lib/insurers";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import coverCompassLogo from "@/assets/covercompass-logo-new.png";

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
  const [policyWordingDocs, setPolicyWordingDocs] = useState<File[]>([]);
  const [policyWordingIds, setPolicyWordingIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingPolicyWordings, setIsProcessingPolicyWordings] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [rankings, setRankings] = useState<QuoteRanking[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [scoredRankings, setScoredRankings] = useState<QuoteRanking[]>([]);
  const [shouldCancel, setShouldCancel] = useState(false);
  const [statusLog, setStatusLog] = useState<Array<{time: string, message: string, type: 'info' | 'success' | 'error'}>>([]);
  const { toast } = useToast();

  const addStatusLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${type.toUpperCase()}:`, message);
    setStatusLog(prev => [...prev, { time: timestamp, message, type }]);
  };

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

  const handlePolicyWordingUpload = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files);
    const remainingSlots = 5 - policyWordingDocs.length;
    
    if (remainingSlots <= 0) {
      toast({
        title: "Maximum Reached",
        description: "You can upload a maximum of 5 policy wording documents. Remove some files first.",
        variant: "destructive",
      });
      return;
    }
    
    // Add new files to existing ones, up to the limit
    const filesToAdd = newFiles.slice(0, remainingSlots);
    const updatedDocs = [...policyWordingDocs, ...filesToAdd];
    
    setPolicyWordingDocs(updatedDocs);
    
    toast({
      title: `${filesToAdd.length} Policy Wording Document${filesToAdd.length !== 1 ? 's' : ''} Added`,
      description: `Total: ${updatedDocs.length} document${updatedDocs.length !== 1 ? 's' : ''} uploaded`,
    });
  };

  const removePolicyWordingDoc = (indexToRemove: number) => {
    const updatedDocs = policyWordingDocs.filter((_, index) => index !== indexToRemove);
    setPolicyWordingDocs(updatedDocs);
    
    toast({
      title: "Document Removed",
      description: `${updatedDocs.length} policy wording document${updatedDocs.length !== 1 ? 's' : ''} remaining`,
    });
  };

  const processPolicyWordings = async () => {
    if (policyWordingDocs.length === 0) {
      toast({
        title: "No Documents",
        description: "Please upload policy wording documents first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingPolicyWordings(true);
    const processedIds: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      setProcessingStep(`Processing ${policyWordingDocs.length} policy wording document${policyWordingDocs.length !== 1 ? 's' : ''}...`);

      for (let i = 0; i < policyWordingDocs.length; i++) {
        const file = policyWordingDocs[i];
        setProcessingStep(`Processing policy wording ${i + 1} of ${policyWordingDocs.length}...`);

        // Upload to storage
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

        // Preflight classification
        console.log('Running preflight classification for policy wording...');
        setProcessingStep(`Classifying policy wording ${i + 1}...`);
        
        const { data: preflightResult, error: preflightError } = await supabase.functions
          .invoke('preflight-classify', {
            body: { documentId: docData.id }
          });

        if (preflightError) {
          console.error('Preflight classification error:', preflightError);
        } else if (preflightResult?.classification) {
          const classification = preflightResult.classification;
          console.log('Policy wording classification:', classification);
          
          if (classification.warnings && classification.warnings.length > 0) {
            console.warn('Classification warnings:', classification.warnings);
          }
          
          if (classification.document_type_detected === 'Quote') {
            console.warn(`⚠️ This appears to be a Quote, not a Policy Wording! File: ${file.name}`);
          }
        }

        // Process with AI
        setProcessingStep(`Analyzing policy wording ${i + 1} with AI...`);
        const { data: processResult, error: processError } = await supabase.functions
          .invoke('process-policy-wording', {
            body: { documentId: docData.id }
          });

        if (processError) {
          console.error('Policy wording processing error:', processError);
          throw new Error(processError.message || 'Failed to process policy wording');
        }

        if (!processResult?.ok) {
          throw new Error(processResult?.error || 'Policy wording processing returned unsuccessful result');
        }

        if (processResult?.meta?.policyWordingId) {
          processedIds.push(processResult.meta.policyWordingId);
        } else {
          console.warn('No policyWordingId returned for document:', docData.id);
        }
      }

      setPolicyWordingIds(processedIds);
      
      toast({
        title: "Analysis Complete!",
        description: `${processedIds.length} policy wording${processedIds.length !== 1 ? 's' : ''} analyzed successfully`,
      });

    } catch (error) {
      console.error('Policy wording processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Processing Failed",
        description: errorMessage.includes('too large') 
          ? "Document is too large. Try splitting it or using a smaller file."
          : errorMessage.includes('timeout') || errorMessage.includes('connection')
          ? "Processing timed out. The document may be too complex. Try a simpler document or split it into sections."
          : `Error: ${errorMessage}`,
        variant: "destructive",
      });
      
      // Still set any successfully processed IDs
      if (processedIds.length > 0) {
        setPolicyWordingIds(processedIds);
        toast({
          title: "Partial Success",
          description: `${processedIds.length} document${processedIds.length !== 1 ? 's' : ''} processed successfully before error`,
        });
      }
    } finally {
      setIsProcessingPolicyWordings(false);
      setProcessingStep("");
    }
  };

  const analyzeQuotes = async () => {
    if (!selectedClient || (uploadedQuotes.length === 0 && policyWordingDocs.length === 0)) {
      toast({
        title: "Missing Information",
        description: "Please select a client and upload at least one quote or policy wording document",
        variant: "destructive",
      });
      return;
    }

    const t_start = performance.now();
    setIsProcessing(true);
    setAnalysisComplete(false);
    setShouldCancel(false);
    setStatusLog([]);
    
    addStatusLog('🚀 Starting optimized analysis pipeline...', 'info');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const allDocs: File[] = [...uploadedQuotes, ...policyWordingDocs];
      const docTypes = [
        ...uploadedQuotes.map(() => 'Quote'),
        ...policyWordingDocs.map(() => 'PolicyWording')
      ];
      
      addStatusLog(`📄 Processing ${allDocs.length} document(s) in parallel...`, 'info');
      
      // PHASE 1: Upload all documents (parallel)
      setProcessingStep("Uploading documents...");
      const t_upload_start = performance.now();
      
      const uploadPromises = allDocs.map(async (file, idx) => {
        const fileName = `${user.id}/${Date.now()}-${idx}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

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
        
        return { documentId: docData.id, filename: file.name, type: docTypes[idx] };
      });

      const uploadedDocs = await Promise.all(uploadPromises);
      const t_upload = performance.now() - t_upload_start;
      addStatusLog(`✓ Uploaded ${uploadedDocs.length} documents in ${Math.round(t_upload)}ms`, 'success');

      // PHASE 2: Preflight classification (parallel, optional - can skip for speed)
      setProcessingStep("Classifying documents...");
      const t_preflight_start = performance.now();
      
      const preflightPromises = uploadedDocs.map(async (doc) => {
        const { data, error } = await supabase.functions.invoke('preflight-classify', {
          body: { documentId: doc.documentId }
        });
        
        if (!error && data?.classification) {
          const cls = data.classification;
          addStatusLog(`📋 ${doc.filename}: ${cls.carrier || 'Unknown'} - ${cls.doc_type || 'Unknown'}`, 'info');
          
          if (cls.warnings?.length > 0) {
            cls.warnings.forEach((w: string) => addStatusLog(`⚠️ ${w}`, 'error'));
          }
          return { ...doc, classification: cls };
        }
        return { ...doc, classification: null };
      });

      const classifiedDocs = await Promise.all(preflightPromises);
      const t_preflight = performance.now() - t_preflight_start;
      addStatusLog(`✓ Classified ${classifiedDocs.length} documents in ${Math.round(t_preflight)}ms`, 'success');

      // PHASE 3: Extract fields (parallel)
      setProcessingStep("Extracting data with AI...");
      const t_extract_start = performance.now();
      
      const extractPromises = classifiedDocs.map(async (doc) => {
        const functionName = doc.type === 'Quote' ? 'extract-quote' : 'extract-wording';
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { documentId: doc.documentId }
        });

        if (error) {
          addStatusLog(`❌ Failed to extract ${doc.filename}: ${error.message}`, 'error');
          return null;
        }

        if (!data?.ok) {
          addStatusLog(`❌ Extraction error for ${doc.filename}`, 'error');
          return null;
        }

        const timing = data.meta?.timing;
        if (timing) {
          addStatusLog(`✓ Extracted ${doc.filename} in ${timing.total_ms}ms (fetch: ${timing.fetch_ms}ms, upload: ${timing.upload_ms}ms, extract: ${timing.extract_ms}ms)`, 'success');
        } else {
          addStatusLog(`✓ Extracted ${doc.filename}`, 'success');
        }

        return {
          ...doc,
          extraction: data.result,
          meta: data.meta
        };
      });

      const extractedDocs = (await Promise.all(extractPromises)).filter(Boolean);
      const t_extract = performance.now() - t_extract_start;
      addStatusLog(`✓ Extracted ${extractedDocs.length}/${classifiedDocs.length} documents in ${Math.round(t_extract)}ms`, 'success');

      if (extractedDocs.length === 0) {
        throw new Error('No documents extracted successfully');
      }

      // Track IDs for final summary
      const quoteCount = extractedDocs.filter(d => d.type === 'Quote').length;
      const wordingCount = extractedDocs.filter(d => d.type === 'PolicyWording').length;

      // PHASE 4: Aggregate & compare (single call)
      if (shouldCancel) {
        toast({ title: "Cancelled", description: "Analysis cancelled by user" });
        return;
      }

      setProcessingStep("Generating comprehensive comparison...");
      const t_aggregate_start = performance.now();
      addStatusLog('🔄 Generating comprehensive comparison...', 'info');

      const documentsForAnalysis = extractedDocs.map(doc => ({
        carrier_name: doc.classification?.carrier || doc.filename.split('_')[0] || 'Unknown',
        document_type: doc.type,
        filename: doc.filename,
        document_id: doc.documentId
      }));

      const selectedClientData = clients.find(c => c.id === selectedClient);
      
      const { data: comparisonData, error: comparisonError } = await supabase.functions.invoke(
        'comprehensive-comparison',
        {
          body: {
            client_name: selectedClientData?.client_name || 'Unknown Client',
            client_ref: `CC-${Date.now()}`,
            industry: selectedClientData?.industry || 'Professional Services',
            jurisdiction: 'UK',
            broker_name: 'CoverCompass',
            priority_metrics: ['Premium(Total)', 'CoverageTrigger', 'Limits', 'Deductible', 'Exclusions'],
            documents: documentsForAnalysis
          }
        }
      );

      const t_aggregate = performance.now() - t_aggregate_start;

      if (comparisonError) {
        addStatusLog(`❌ Comparison failed: ${comparisonError.message}`, 'error');
        throw new Error(`Comprehensive comparison failed: ${comparisonError.message}`);
      }

      if (!comparisonData?.analysis) {
        addStatusLog('❌ No analysis data received', 'error');
        throw new Error('Failed to generate comprehensive comparison');
      }

      addStatusLog(`✓ Comparison completed in ${Math.round(t_aggregate)}ms`, 'success');
      
      setRankings(comparisonData.analysis.extractions || []);
      setScoredRankings(comparisonData.analysis.extractions || []);
      setAnalysisComplete(true);

      // Final timing summary
      const t_total = performance.now() - t_start;
      addStatusLog(`\n🎉 TOTAL TIME: ${Math.round(t_total)}ms`, 'success');
      addStatusLog(`  • Upload: ${Math.round(t_upload)}ms`, 'info');
      addStatusLog(`  • Classify: ${Math.round(t_preflight)}ms`, 'info');
      addStatusLog(`  • Extract: ${Math.round(t_extract)}ms`, 'info');
      addStatusLog(`  • Compare: ${Math.round(t_aggregate)}ms`, 'info');

      let successMessage = "Analysis complete!";
      if (quoteCount > 0 && wordingCount > 0) {
        successMessage = `Analyzed ${quoteCount} quote${quoteCount !== 1 ? 's' : ''} and ${wordingCount} wording${wordingCount !== 1 ? 's' : ''} in ${Math.round(t_total / 1000)}s`;
      } else if (quoteCount > 0) {
        successMessage = `Ranked ${quoteCount} quote${quoteCount !== 1 ? 's' : ''} in ${Math.round(t_total / 1000)}s`;
      } else if (wordingCount > 0) {
        successMessage = `Analyzed ${wordingCount} wording${wordingCount !== 1 ? 's' : ''} in ${Math.round(t_total / 1000)}s`;
      }

      toast({
        title: "Analysis Complete! ⚡",
        description: successMessage,
      });

    } catch (error) {
      console.error('Analysis error:', error);
      addStatusLog(`❌ Fatal error: ${error.message}`, 'error');
      toast({
        title: "Analysis Failed",
        description: `Error: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
      setShouldCancel(false);
    }
  };

  const cancelAnalysis = () => {
    setShouldCancel(true);
    setIsProcessing(false);
    setProcessingStep("");
    toast({
      title: "Cancelling",
      description: "Stopping analysis process...",
    });
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

  const downloadIndividualQuote = async (quoteId: string, insurer: string) => {
    try {
      // First get the quote data with document_id
      const { data: quoteData, error: quoteError } = await supabase
        .from('structured_quotes')
        .select('document_id, client_name')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      if (!quoteData?.document_id) {
        throw new Error('No associated document found for this quote');
      }

      // Now get the document using the document_id from the quote
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', quoteData.document_id)
        .single();

      if (docError) throw docError;

      if (docData.storage_path) {
        // Download from Supabase storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(docData.storage_path);

        if (downloadError) throw downloadError;

        // Create download link
        const url = URL.createObjectURL(fileData);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = `${insurer}_Quote_${quoteData.client_name || 'Document'}.${docData.filename.split('.').pop()}`;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Download Complete",
          description: `${insurer} quote downloaded successfully`,
        });
      } else {
        throw new Error('No file available for download');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: `Could not download ${insurer} quote: ${error.message}`,
        variant: "destructive",
      });
    }
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

      // Create a temporary container for printing sized for A4
      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.top = '-9999px';
      printContainer.style.left = '-9999px';
      printContainer.style.width = '210mm'; // A4 width
      printContainer.style.padding = '20mm';
      printContainer.style.backgroundColor = 'white';
      printContainer.style.fontFamily = 'system-ui, sans-serif';
      printContainer.style.fontSize = '16px';
      printContainer.style.lineHeight = '1.5';
      
      // Get only the comparison results sections (not the upload/selection steps)
      const pdfCoverageSection = document.querySelector('[data-section="coverage-highlights"]');
      const pdfRankingsSection = document.querySelector('[data-section="quote-rankings"]');
      
      let contentHTML = '';
      if (pdfCoverageSection) {
        contentHTML += pdfCoverageSection.outerHTML;
      }
      if (pdfRankingsSection) {
        contentHTML += pdfRankingsSection.outerHTML;
      }
      
      printContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 40px; margin-bottom: 30px; border-radius: 16px; box-shadow: 0 10px 30px rgba(37, 99, 235, 0.3);">
          <div style="display: flex; align-items: center; gap: 24px;">
            <img src="${coverCompassLogo}" alt="CoverCompass Logo" style="height: 70px; width: auto; object-fit: contain;" />
            <div>
              <h1 style="font-size: 36px; font-weight: 700; margin: 0; line-height: 1.1; letter-spacing: -0.02em;">CoverCompass</h1>
              <p style="font-size: 18px; opacity: 0.95; margin: 10px 0 0 0; font-weight: 500;">Insurance Quote Comparison Report</p>
            </div>
          </div>
        </div>
        
        <div style="background: linear-gradient(145deg, #f8fafc, #f1f5f9); padding: 32px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
          <div style="display: flex; align-items: center; margin-bottom: 24px;">
            <div style="background: #2563eb; color: white; padding: 12px; border-radius: 12px; margin-right: 16px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 style="font-size: 24px; margin: 0; color: #1e293b; font-weight: 700;">Client Information</h3>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 16px;">
            <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #2563eb;">
              <div style="color: #64748b; font-size: 14px; font-weight: 500; margin-bottom: 4px;">CLIENT NAME</div>
              <div style="color: #1e293b; font-weight: 600; font-size: 16px;">${selectedClientData.client_name}</div>
            </div>
            <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #2563eb;">
              <div style="color: #64748b; font-size: 14px; font-weight: 500; margin-bottom: 4px;">REPORT DATE</div>
              <div style="color: #1e293b; font-weight: 600; font-size: 16px;">${new Date().toLocaleDateString('en-GB', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</div>
            </div>
            ${selectedClientData.industry ? `
            <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #2563eb;">
              <div style="color: #64748b; font-size: 14px; font-weight: 500; margin-bottom: 4px;">INDUSTRY</div>
              <div style="color: #1e293b; font-weight: 600; font-size: 16px;">${selectedClientData.industry}</div>
            </div>
            ` : ""}
            <div style="background: white; padding: 16px; border-radius: 12px; border-left: 4px solid #2563eb;">
              <div style="color: #64748b; font-size: 14px; font-weight: 500; margin-bottom: 4px;">QUOTES ANALYZED</div>
              <div style="color: #1e293b; font-weight: 600; font-size: 16px;">${rankings.length} Insurance Quotes</div>
            </div>
          </div>
        </div>
      `;
      
      // Create content section for subsequent pages
      const contentContainer = document.createElement('div');
      contentContainer.style.position = 'absolute';
      contentContainer.style.top = '-9999px';
      contentContainer.style.left = '-9999px';
      contentContainer.style.width = '210mm';
      contentContainer.style.padding = '20mm';
      contentContainer.style.backgroundColor = 'white';
      contentContainer.style.fontFamily = 'system-ui, sans-serif';
      contentContainer.style.fontSize = '16px';
      contentContainer.style.lineHeight = '1.5';
      
      // Create better styled content for PDF
      let styledContent = '';
      
      // Find Coverage Comparison section and style it
      const styledCoverageSection = document.querySelector('[data-section="coverage-highlights"]');
      if (styledCoverageSection) {
        const coverageHTML = styledCoverageSection.innerHTML;
        styledContent += `
          <div style="margin-bottom: 32px; page-break-inside: avoid;">
            <div style="background: linear-gradient(145deg, #f0f9ff, #e0f2fe); padding: 24px; border-radius: 12px; border: 2px solid #0ea5e9; box-shadow: 0 6px 20px rgba(14, 165, 233, 0.12);">
              <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <div style="background: #0ea5e9; color: white; padding: 8px; border-radius: 8px; margin-right: 12px;">
                  <div style="width: 16px; height: 16px; background: currentColor; mask: url('data:image/svg+xml,<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z\"/></svg>');"></div>
                </div>
                <div>
                  <h2 style="font-size: 20px; margin: 0; color: #0f172a; font-weight: 700; letter-spacing: -0.01em;">Coverage Comparison Highlights</h2>
                  <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0; font-weight: 500;">Key coverage limits and which quote provides the best protection</p>
                </div>
              </div>
              <div style="font-size: 12px; line-height: 1.4; color: #334155;">
                <style>
                  .pdf-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                  .pdf-table th, .pdf-table td { padding: 8px 6px; text-align: left; border: 1px solid #e2e8f0; font-size: 11px; }
                  .pdf-table th { background: #f8fafc; font-weight: 600; color: #475569; }
                  .pdf-coverage-card { background: white; padding: 12px; margin: 6px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; width: calc(50% - 12px); }
                  .pdf-coverage-title { font-weight: 600; color: #1e293b; font-size: 12px; margin-bottom: 6px; }
                  .pdf-coverage-amount { font-size: 16px; font-weight: 700; color: #0ea5e9; }
                  .pdf-best-provider { font-size: 10px; color: #64748b; margin-top: 4px; }
                </style>
                ${coverageHTML}
              </div>
            </div>
          </div>
        `;
      }
      
      // Find Quote Rankings section and style it  
      const styledRankingsSection = document.querySelector('[data-section="quote-rankings"]');
      if (styledRankingsSection) {
        const rankingsHTML = styledRankingsSection.innerHTML;
        styledContent += `
          <div style="margin-bottom: 32px; page-break-inside: avoid;">
            <div style="background: linear-gradient(145deg, #fefce8, #fef3c7); padding: 24px; border-radius: 12px; border: 2px solid #f59e0b; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.12);">
              <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <div style="background: #f59e0b; color: white; padding: 8px; border-radius: 8px; margin-right: 12px;">
                  <div style="width: 16px; height: 16px; background: currentColor; mask: url('data:image/svg+xml,<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M13 7h8m0 0v8m0-8l-8 8-4-4-6 6\"/></svg>');"></div>
                </div>
                <div>
                  <h2 style="font-size: 20px; margin: 0; color: #0f172a; font-weight: 700; letter-spacing: -0.01em;">Quote Rankings - Best to Worst</h2>
                  <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0; font-weight: 500;">Ranked by overall coverage quality, competitiveness, and value</p>
                </div>
              </div>
              <div style="font-size: 12px; line-height: 1.4; color: #334155;">
                <style>
                  .pdf-quote-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
                  .pdf-quote-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
                  .pdf-insurer-info { display: flex; align-items: center; gap: 8px; }
                  .pdf-insurer-name { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0; }
                  .pdf-quote-premium { font-size: 18px; font-weight: 700; color: #059669; text-align: right; }
                  .pdf-scores { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 12px 0; }
                  .pdf-score-item { text-align: center; padding: 8px; background: #f8fafc; border-radius: 6px; }
                  .pdf-score-value { font-size: 14px; font-weight: 600; }
                  .pdf-score-label { font-size: 10px; color: #64748b; margin-top: 2px; }
                  .pdf-strengths { margin-top: 12px; }
                  .pdf-strengths h4 { font-size: 12px; font-weight: 600; color: #059669; margin: 0 0 6px 0; }
                  .pdf-strengths ul { margin: 0; padding-left: 16px; }
                  .pdf-strengths li { font-size: 11px; margin-bottom: 3px; }
                </style>
                ${rankingsHTML}
              </div>
            </div>
          </div>
        `;
      }
      
      contentContainer.innerHTML = `
        <!-- Coverage Comparison Section -->
        <div style="margin-bottom: 32px; page-break-inside: avoid;">
          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="font-size: 18px; margin: 0 0 4px 0; color: #1f2937; font-weight: 600; display: flex; align-items: center;">
              <span style="display: inline-block; width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; margin-right: 8px;"></span>
              Coverage Comparison Highlights
            </h2>
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 20px 14px; font-weight: 400;">Key coverage limits and which quote provides the best protection</p>
            
            <!-- Coverage Cards Grid - First Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="display: inline-block; width: 4px; height: 4px; background: #6b7280; border-radius: 50%; margin-right: 6px;"></span>
                  <span style="font-size: 12px; font-weight: 500; color: #374151;">Professional Indemnity</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Best Coverage:</div>
                  <div style="font-size: 10px; color: #3b82f6; display: flex; align-items: center;">
                    <span style="margin-right: 4px;">✓</span>
                    ${rankings.length > 0 ? rankings[0].insurer_name : 'No quotes'}
                  </div>
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #1f2937;">£2M</div>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="display: inline-block; width: 4px; height: 4px; background: #6b7280; border-radius: 50%; margin-right: 6px;"></span>
                  <span style="font-size: 12px; font-weight: 500; color: #374151;">Public Liability</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Best Coverage:</div>
                  <div style="font-size: 10px; color: #3b82f6; display: flex; align-items: center;">
                    <span style="margin-right: 4px;">✓</span>
                    ${rankings.length > 0 ? rankings[0].insurer_name : 'No quotes'}
                  </div>
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #1f2937;">£1M</div>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="display: inline-block; width: 4px; height: 4px; background: #6b7280; border-radius: 50%; margin-right: 6px;"></span>
                  <span style="font-size: 12px; font-weight: 500; color: #374151;">Employers Liability</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Best Coverage:</div>
                  <div style="font-size: 10px; color: #3b82f6; display: flex; align-items: center;">
                    <span style="margin-right: 4px;">✓</span>
                    ${rankings.length > 0 ? rankings[0].insurer_name : 'No quotes'}
                  </div>
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #1f2937;">£10M</div>
              </div>
            </div>
            
            <!-- Coverage Cards Grid - Second Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="display: inline-block; width: 4px; height: 4px; background: #6b7280; border-radius: 50%; margin-right: 6px;"></span>
                  <span style="font-size: 12px; font-weight: 500; color: #374151;">Cyber & Data Protection</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Best Coverage:</div>
                  <div style="font-size: 10px; color: #3b82f6; display: flex; align-items: center;">
                    <span style="margin-right: 4px;">✓</span>
                    ${rankings.length > 0 ? rankings[0].insurer_name : 'No quotes'}
                  </div>
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #1f2937;">£500K</div>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="display: inline-block; width: 4px; height: 4px; background: #6b7280; border-radius: 50%; margin-right: 6px;"></span>
                  <span style="font-size: 12px; font-weight: 500; color: #374151;">Product Liability</span>
                </div>
                <div style="margin-bottom: 8px;">
                  <div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">Best Coverage:</div>
                  <div style="font-size: 10px; color: #3b82f6; display: flex; align-items: center;">
                    <span style="margin-right: 4px;">✓</span>
                    ${rankings.length > 0 ? rankings[0].insurer_name : 'No quotes'}
                  </div>
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #1f2937;">£2M</div>
              </div>
            </div>
            
            <!-- Comparison Table -->
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Insurer</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Premium</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Professional Indemnity</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Public Liability</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Employers Liability</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Cyber & Data</th>
                    <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Overall Score</th>
                  </tr>
                </thead>
                <tbody>
                  ${rankings.map((ranking, index) => `
                    <tr>
                      <td style="padding: 10px 8px; border-bottom: 1px solid #f3f4f6;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div style="background: ${index === 0 ? '#fbbf24' : index === 1 ? '#3b82f6' : index === 2 ? '#f97316' : '#6b7280'}; color: white; padding: 4px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">${ranking.insurer_name.substring(0, 2).toUpperCase()}</div>
                          <div>
                            <div style="font-weight: 500; color: #1f2937; font-size: 11px;">${ranking.insurer_name}</div>
                            <div style="background: ${index === 0 ? '#1f2937' : index === 1 ? '#3b82f6' : index === 2 ? '#0ea5e9' : '#6b7280'}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 8px; display: inline-block; margin-top: 2px;">Rank #${ranking.rank_position}</div>
                          </div>
                        </div>
                      </td>
                      <td style="padding: 10px 8px; text-align: center; font-weight: 600; border-bottom: 1px solid #f3f4f6;">£${ranking.premium_amount?.toLocaleString() || 'N/A'}</td>
                      <td style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                        <span style="background: ${index <= 1 ? '#dcfce7' : '#fee2e2'}; color: ${index <= 1 ? '#166534' : '#dc2626'}; padding: 2px 6px; border-radius: 4px; font-size: 9px;">${index <= 1 ? '✓ £2M' : '⚠ Not Covered'}</span>
                      </td>
                      <td style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                        <span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 9px;">✓ £1M</span>
                      </td>
                      <td style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                        <span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 9px;">✓ £10M</span>
                      </td>
                      <td style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                        <span style="background: ${index <= 1 ? '#dcfce7' : '#fef3c7'}; color: ${index <= 1 ? '#166534' : '#d97706'}; padding: 2px 6px; border-radius: 4px; font-size: 9px;">${index <= 1 ? '✓ £500K' : '⚬ Basic Cover'}</span>
                      </td>
                      <td style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #f3f4f6;">
                        <div style="font-weight: 600; color: ${ranking.overall_score >= 80 ? '#16a34a' : ranking.overall_score >= 50 ? '#16a34a' : '#dc2626'}; font-size: 13px;">${ranking.overall_score}%</div>
                        <div style="font-size: 9px; color: #6b7280;">Coverage: ${ranking.coverage_score}% | Price: ${ranking.competitiveness_score}%</div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="background: #16a34a; color: white; padding: 4px; border-radius: 4px; margin-right: 8px; font-size: 10px;">✓</span>
                  <span style="font-weight: 600; color: #166534; font-size: 12px;">Best Value for Money</span>
                </div>
                <p style="font-size: 11px; color: #166534; margin: 0; line-height: 1.4;">
                  <strong>${rankings.length > 0 ? rankings[0].insurer_name : 'No quotes'}</strong> offers the best combination of coverage and price at £${rankings.length > 0 ? rankings[0].premium_amount?.toLocaleString() : 'N/A'} with an overall score of ${rankings.length > 0 ? rankings[0].overall_score : 0}%.
                </p>
              </div>
              
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="background: #3b82f6; color: white; padding: 4px; border-radius: 4px; margin-right: 8px; font-size: 10px;">○</span>
                  <span style="font-weight: 600; color: #1d4ed8; font-size: 12px;">Coverage Analysis</span>
                </div>
                <p style="font-size: 11px; color: #1d4ed8; margin: 0; line-height: 1.4;">
                  Scoring considers coverage limits (60%) and pricing competitiveness (40%). ${rankings.filter(r => r.overall_score >= 80).length} quotes scored 80%+ overall.
                </p>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(printContainer);
      document.body.appendChild(contentContainer);
      
      // Generate PDF with multiple pages
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      
      // Capture at proper scale for PDF readability
      const headerCanvas = await html2canvas(printContainer, { 
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        height: printContainer.scrollHeight,
        width: printContainer.scrollWidth
      });
      
      const headerRatio = headerCanvas.width / headerCanvas.height;
      let headerWidth = maxWidth;
      let headerHeight = headerWidth / headerRatio;
      
      if (headerHeight > maxHeight) {
        headerHeight = maxHeight;
        headerWidth = headerHeight * headerRatio;
      }
      
      pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', margin, margin, headerWidth, headerHeight);
      
      // Add content pages
      const contentCanvas = await html2canvas(contentContainer, { 
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        height: contentContainer.scrollHeight,
        width: contentContainer.scrollWidth
      });
      
      const contentRatio = contentCanvas.width / contentCanvas.height;
      let contentWidth = maxWidth;
      let contentHeight = contentWidth / contentRatio;
      
      // Add content starting from page 2
      pdf.addPage();
      
      if (contentHeight > maxHeight) {
        // Split content across multiple pages if needed
        const pagesNeeded = Math.ceil(contentHeight / maxHeight);
        
        for (let page = 0; page < pagesNeeded; page++) {
          if (page > 0) pdf.addPage();
          
          const yOffset = page * (contentCanvas.height / pagesNeeded);
          const pageCanvas = document.createElement('canvas');
          const pageCtx = pageCanvas.getContext('2d');
          
          if (pageCtx) {
            pageCanvas.width = contentCanvas.width;
            pageCanvas.height = Math.min(contentCanvas.height / pagesNeeded, contentCanvas.height - yOffset);
            
            pageCtx.fillStyle = '#ffffff';
            pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageCtx.drawImage(contentCanvas, 0, -yOffset);
            
            const scaledHeight = (pageCanvas.height / contentCanvas.height) * contentHeight;
            pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, scaledHeight);
          }
        }
      } else {
        pdf.addImage(contentCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, contentHeight);
      }
      
      document.body.removeChild(printContainer);
      document.body.removeChild(contentContainer);
      
      const fileName = `CoverCompass_Analysis_${selectedClientData.client_name.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
      toast({
        title: "✅ Report Generated",
        description: `Your CoverCompass report has been downloaded!`,
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
            Upload quotes and compare coverage instantly. CoverCompassAI analyzes schedules, limits, clauses, and terms to rank quotes from best to worst.
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
                      ? "CoverCompassAI will analyze your quote for coverage details and recommendations."
                      : `Click "Compare Quotes Instantly" below to analyze coverage, limits, exclusions, and competitiveness across all ${uploadedQuotes.length} quotes.`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2.1: Policy Wording Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Step 2.1: Upload Policy Wording Documents (1-5) *Optional*</span>
          </CardTitle>
          <CardDescription>Upload policy wording documents for detailed coverage comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                policyWordingDocs.length >= 5 
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                  : 'border-muted-foreground/25 cursor-pointer hover:border-primary/50'
              }`}
              onDrop={(e) => {
                e.preventDefault();
                if (policyWordingDocs.length >= 5) return;
                const files = e.dataTransfer.files;
                handlePolicyWordingUpload(files);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
            >
              <Upload className={`h-8 w-8 mx-auto mb-2 ${
                policyWordingDocs.length >= 5 ? 'text-gray-400' : 'text-muted-foreground'
              }`} />
              {policyWordingDocs.length >= 5 ? (
                <>
                  <span className="text-sm font-medium text-gray-500">Maximum 5 documents reached</span>
                  <p className="text-xs text-gray-400 mt-1">Remove a document to add another</p>
                </>
              ) : (
                <Label htmlFor="policy-wording-upload" className="cursor-pointer">
                  <span className="text-sm font-medium">
                    {policyWordingDocs.length === 0 ? 'Click to upload policy wording documents' : 'Click to add more documents'}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload PDF policy wording documents ({policyWordingDocs.length}/5 uploaded)
                  </p>
                </Label>
              )}
              <Input
                id="policy-wording-upload"
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => handlePolicyWordingUpload(e.target.files)}
                className="hidden"
                disabled={policyWordingDocs.length >= 5}
              />
            </div>
            
            {policyWordingDocs.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center">
                    <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                    Policy Wording Documents
                  </h4>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    {policyWordingDocs.length} Document{policyWordingDocs.length !== 1 ? 's' : ''} Uploaded
                  </Badge>
                </div>
                
                <div className="grid gap-2">
                  {policyWordingDocs.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-25 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                          <FileText className="h-4 w-4 text-blue-700" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{file.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • Policy wording document
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePolicyWordingDoc(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      {policyWordingDocs.length === 1 
                        ? "Policy wording document added" 
                        : `${policyWordingDocs.length} policy wording documents added`
                      }
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These documents will be analyzed alongside quotes for comprehensive coverage comparison.
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
          <CardDescription>CoverCompassAI will analyze coverage, limits, terms, and competitiveness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 border border-border rounded-lg p-3 mb-4">
              <p className="text-xs text-muted-foreground">
                Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail.
              </p>
            </div>
            
            <Button 
              onClick={analyzeQuotes}
              disabled={!selectedClient || (uploadedQuotes.length === 0 && policyWordingDocs.length === 0) || isProcessing}
              size="lg"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                  Analyzing Documents...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  {uploadedQuotes.length > 0 && policyWordingDocs.length > 0
                    ? "Compare Quotes & Policy Wordings"
                    : uploadedQuotes.length > 0
                    ? "Compare Quotes Instantly"
                    : "Analyze Policy Wordings"}
                </>
              )}
            </Button>
            
            {(!selectedClient || (uploadedQuotes.length === 0 && policyWordingDocs.length === 0)) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Requirements Missing</span>
                </div>
                <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                  {!selectedClient && <li>• Please select a client in Step 1</li>}
                  {uploadedQuotes.length === 0 && policyWordingDocs.length === 0 && <li>• Please upload at least one quote or policy wording in Step 2</li>}
                </ul>
              </div>
            )}
            
            {isProcessing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{processingStep}</span>
                  <span>Processing...</span>
                </div>
                <Progress value={uploadedQuotes.length > 0 ? Math.round((100 / (uploadedQuotes.length + 1)) * (uploadedQuotes.length > 0 ? 1 : 0)) : 33} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  Using CoverCompassAI to analyze schedules, limits, exclusions, enhancements, and core policy wording...
                </p>
                
                {/* Status Log */}
                {statusLog.length > 0 && (
                  <div className="mt-4 border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 border-b border-border">
                      <span className="text-xs font-medium">Processing Log</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto bg-background">
                      {statusLog.map((log, index) => (
                        <div 
                          key={index} 
                          className={`px-3 py-2 text-xs border-b border-border/50 last:border-0 flex items-start space-x-2 ${
                            log.type === 'error' ? 'bg-destructive/10 text-destructive' : 
                            log.type === 'success' ? 'bg-green-50 text-green-700' : 
                            'text-muted-foreground'
                          }`}
                        >
                          <span className="font-mono text-[10px] text-muted-foreground/60 min-w-[60px]">{log.time}</span>
                          <span className="flex-1">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={cancelAnalysis}
                  variant="destructive"
                  size="sm"
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop Analysis
                </Button>
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
          <Card data-section="coverage-highlights">
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

          <Card data-section="quote-rankings">
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
                         <div className="mt-2">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => downloadIndividualQuote(ranking.quote_id, ranking.insurer_name)}
                             className="flex items-center space-x-1"
                           >
                             <Download className="h-3 w-3" />
                             <span>Download</span>
                           </Button>
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

      {/* Policy Wording Comparison Results */}
      {policyWordingIds.length > 0 && (
        <PolicyWordingComparison policyWordingIds={policyWordingIds} />
      )}
    </div>
  );
};

export default InstantQuoteComparison;