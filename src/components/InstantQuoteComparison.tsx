import {useState, useEffect, useRef} from "react";
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
  Download, LayoutList,
  Pen, // Added for Edit icon
  Save, // Added for Save icon
  RotateCcw // Added for Undo/Cancel icon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import CoverageComparisonTable from "./CoverageComparisonTable";
import PolicyWordingComparison from "./PolicyWordingComparison";
import { getInsurerInfo } from "@/lib/insurers";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useReactToPrint } from 'react-to-print';
import {Textarea} from "@/components/ui/textarea.tsx";
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
interface ReportSection {
  id: string;
  title: string;
  content: string;
  originalContent: string; // To allow reverting if needed
}
const InstantQuoteComparison = () => {
  const reportRef = useRef<HTMLDivElement>(null);
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
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [extractedDocumentIds, setExtractedDocumentIds] = useState<{documentId: string, type: string, carrier: string}[]>([]);
  const [shouldCancel, setShouldCancel] = useState(false);
  const [statusLog, setStatusLog] = useState<Array<{time: string, message: string, type: 'info' | 'success' | 'error'}>>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([
    'professional_indemnity',
    'cyber',
    'crime',
    'public_products_liability',
    'property'
  ]); // All selected by default
  const { toast } = useToast();
  const [markdownReport, setMarkdownReport] = useState<string | null>(null);
  const [reportSections, setReportSections] = useState<ReportSection[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [tempEditContent, setTempEditContent] = useState("");
  const [isHideEditIcon, setHideEditIcon] = useState(false);

  const coverageSections = [
    { key: 'professional_indemnity', label: 'Professional Indemnity' },
    { key: 'cyber', label: 'Cyber & Data' },
    { key: 'crime', label: 'Crime & Fraud' },
    { key: 'public_products_liability', label: 'Public & Products Liability' },
    { key: 'property', label: 'Property & Business Interruption' },
  ];

  const toggleSection = (sectionKey: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionKey)
        ? prev.filter(s => s !== sectionKey)
        : [...prev, sectionKey]
    );
  };

  const selectAllSections = () => {
    setSelectedSections(coverageSections.map(s => s.key));
  };

  const deselectAllSections = () => {
    setSelectedSections([]);
  };

  const addStatusLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${type.toUpperCase()}:`, message);
    setStatusLog(prev => [...prev, { time: timestamp, message, type }]);
  };

  useEffect(() => {
    if (markdownReport) {
      parseReportToSections(markdownReport);
    }
  }, [markdownReport]);

  const parseReportToSections = (markdown: string) => {
    console.log("markdown",markdown)
    const sections: ReportSection[] = [];

    // Robust section splitter: capture any Markdown heading (1-6 #) as a section title
    // and capture the following content until the next heading or end of file.
    // This reliably picks up headings like:
    // ### 1. Financial Comparison
    // #### Section 1 Summary: Financials
    // #### Executive Short Summary
    const sectionRegex = /(#{1,6}\s*[^\n]+)(?:\r?\n|\r)([\s\S]*?)(?=(?:#{1,6}\s*[^\n]+)|$)/gi;

    let match;
    while ((match = sectionRegex.exec(markdown)) !== null) {
      // match[1] is the raw heading (e.g. "### 1. Financial Comparison")
      // match[2] is the content until the next heading
      const rawHeading = match[1].trim();
      // Remove leading hashes and any surrounding bold markers
      const cleanTitle = rawHeading.replace(/^#{1,6}\s*/,'').replace(/\*\*/g, '').trim();
      const content = match[2].trim();

      // create a stable id by slugifying the title (limited length)
      const slug = cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 40);

      sections.push({
        id: `section-${sections.length}-${slug}`,
        title: cleanTitle,
        content: content,
        originalContent: content
      });
    }

    // If regex fails (e.g. flat structure), fallback to one big section
    if (sections.length === 0 && markdown.length > 0) {
      sections.push({
        id: 'section-main',
        title: 'Full Report Analysis',
        content: markdown,
        originalContent: markdown
      });
    }

    setReportSections(sections);
  };

  // --- Editable Handlers ---

  const handleEditClick = (section: ReportSection) => {
    // Allow editing only for Summary sections
    if (!section.title.toLowerCase().includes("summary")) {
        return; // Prevent editing for non-summary sections
    }

    setEditingSectionId(section.id);
    setTempEditContent(section.content);
  };

  const handleCancelClick = () => {
    setEditingSectionId(null);
    setTempEditContent("");
  };

  const handleSaveClick = (id: string) => {
    setReportSections(prev =>
        prev.map(section =>
            section.id === id
                ? { ...section, content: tempEditContent }
                : section
        )
    );
    setEditingSectionId(null);
    setTempEditContent("");

    toast({
      title: "Section Updated",
      description: "Changes saved to the report view.",
      duration: 2000
    });
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

        // Get user's company_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.company_id) {
          throw new Error('User profile or company not found');
        }

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
            company_id: profile.company_id,
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
        setProcessingStep(`Analysing policy wording ${i + 1} with AI...`);
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

        // Check if cached result was used
        if (processResult?.cached) {
          console.log(`⚡ Cache hit for ${file.name} - instant results!`);
          addStatusLog(`⚡ Found cached analysis for ${file.name} - instant results!`, 'success');
          toast({
            title: "⚡ Cached Analysis Used",
            description: `${file.name} was previously analyzed - instant results!`,
            duration: 3000,
          });
        } else {
          addStatusLog(`✅ Completed AI analysis of ${file.name}`, 'success');
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
        description: `${processedIds.length} policy wording${processedIds.length !== 1 ? 's' : ''} analysed successfully`,
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

  const analyseQuotes = async () => {
    if (!selectedClient || (uploadedQuotes.length === 0 && policyWordingDocs.length === 0)) {
      toast({
        title: "Missing Information",
        description: "Please select a client and upload documents.",
        variant: "destructive",
      });
      return;
    }

    const t_start = performance.now();
    setIsProcessing(true);
    setAnalysisComplete(false);
    setShouldCancel(false);
    setStatusLog([]);

    // Reset previous results to clear the view
    setRankings([]);
    setComparisonData(null);
    setMarkdownReport(null);

    addStatusLog('🚀 Starting comparative analysis...', 'info');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Get user's company_id
      const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

      if (!profile?.company_id) throw new Error('User profile not found');

      const allDocs: File[] = [...uploadedQuotes, ...policyWordingDocs];
      const docTypes = [
        ...uploadedQuotes.map(() => 'Quote'),
        ...policyWordingDocs.map(() => 'PolicyWording')
      ];

      // --- PHASE 1: UPLOAD DOCUMENTS ---
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
              company_id: profile.company_id,
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

      // --- PHASE 2: GENERATE REPORT ---
      setProcessingStep("Generating Comparative Report with AI...");

      // Prepare metadata for all documents in a single batch
      const documentsForBatch = uploadedDocs.map((doc, idx) => ({
        carrier_name: doc.filename.split('_')[0] || 'Unknown',
        document_type: docTypes[idx],
        filename: doc.filename,
        document_id: doc.documentId
      }));

      const selectedClientData = clients.find(c => c.id === selectedClient);

      // CONSTRUCT PAYLOAD WITH "comparison_report" MODE
      const payload = {
        client_name: selectedClientData?.client_name || 'Unknown Client',
        client_ref: `CC-${Date.now()}`,
        industry: selectedClientData?.industry || 'Professional Services',
        jurisdiction: 'UK',
        selectedSections: selectedSections,
        mode: "comparison_report", // <--- KEY CHANGE: Request Report Mode
        documents: documentsForBatch
      };

      addStatusLog(`🧠 Comparing ${documentsForBatch.length} documents...`, 'info');

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('batch-analyze-documents', {
        body: payload
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Analysis failed');

      // HANDLE MARKDOWN RESPONSE
      if (data.report_markdown) {
        setMarkdownReport(data.report_markdown);
        setAnalysisComplete(true);

        // Update processed IDs state for UI consistency
        const extractedIds = documentsForBatch.map(doc => ({
          documentId: doc.document_id,
          type: doc.document_type,
          carrier: doc.carrier_name
        }));
        setExtractedDocumentIds(extractedIds);

        const t_total = performance.now() - t_start;
        addStatusLog(`🎉 Report Generated in ${Math.round(t_total / 1000)}s`, 'success');

        toast({
          title: "Report Ready ⚡",
          description: "Comparative analysis report generated successfully.",
        });
      } else {
        throw new Error("AI did not return a markdown report.");
      }

    } catch (error: any) {
      console.error('Analysis error:', error);
      addStatusLog(`❌ Error: ${error.message || 'Unknown error'}`, 'error');
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
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

  const handleDownloadPdf = async () => {
    setHideEditIcon(true)
    if (!reportRef.current) return;

    const html2pdf = (await import("html2pdf.js")).default;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Report_${Date.now()}.pdf`,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  {
        scale: 4,
        useCORS: true,
        letterRendering: true,
        backgroundColor: "#ffffff",
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf()
        .set(opt)
        .from(reportRef.current)
        .save();
    setHideEditIcon(false)
  };
  // Retry a failed document by re-uploading and merging with existing data
  const retryFailedDocument = async (failedDoc: any) => {
    try {
      // Create a file input dynamically
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          setIsProcessing(true);
          addStatusLog(`🔄 Retrying extraction for ${failedDoc.filename}...`, 'info');

          // Get user's profile
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('No authenticated user');

          const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, user_id')
            .eq('user_id', user.id)
            .single();

          if (!profile?.company_id) {
            throw new Error('User profile or company not found');
          }

          // Upload the new file
          const filename = `${Date.now()}_${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(`${profile.company_id}/${filename}`, file);

          if (uploadError) throw uploadError;

          // Create document record
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
              user_id: profile.user_id,
              company_id: profile.company_id,
              filename: file.name,
              file_type: file.type,
              file_size: file.size,
              storage_path: uploadData.path,
              status: 'uploaded'
            })
            .select()
            .single();

          if (docError) throw docError;

          addStatusLog(`✓ Uploaded replacement document`, 'success');

          // Classify the document
          const { data: classifyData, error: classifyError } = await supabase.functions.invoke(
            'preflight-classify',
            { body: { documentId: docData.id } }
          );

          if (classifyError) throw classifyError;

          const classification = classifyData.classification;
          addStatusLog(`✓ Classified as ${classification.type}`, 'success');

          // Extract data
          const functionName = classification.type === 'Quote' ? 'extract-quote' : 'extract-wording';
          const { data: extractData, error: extractError } = await supabase.functions.invoke(
            functionName,
            { body: { documentId: docData.id } }
          );

          if (extractError) throw extractError;
          if (!extractData?.ok) throw new Error('Extraction failed');

          addStatusLog(`✓ Extracted data successfully`, 'success');

          // Fetch previously extracted data from database
          const previousDocIds = extractedDocumentIds.map(d => d.documentId);
          
          // Fetch quotes
          const { data: previousQuotes, error: quotesError } = await supabase
            .from('structured_quotes')
            .select('*')
            .in('document_id', previousDocIds.filter(id => 
              extractedDocumentIds.find(d => d.documentId === id && d.type === 'Quote')
            ));

          if (quotesError) throw quotesError;

          // Fetch wordings
          const { data: previousWordings, error: wordingsError } = await supabase
            .from('policy_wordings')
            .select('*')
            .in('document_id', previousDocIds.filter(id => 
              extractedDocumentIds.find(d => d.documentId === id && d.type === 'PolicyWording')
            ));

          if (wordingsError) throw wordingsError;

          addStatusLog(`✓ Retrieved ${previousQuotes?.length || 0} previous quotes and ${previousWordings?.length || 0} previous wordings`, 'success');

          // Build documents array for comparison (previous + new)
          const allDocuments = [
            ...(previousQuotes || []).map(q => ({
              carrier_name: q.insurer_name,
              document_type: 'Quote',
              filename: q.insurer_name,
              document_id: q.document_id
            })),
            ...(previousWordings || []).map(w => ({
              carrier_name: w.insurer_name,
              document_type: 'PolicyWording',
              filename: w.insurer_name,
              document_id: w.document_id
            })),
            {
              carrier_name: classification.carrier || file.name.split('_')[0] || 'Unknown',
              document_type: classification.type,
              filename: file.name,
              document_id: docData.id
            }
          ];

          addStatusLog(`🔄 Re-running comparison with all ${allDocuments.length} documents...`, 'info');

          // Run comprehensive comparison with all data
          const selectedClientData = clients.find(c => c.id === selectedClient);
          const { data: newComparisonData, error: comparisonError } = await supabase.functions.invoke(
            'comprehensive-comparison',
            {
              body: {
                client_name: selectedClientData?.client_name || 'Unknown Client',
                client_ref: `CC-${Date.now()}`,
                industry: selectedClientData?.industry || 'Professional Services',
                jurisdiction: 'UK',
                broker_name: 'CoverCompass',
                priority_metrics: ['Premium(Total)', 'CoverageTrigger', 'Limits', 'Deductible', 'Exclusions'],
                documents: allDocuments,
                selectedSections: selectedSections
              }
            }
          );

          if (comparisonError) throw comparisonError;
          if (!newComparisonData?.analysis) throw new Error('Comparison failed');

          // Update extracted IDs to include the new document
          setExtractedDocumentIds([
            ...extractedDocumentIds,
            {
              documentId: docData.id,
              type: classification.type,
              carrier: classification.carrier || 'Unknown'
            }
          ]);

          // Update comparison data (remove the failed document from the list)
          const updatedAnalysis = {
            ...newComparisonData.analysis,
            failed_documents: (comparisonData.failed_documents || []).filter(
              (fd: any) => fd.filename !== failedDoc.filename
            )
          };

          setComparisonData(updatedAnalysis);
          setRankings(newComparisonData.analysis.comparison_summary || []);
          setScoredRankings(newComparisonData.analysis.comparison_summary || []);

          addStatusLog(`✅ Successfully integrated replacement document`, 'success');

          toast({
            title: "Document Retry Successful",
            description: `${file.name} has been processed and comparison updated`,
          });

        } catch (error: any) {
          console.error('Retry error:', error);
          addStatusLog(`❌ Retry failed: ${error.message}`, 'error');
          toast({
            title: "Retry Failed",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      };
      input.click();
    } catch (error: any) {
      console.error('Retry setup error:', error);
      toast({
        title: "Error",
        description: "Could not initiate retry",
        variant: "destructive",
      });
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
    if (!selectedClient || !comparisonData) {
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

      toast({
        title: "Generating PDF Report",
        description: "Processing with headless browser for print-perfect quality...",
      });

      // Build complete HTML document with embedded styles
      const htmlContent = generateFullHTMLReport(selectedClientData, comparisonData);

      // Call edge function directly to get binary PDF
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('https://ijhiavpjobzfxoirhnux.supabase.co/functions/v1/generate-pdf-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaGlhdnBqb2J6ZnhvaXJobnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTg0ODgsImV4cCI6MjA3MTI3NDQ4OH0.eRjLwH8fCkqaMNnW0R248u213qcBRBLYrc9ZGiAm2Z4'
        },
        body: JSON.stringify({ htmlContent })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Invalid PDF response from server');
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      
      // Download the PDF
      const fileName = `${selectedClientData.client_name.replace(/[^a-z0-9]/gi, '_')}_Quote_Comparison_${new Date().toISOString().split('T')[0]}.pdf`;
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
        description: `High-quality report downloaded as ${fileName}`,
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF Generation Failed",
        description: error.message || "An error occurred while generating the PDF",
        variant: "destructive",
      });
    }
  };

  const generateFullHTMLReport = (selectedClientData: ClientProfile, comparisonData: any): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cover Compass - Policy Comparison Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7f7f7;
            padding: 2rem;
            line-height: 1.6;
        }
        .comparison-card {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border: 1px solid #e5e7eb;
        }
        @media print {
            body {
                background-color: white !important;
                margin: 0;
                padding: 0;
            }
            .comparison-card {
                box-shadow: none !important;
                border: 1px solid #ccc !important;
            }
            .page-break {
                page-break-before: always;
            }
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body class="bg-gray-100">
    <div id="app" class="max-w-6xl mx-auto py-8 px-4 bg-white rounded-xl comparison-card">
        <!-- HEADER SECTION -->
        <header class="mb-10 pb-4 border-b border-gray-200">
            <h1 class="text-3xl font-extrabold text-blue-800">Policy Comparison Report</h1>
            <p class="text-gray-500 mt-1">Generated by Cover Compass | ${selectedClientData.client_name} | Date: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        ${generateProductSections(comparisonData)}

        <!-- FOOTER / NEXT STEPS -->
        <footer class="mt-12 pt-6 border-t border-gray-200">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Disclaimer & Next Steps</h3>
            <p class="text-xs text-gray-500">
                This report is for comparison purposes only. Brokers must always refer to the full policy wording and schedule provided by the insurer.
            </p>
        </footer>
    </div>
</body>
</html>`;
  };



    // Custom component for handling the Image placeholder tag
    const ImagePlaceholder = ({ children }) => {
      const textNode = Array.isArray(children) && children.length > 0 ? children[0] : null;
      const text = textNode && textNode.props ? textNode.props.children : '';
      // FIX: The regex was missing the closing forward slash and pattern components.
      // The corrected regex matches '' and captures the content inside the brackets.
      const diagramTitleMatch = text.match('/\/');

      if (diagramTitleMatch) {
        const diagramTitle = diagramTitleMatch[1];
        const visualHint = diagramTitle.includes('structure comparison') ? (
            <LayoutList className="h-10 w-10 text-indigo-400" />
        ) : (
            <AlertTriangle className="h-10 w-10 text-yellow-400" />
        );

        return (
            <div className="my-8 p-6 bg-indigo-50 border border-indigo-200 rounded-xl shadow-inner flex flex-col items-center justify-center text-center">
              {visualHint}
              <p className="mt-4 text-lg font-semibold text-indigo-800">Visual Placeholder</p>
              <p className="text-sm text-indigo-700 max-w-xl">
                A diagram showing: <strong className="font-bold">{diagramTitle}</strong>
              </p>
              <p className="text-xs text-indigo-600 mt-2">
                (This diagram visually illustrates the capacity difference between separate indemnity towers and a single aggregate limit.)
              </p>
            </div>
        );
      }
      return <p>{children}</p>;
    };

  const generateProductSections = (comparisonData: any): string => {
    if (!comparisonData?.product_level_breakdown || comparisonData.product_level_breakdown.length === 0) {
      return '<p class="text-gray-600">No product-level comparison data available.</p>';
    }

    return comparisonData.product_level_breakdown.map((product: any, idx: number) => {
      const productName = product.product_name || 'Unknown Product';
      const summary = product.summary || '';
      const carriers = product.carriers || [];

      return `
        ${idx > 0 ? '<div class="page-break"></div>' : ''}
        <div class="policy-section mb-12">
            <h2 class="text-2xl font-bold text-gray-800 border-b pb-2 mb-4">${productName}</h2>
            ${summary ? `<p class="text-sm text-gray-600 mb-6 font-medium">${summary}</p>` : ''}

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                ${carriers.map((carrier: any, carrierIdx: number) => {
                  const carrierName = carrier.carrier_name || 'Unknown Carrier';
                  const isRecommended = carrierIdx === 0;
                  const keyTerms = carrier.key_terms || [];
                  const subjectivities = carrier.subjectivities || [];
                  const standoutPoints = carrier.standout_points || [];

                  return `
                    <div class="p-6 rounded-xl bg-white comparison-card">
                        <div class="flex items-center mb-4 border-b pb-3">
                            <span class="text-xl font-extrabold ${isRecommended ? 'text-green-700' : 'text-red-700'} mr-2">${carrierName}</span>
                            <h3 class="text-lg font-semibold text-gray-700">${isRecommended ? "Broker's Choice" : "Alternative Quote"}</h3>
                        </div>
                        
                        ${keyTerms.length > 0 ? `
                          <h4 class="text-base font-bold text-gray-800 mb-2">Key Terms</h4>
                          <ul class="list-none space-y-2 text-sm text-gray-700 pl-0 mb-4">
                              ${keyTerms.map((term: string) => `<li class="pl-2">· ${term}</li>`).join('')}
                          </ul>
                        ` : ''}

                        <div class="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                          <h4 class="text-base font-bold text-amber-900 mb-2 flex items-center">
                            <span class="mr-2">⚠️</span> Subjectivities (Pre-Binding)
                          </h4>
                          ${subjectivities.length > 0 ? `
                            <ul class="list-none space-y-1.5 text-sm text-amber-900 pl-0">
                                ${subjectivities.map((subj: string) => `
                                  <li class="flex items-start">
                                      <span class="text-amber-600 mr-2 font-bold">⚠</span>
                                      <span class="flex-1">${subj}</span>
                                  </li>
                                `).join('')}
                            </ul>
                          ` : `
                            <p class="text-sm text-green-700 flex items-center">
                              <span class="mr-2">✓</span> None - Quote is firm
                            </p>
                          `}
                        </div>

                        ${standoutPoints.length > 0 ? `
                          <h4 class="text-base font-bold text-gray-800 mt-4 mb-2 border-t pt-3">Standout Points</h4>
                          <ul class="list-none space-y-2 text-sm text-gray-700 pl-0">
                              ${standoutPoints.map((point: any) => {
                                const icon = point.sentiment === 'positive' ? '✅' : point.sentiment === 'negative' ? '❌' : '⚠️';
                                const color = point.sentiment === 'positive' ? 'text-green-600' : point.sentiment === 'negative' ? 'text-red-600' : 'text-yellow-600';
                                return `
                                  <li class="flex items-start">
                                      <span class="${color} text-lg mr-2 inline-block">${icon}</span>
                                      <span>${point.text}</span>
                                  </li>
                                `;
                              }).join('')}
                          </ul>
                        ` : ''}
                    </div>
                  `;
                }).join('')}
            </div>
        </div>
      `;
    }).join('');
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
            Upload quotes and compare coverage instantly. CoverCompassAI analyses schedules, limits, clauses, and terms to rank quotes from best to worst.
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

      {/* Coverage Section Selector */}
      {selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Select Coverage Comparison Sections</span>
            </CardTitle>
            <CardDescription>Choose which sections of the quotes and wordings to analyze</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {selectedSections.length} of {coverageSections.length} sections selected
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllSections}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={deselectAllSections}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {coverageSections.map((section) => (
                  <div
                    key={section.key}
                    className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedSections.includes(section.key)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleSection(section.key)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(section.key)}
                      onChange={() => {}} // Handled by div click
                      className="rounded"
                    />
                    <label className="text-sm font-medium cursor-pointer flex-1">
                      {section.label}
                    </label>
                  </div>
                ))}
              </div>
              
              {selectedSections.length === 0 && (
                <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ⚠️ Please select at least one coverage section to compare
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                            {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyse
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
                      ? "CoverCompassAI will analyse your quote for coverage details and recommendations."
                      : `Click "Compare Quotes Instantly" below to analyse coverage, limits, exclusions, and competitiveness across all ${uploadedQuotes.length} quotes.`
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
                    These documents will be analysed alongside quotes for comprehensive coverage comparison.
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
          <CardDescription>CoverCompassAI will analyse coverage, limits, terms, and competitiveness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 border border-border rounded-lg p-3 mb-4">
              <p className="text-xs text-muted-foreground">
                Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
              </p>
            </div>
            
            <Button 
              onClick={analyseQuotes}
              disabled={!selectedClient || (uploadedQuotes.length === 0 && policyWordingDocs.length === 0) || isProcessing}
              size="lg"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                  Analysing Documents...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  {uploadedQuotes.length > 0 && policyWordingDocs.length > 0
                    ? "Compare Quotes & Policy Wordings"
                    : uploadedQuotes.length > 0
                    ? "Compare Quotes Instantly"
                    : "Analyse Policy Wordings"}
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
                  Using CoverCompassAI to analyse schedules, limits, exclusions, enhancements, and core policy wording...
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


      {/* Coverage Comparison Results */}
      {analysisComplete && comparisonData && (
        <>
          {/* Download Comparison Button */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Download Comparison</span>
              </CardTitle>
              <CardDescription>
                Export this comprehensive comparison to review offline or share with your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={async () => {
                  try {
                    toast({
                      title: "Generating PDF",
                      description: "Creating your comparison report...",
                    });

                    const generateHTML = () => {
                      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                      const selectedClientData = clients.find(c => c.id === selectedClient);
                      const clientName = selectedClientData?.client_name || 'Client';
                      
                      const productSectionsHTML = comparisonData.product_comparisons?.map((product, productIdx) => {
                        const carriersHTML = product.carrier_results?.map((carrier, carrierIdx) => {
                          // Build key terms list
                          const keyTermsHTML = carrier.key_terms?.map(term => {
                            return `<li class="pl-2">· ${term}</li>`;
                          }).join('') || '';

                          // Build standout points list
                          const standoutPointsHTML = carrier.standout_points?.map(point => {
                            const emoji = point.includes('✅') ? '✅' : point.includes('❌') ? '❌' : point.includes('⚠️') ? '⚠️' : '📋';
                            const color = point.includes('✅') ? 'text-green-600' : point.includes('❌') ? 'text-red-600' : point.includes('⚠️') ? 'text-yellow-600' : 'text-blue-600';
                            const cleanPoint = point.replace(/^[✅❌⚠️📋]\s*/, '');
                            return `
                              <li class="flex items-start">
                                <span class="${color} text-lg mr-2 inline-block">${emoji}</span>
                                <span>${cleanPoint}</span>
                              </li>
                            `;
                          }).join('') || '';

                          const isFirstCarrier = carrierIdx === 0;
                          const carrierColor = isFirstCarrier ? 'text-green-700' : 'text-red-700';
                          const carrierLabel = isFirstCarrier ? "Broker's Choice" : 'Alternative Quote';

                          return `
                            <div class="p-6 rounded-xl bg-white comparison-card">
                              <div class="flex items-center mb-4 border-b pb-3">
                                <span class="text-xl font-extrabold ${carrierColor} mr-2">${carrier.carrier}</span>
                                <h3 class="text-lg font-semibold text-gray-700">${carrierLabel}</h3>
                              </div>
                              
                              ${keyTermsHTML ? `
                                <h4 class="text-base font-bold text-gray-800 mb-2">Key Terms</h4>
                                <ul class="list-none space-y-2 text-sm text-gray-700 pl-0 mb-4">
                                  ${keyTermsHTML}
                                </ul>
                              ` : ''}

                              ${standoutPointsHTML ? `
                                <h4 className="text-base font-bold text-gray-800 mt-4 mb-2 border-t pt-3">Standout Points</h4>
                                <ul class="list-none space-y-2 text-sm text-gray-700 pl-0">
                                  ${standoutPointsHTML}
                                </ul>
                              ` : ''}
                              
                              ${carrier.standout_summary || carrier.summary ? `
                                <div class="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-4 mt-4">
                                  <h4 class="text-sm font-bold mb-2 text-blue-900">Summary</h4>
                                  <p class="text-sm font-semibold text-gray-800 leading-relaxed">
                                    ${carrier.standout_summary || carrier.summary}
                                  </p>
                                </div>
                              ` : ''}
                            </div>
                          `;
                        }).join('') || '';

                        const summary = product.broker_notes || 'Detailed comparison of policy terms and coverage.';
                        const pageBreak = productIdx > 0 ? '<div class="page-break"></div>' : '';

                        const summarySection = product.broker_notes ? `
                          <div style="margin-top: 2rem; padding: 1rem; background-color: rgba(139, 92, 246, 0.05); border-left: 4px solid rgb(139, 92, 246); border-radius: 0 0.375rem 0.375rem 0;">
                            <h4 style="font-size: 0.875rem; font-weight: 700; color: #1f2937; margin: 0 0 0.5rem 0;">Summary</h4>
                            <p style="font-size: 0.875rem; font-weight: 600; color: #1f2937; margin: 0;">${product.broker_notes}</p>
                          </div>
                        ` : '';

                        return `
                          ${pageBreak}
                          <div class="policy-section mb-12">
                            <h2 class="text-2xl font-bold text-gray-800 border-b pb-2 mb-4">${product.product}</h2>
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              ${carriersHTML}
                            </div>
                            ${summarySection}
                          </div>
                        `;
                      }).join('') || '<p class="text-gray-500">No comparison data available.</p>';

                      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cover Compass - Policy Comparison Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7f7f7;
            padding: 2rem;
            line-height: 1.6;
        }
        .comparison-card {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border: 1px solid #e5e7eb;
        }
        @media print {
            body {
                background-color: white !important;
                margin: 0;
                padding: 0;
            }
            .comparison-card {
                box-shadow: none !important;
                border: 1px solid #ccc !important;
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .policy-section {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .page-break {
                page-break-before: always;
            }
        }
    </style>
</head>
<body class="bg-gray-100">
    <div id="app" class="max-w-6xl mx-auto py-8 px-4 bg-white rounded-xl comparison-card">
        <header class="mb-10 pb-4 border-b border-gray-200">
            <h1 class="text-3xl font-extrabold text-blue-800">Policy Comparison Report</h1>
            <p class="text-gray-500 mt-1">Generated by Cover Compass | Date: ${date}</p>
            <p class="text-gray-700 mt-2 font-semibold">Client: ${clientName}</p>
        </header>

        <div class="mb-6 p-4 bg-blue-50 border-l-4 border-blue-600 rounded">
            <p class="text-xs text-gray-700 text-center">
                <strong>Important Notice:</strong> Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
            </p>
        </div>

        ${productSectionsHTML}

        <div class="mt-6 mb-12 p-4 bg-blue-50 border-l-4 border-blue-600 rounded">
            <p class="text-xs text-gray-700 text-center">
                <strong>Important Notice:</strong> Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
            </p>
        </div>

        <footer class="mt-6 pt-6 border-t border-gray-200">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Disclaimer & Next Steps</h3>
            <p class="text-xs text-gray-500">
                This report is for comparison purposes only. Brokers must always refer to the full policy wording and schedule provided by the insurer.
            </p>
        </footer>
    </div>
</body>
</html>`;
                    };

                    const htmlContent = generateHTML();

                    // Call edge function directly to get binary PDF
                    const { data: sessionData } = await supabase.auth.getSession();
                    const accessToken = sessionData?.session?.access_token;

                    const response = await fetch('https://ijhiavpjobzfxoirhnux.supabase.co/functions/v1/generate-pdf-report', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaGlhdnBqb2J6ZnhvaXJobnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTg0ODgsImV4cCI6MjA3MTI3NDQ4OH0.eRjLwH8fCkqaMNnW0R248u213qcBRBLYrc9ZGiAm2Z4'
                      },
                      body: JSON.stringify({ htmlContent })
                    });

                    if (!response.ok) {
                      const text = await response.text();
                      throw new Error(text || 'Invalid PDF response from server');
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                    
                    // Download the PDF
                    const selectedClientData = clients.find(c => c.id === selectedClient);
                    const clientName = selectedClientData?.client_name || 'Client';
                    const fileName = `${clientName.replace(/[^a-z0-9]/gi, '_')}_Comparison_${new Date().toISOString().split('T')[0]}.pdf`;
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    toast({
                      title: "PDF Downloaded",
                      description: `Report saved as ${fileName}`,
                    });

                  } catch (error) {
                    console.error('PDF generation error:', error);
                    toast({
                      title: "PDF Generation Failed",
                      description: error.message || "Could not generate PDF report",
                      variant: "destructive",
                    });
                  }
                }}
                size="lg"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Comparison Report (PDF)
              </Button>
            </CardContent>
          </Card>

          {/* Document Warnings - Show if any documents failed */}
          {comparisonData.failed_documents && comparisonData.failed_documents.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-amber-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span>Partial Analysis - Some Documents Failed</span>
                </CardTitle>
                <CardDescription className="text-amber-800">
                  The comparison was completed with available data, but some documents could not be processed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-amber-900 font-medium mb-3">
                    Failed to extract data from {comparisonData.failed_documents.length} document{comparisonData.failed_documents.length !== 1 ? 's' : ''}:
                  </p>
                  <ul className="space-y-2">
                    {comparisonData.failed_documents.map((doc: any, idx: number) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm bg-white/60 p-3 rounded border border-amber-200">
                        <X className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium text-amber-900">{doc.filename}</span>
                          <div className="text-xs text-amber-700 mt-1">
                            Type: {doc.type} • Carrier: {doc.carrier}
                          </div>
                        </div>
                        <Button
                          onClick={() => retryFailedDocument(doc)}
                          disabled={isProcessing}
                          size="sm"
                          variant="outline"
                          className="border-amber-300 hover:bg-amber-100 text-amber-900 flex-shrink-0"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Re-upload
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 p-3 bg-white/80 rounded border border-amber-200">
                    <p className="text-xs text-amber-800">
                      <strong>Note:</strong> The comparison below is based on successfully extracted documents only.
                      For a complete analysis, please re-upload the failed documents or contact support if the issue persists.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer - Top of Product Comparisons */}
          {comparisonData.product_comparisons && comparisonData.product_comparisons.length > 0 && (
            <Card className="border-2 border-primary/20 bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground text-center">
                  Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Total Payable & Annual Comparison */}
          {((comparisonData.comparison_summary && comparisonData.comparison_summary.length > 0) || 
            (comparisonData.insurers && comparisonData.insurers.length > 0)) && (
            <Card className="border-2 border-primary">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-background py-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Total Payable & Annual Comparison</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  Total annual premium comparison across all underwriters
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(() => {
                    // Use comparison_summary if available, otherwise build from insurers
                    const summaryItems = comparisonData.comparison_summary && comparisonData.comparison_summary.length > 0
                      ? comparisonData.comparison_summary
                      : (comparisonData.insurers || []).map((ins: any) => ({
                          insurer_name: ins.insurer_name || ins.carrier || 'Unknown',
                          premium_amount: Number(
                            ins.premiums?.total_payable ??
                            ins.premiums?.annual_total ??
                            ins.premiums?.annual_premium ??
                            0
                          ),
                          coverage_score: 0,
                          overall_score: 0,
                        }));

                    return summaryItems
                      .sort((a: any, b: any) => {
                        const aAmount = typeof a.premium_amount === 'string' 
                          ? parseFloat(a.premium_amount.replace(/[^0-9.]/g, '')) || 0
                          : Number(a.premium_amount) || 0;
                        const bAmount = typeof b.premium_amount === 'string'
                          ? parseFloat(b.premium_amount.replace(/[^0-9.]/g, '')) || 0
                          : Number(b.premium_amount) || 0;
                        return aAmount - bAmount;
                      })
                      .map((item: any, idx: number) => {
                        const premiumAmount = typeof item.premium_amount === 'string'
                          ? parseFloat(item.premium_amount.replace(/[^0-9.]/g, '')) || 0
                          : Number(item.premium_amount) || 0;
                        
                        const allPremiums = summaryItems
                          .map((i: any) => {
                            const amt = typeof i.premium_amount === 'string'
                              ? parseFloat(i.premium_amount.replace(/[^0-9.]/g, '')) || 0
                              : Number(i.premium_amount) || 0;
                            return amt;
                          })
                          .filter((amt: number) => amt > 0);
                        
                        const minPremium = allPremiums.length > 0 ? Math.min(...allPremiums) : 0;
                        const isBestValue = premiumAmount > 0 && premiumAmount === minPremium;
                        
                        const insurerInfo = getInsurerInfo(item.insurer_name || item.insurer || 'Unknown');
                        
                        return (
                          <Card 
                            key={idx} 
                            className={`relative overflow-hidden transition-all hover:shadow-md ${
                              isBestValue ? 'border-2 border-green-500 bg-green-50/50' : 'border'
                            }`}
                          >
                            {isBestValue && (
                              <div className="absolute top-1.5 right-1.5">
                                <Badge className="bg-green-600 text-white text-xs px-2 py-0.5">Best Value</Badge>
                              </div>
                            )}
                            <CardContent className="pt-4 pb-3 px-3">
                              <div className="flex items-center space-x-2 mb-3">
                                {insurerInfo.logo ? (
                                  <img 
                                    src={insurerInfo.logo} 
                                    alt={insurerInfo.altText}
                                    className="h-8 w-8 object-contain"
                                  />
                                ) : (
                                  <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center">
                                    <span className="text-xs font-medium text-primary">
                                      {(item.insurer_name || item.insurer || 'UK').substring(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-base">
                                    {item.insurer_name || item.insurer || 'Unknown'}
                                  </h4>
                                </div>
                              </div>
                              
                              <div className="space-y-1.5">
                                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                                  <p className="text-xs text-muted-foreground mb-0.5">Total Annual Premium</p>
                                  <p className="text-2xl font-bold text-primary">
                                    {premiumAmount > 0 ? (
                                      typeof item.premium_amount === 'string' 
                                        ? item.premium_amount 
                                        : `£${premiumAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    ) : (
                                      <span className="text-muted-foreground text-base">Not provided</span>
                                    )}
                                  </p>
                                </div>
                                
                                {item.overall_score > 0 && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Overall Score:</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {Math.round(Number(item.overall_score) || 0)}/100
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      });
                  })()}
                </div>
                
                {/* Summary Stats */}
                {(() => {
                  // Use comparison_summary if available, otherwise build from insurers
                  const summaryItems = comparisonData.comparison_summary && comparisonData.comparison_summary.length > 0
                    ? comparisonData.comparison_summary
                    : (comparisonData.insurers || []).map((ins: any) => ({
                        insurer_name: ins.insurer_name || ins.carrier || 'Unknown',
                        premium_amount: Number(
                          ins.premiums?.total_payable ??
                          ins.premiums?.annual_total ??
                          ins.premiums?.annual_premium ??
                          0
                        ),
                      }));

                  const premiums = summaryItems
                    .map((i: any) => {
                      const amt = typeof i.premium_amount === 'string'
                        ? parseFloat(i.premium_amount.replace(/[^0-9.]/g, '')) || 0
                        : Number(i.premium_amount) || 0;
                      return amt;
                    })
                    .filter((amt: number) => amt > 0);
                  
                  if (premiums.length > 1) {
                    const minPremium = Math.min(...premiums);
                    const maxPremium = Math.max(...premiums);
                    const avgPremium = premiums.reduce((a, b) => a + b, 0) / premiums.length;
                    const saving = maxPremium - minPremium;
                    
                    return (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="bg-muted/30 rounded-lg p-2.5 border">
                          <p className="text-xs text-muted-foreground mb-0.5">Lowest Premium</p>
                          <p className="text-base font-bold text-green-600">
                            £{minPremium.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2.5 border">
                          <p className="text-xs text-muted-foreground mb-0.5">Highest Premium</p>
                          <p className="text-base font-bold text-red-600">
                            £{maxPremium.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2.5 border">
                          <p className="text-xs text-muted-foreground mb-0.5">Average Premium</p>
                          <p className="text-base font-bold">
                            £{avgPremium.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2.5 border border-green-200">
                          <p className="text-xs text-green-700 mb-0.5">Potential Saving</p>
                          <p className="text-base font-bold text-green-700">
                            £{saving.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </CardContent>
            </Card>
          )}

          {/* Product Comparisons - Side by Side Table Format */}
          {comparisonData.product_comparisons && comparisonData.product_comparisons.length > 0 && (
            <div className="space-y-6">
              {comparisonData.product_comparisons.map((product: any, productIdx: number) => {
                const carriers = product.carrier_results || [];
                if (carriers.length === 0) return null;

                return (
                  <Card key={productIdx} className="border-2">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-background">
                      <CardTitle className="text-xl">{product.product}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b-2 border-primary/20">
                              <th className="text-left p-3 bg-muted/30 font-semibold text-sm w-40">Section</th>
                              {carriers.map((carrier: any, idx: number) => {
                                const insurerInfo = getInsurerInfo(carrier.carrier);
                                return (
                                  <th key={idx} className="p-3 bg-muted/30 text-left min-w-[300px]">
                                    <div className="flex items-center space-x-2">
                                      {insurerInfo.logo ? (
                                        <img 
                                          src={insurerInfo.logo} 
                                          alt={insurerInfo.altText}
                                          className="h-8 w-8 object-contain"
                                        />
                                      ) : (
                                        <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center">
                                          <span className="text-xs font-medium text-primary">
                                            {carrier.carrier.substring(0, 2).toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                      <span className="font-semibold">{carrier.carrier}</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Key Terms Row */}
                            <tr className="border-b border-muted">
                              <td className="p-3 align-top bg-muted/10 font-medium text-sm">Key Terms</td>
                              {carriers.map((carrier: any, idx: number) => (
                                <td key={idx} className="p-3 align-top">
                                  {carrier.key_terms && carrier.key_terms.length > 0 ? (
                                    <ul className="space-y-1">
                                      {carrier.key_terms.map((term: string, termIdx: number) => (
                                        <li key={termIdx} className="text-sm flex items-start">
                                          <span className="mr-2 text-primary">•</span>
                                          <span className="flex-1">{term}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Not provided</span>
                                  )}
                                </td>
                              ))}
                            </tr>

                            {/* Subjectivities Row */}
                            <tr className="border-b border-muted">
                              <td className="p-3 align-top bg-muted/10 font-medium text-sm">
                                <div className="flex items-center space-x-1">
                                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                                  <span>Subjectivities</span>
                                </div>
                              </td>
                              {carriers.map((carrier: any, idx: number) => (
                                <td key={idx} className="p-3 align-top">
                                  {carrier.subjectivities !== undefined ? (
                                    carrier.subjectivities && carrier.subjectivities.length > 0 ? (
                                      <ul className="space-y-1.5">
                                        {carrier.subjectivities.map((subj: string, subjIdx: number) => (
                                          <li key={subjIdx} className="text-sm flex items-start">
                                            <span className="text-amber-600 mr-2 font-bold">⚠</span>
                                            <span className="flex-1 text-amber-900">{subj}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span className="text-sm text-green-700 flex items-center">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        None - Quote is firm
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Not provided</span>
                                  )}
                                </td>
                              ))}
                            </tr>

                            {/* Standout Points Row */}
                            <tr>
                              <td className="p-3 align-top bg-muted/10 font-medium text-sm">Standout Points</td>
                              {carriers.map((carrier: any, idx: number) => (
                                <td key={idx} className="p-3 align-top">
                                  {carrier.standout_points && carrier.standout_points.length > 0 ? (
                                    <ul className="space-y-2">
                                      {carrier.standout_points.map((point: string, pointIdx: number) => (
                                        <li key={pointIdx} className="text-sm flex items-start">
                                          <span className="mr-2">
                                            {point.includes('✅') ? '✅' : point.includes('❌') ? '❌' : point.includes('⚠️') ? '⚠️' : '📋'}
                                          </span>
                                          <span className="flex-1">{point.replace(/^[✅❌⚠️📋]\s*/, '')}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Not provided</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Product-level Summary */}
                      {product.broker_notes && (
                        <div className="mt-6 p-4 bg-primary/5 border-l-4 border-primary rounded-r">
                          <h4 className="text-sm font-bold text-foreground mb-2">Overall Summary</h4>
                          <p className="text-sm font-semibold text-foreground">{product.broker_notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Legacy Insurer Cards - kept for backward compatibility */}
          {comparisonData.insurers && comparisonData.insurers.length > 0 && !(comparisonData.product_comparisons) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {comparisonData.insurers.map((insurer: any, index: number) => (
                <Card key={index} className="hover:shadow-xl transition-all duration-300 border-2">
                  <CardHeader className="bg-gradient-to-r from-muted/50 to-background pb-4">
                    <CardTitle className="flex items-center space-x-3">
                      {(() => {
                        const insurerInfo = getInsurerInfo(insurer.carrier);
                        return insurerInfo.logo ? (
                          <img 
                            src={insurerInfo.logo} 
                            alt={insurerInfo.altText}
                            className="h-10 w-10 object-contain"
                          />
                        ) : (
                          <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {insurer.carrier.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        );
                      })()}
                      <span className="text-xl">{insurer.carrier}</span>
                    </CardTitle>
                    {insurer.standout_summary && (
                      <div className="bg-primary/5 border-l-4 border-primary rounded-lg p-4 mt-3">
                        <h5 className="text-sm font-bold mb-2 text-primary">Summary</h5>
                        <p className="text-sm font-semibold text-foreground leading-relaxed">
                          {insurer.standout_summary}
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {/* Quote Metrics */}
                    {insurer.quote_metrics && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center text-green-700">
                          <DollarSign className="h-4 w-4 mr-1" />
                          Quote Details
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="col-span-2 bg-green-50 border border-green-200 rounded p-2">
                            <span className="text-muted-foreground">Total Premium:</span>
                            <p className="font-semibold text-green-900">{insurer.quote_metrics.total_premium || 'Unknown'}</p>
                          </div>
                          <div className="bg-muted/30 rounded p-2">
                            <span className="text-muted-foreground block text-xs">Period:</span>
                            <p className="font-medium text-xs">{insurer.quote_metrics.policy_period || 'Unknown'}</p>
                          </div>
                          <div className="bg-muted/30 rounded p-2">
                            <span className="text-muted-foreground block text-xs">Validity:</span>
                            <p className="font-medium text-xs">{insurer.quote_metrics.quote_validity || 'Unknown'}</p>
                          </div>
                          <div className="bg-muted/30 rounded p-2">
                            <span className="text-muted-foreground block text-xs">Limit:</span>
                            <p className="font-medium text-xs">{insurer.quote_metrics.limit || 'Unknown'}</p>
                          </div>
                          <div className="bg-muted/30 rounded p-2">
                            <span className="text-muted-foreground block text-xs">Deductible:</span>
                            <p className="font-medium text-xs">{insurer.quote_metrics.deductible || 'Unknown'}</p>
                          </div>
                          <div className="col-span-2 bg-muted/30 rounded p-2">
                            <span className="text-muted-foreground block text-xs">Jurisdiction:</span>
                            <p className="font-medium text-xs">{insurer.quote_metrics.jurisdiction || 'Unknown'}</p>
                          </div>
                          {insurer.quote_metrics.retro_date !== 'Unknown' && (
                            <div className="col-span-2 bg-muted/30 rounded p-2">
                              <span className="text-muted-foreground block text-xs">Retro Date:</span>
                              <p className="font-medium text-xs">{insurer.quote_metrics.retro_date}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Wording Highlights */}
                    {insurer.wording_highlights && insurer.wording_highlights.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center text-blue-700">
                          <Shield className="h-4 w-4 mr-1" />
                          Wording Highlights
                        </h4>
                        <ul className="space-y-2">
                          {insurer.wording_highlights.map((highlight: any, idx: number) => (
                            <li key={idx} className="text-sm flex items-start bg-blue-50/50 rounded p-2 border border-blue-100">
                              <span className="mr-2 text-base">{highlight.icon}</span>
                              <span className="flex-1">{highlight.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Subjectivities */}
                    {insurer.subjectivities && insurer.subjectivities.length > 0 && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                        <h4 className="text-sm font-semibold mb-2 flex items-center text-amber-900">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Subjectivities (Pre-Binding)
                        </h4>
                        <ul className="space-y-1.5">
                          {insurer.subjectivities.map((sub: string, idx: number) => (
                            <li key={idx} className="text-sm text-amber-800 flex items-start">
                              <span className="text-amber-600 mr-2 font-bold">⚠</span>
                              <span className="flex-1">{sub}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Quote Comparison Table */}
          {comparisonData.quote_table && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Table className="h-5 w-5 text-green-600" />
                  <span>Quote Comparison Table</span>
                </CardTitle>
                <CardDescription>
                  Side-by-side comparison of all key quote metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {comparisonData.quote_table.columns.map((col: string, idx: number) => (
                          <TableHead key={idx} className={idx === 0 ? "font-semibold w-[150px]" : ""}>
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData.quote_table.rows.map((row: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/50">
                          {comparisonData.quote_table.columns.map((col: string, colIdx: number) => (
                            <TableCell key={colIdx} className={colIdx === 0 ? "font-medium" : "text-sm"}>
                              {colIdx === 0 && (() => {
                                const insurerInfo = getInsurerInfo(row[col]);
                                return (
                                  <div className="flex items-center space-x-2">
                                    {insurerInfo.logo ? (
                                      <img 
                                        src={insurerInfo.logo} 
                                        alt={insurerInfo.altText}
                                        className="h-6 w-6 object-contain"
                                      />
                                    ) : (
                                      <div className="h-6 w-6 bg-primary/10 rounded flex items-center justify-center">
                                        <span className="text-xs font-medium text-primary">
                                          {row[col].substring(0, 2).toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                    <span>{row[col]}</span>
                                  </div>
                                );
                              })()}
                              {colIdx !== 0 && (row[col] || 'Unknown')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall Flags */}
          {comparisonData.overall_flags && comparisonData.overall_flags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Key Differences & Flags</span>
                </CardTitle>
                <CardDescription>
                  Important distinctions to consider
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {comparisonData.overall_flags.map((flag: any, index: number) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border-2 flex items-start space-x-3 ${
                        flag.type === 'Risk' ? 'bg-red-50 border-red-300' :
                        flag.type === 'Advantage' ? 'bg-green-50 border-green-300' :
                        flag.type === 'Unusual Term' ? 'bg-amber-50 border-amber-300' :
                        'bg-blue-50 border-blue-300'
                      }`}
                    >
                      <Badge variant="outline" className="mt-0.5 font-semibold">
                        {flag.type}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-1">{flag.carrier}</p>
                        <p className="text-sm">{flag.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reports */}
          {comparisonData.broker_report_markdown && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Broker Report (Detailed)</span>
                </CardTitle>
                <CardDescription>
                  Full analysis for internal review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: comparisonData.broker_report_markdown.replace(/\n/g, '<br/>') }}
                />
              </CardContent>
            </Card>
          )}

          {comparisonData.client_report_markdown && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span>Client Report (Simplified)</span>
                </CardTitle>
                <CardDescription>
                  Client-ready summary in plain English
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: comparisonData.client_report_markdown.replace(/\n/g, '<br/>') }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Disclaimer - Bottom of New Comparison Format */}
      {analysisComplete && comparisonData && comparisonData.product_comparisons && (
        <Card className="border-2 border-primary/20 bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground text-center">
              Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Legacy Coverage Comparison Results */}
      {analysisComplete && !comparisonData && rankings.length > 0 && (
        <>
          {/* Disclaimer - Top of Legacy Format */}
          <Card className="border-2 border-primary/20 bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground text-center">
                Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
              </p>
            </CardContent>
          </Card>

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

      {/* Disclaimer - Bottom of Legacy Format */}
      {analysisComplete && !comparisonData && rankings.length > 0 && (
        <Card className="border-2 border-primary/20 bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground text-center">
              Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
            </p>
          </CardContent>
        </Card>
      )}
      {analysisComplete && markdownReport && (
          <div className="mt-10 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">

            {/* Action Bar */}
            <div className="flex justify-end mb-6 pr-2">
              <Button
                  variant="outline"
                  className="gap-2 shadow-sm hover:shadow-md transition-all"
                  onClick={handleDownloadPdf}
              >
                <Download className="h-4 w-4" />
                Export to PDF
              </Button>
            </div>

            <div ref={reportRef} className="space-y-6">
              {reportSections.map((section) => (
                  <Card
                      key={section.id}
                      className="w-full shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden"
                  >
                    <CardHeader className="pb-4 pt-5 bg-gradient-to-r from-muted/30 to-white border-b px-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                          <FileText className="h-5 w-5 text-blue-600" />
                          {section.title}
                        </CardTitle>

                        {/* Edit Button — only for summaries, hidden in PDF */}
                        <div className="print:hidden">
                          {editingSectionId === section.id ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                Editing…
                              </div>
                          ) : (
                              !isHideEditIcon &&
                              section.title.toLowerCase().includes("summary") && (
                                  <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditClick(section)}
                                      className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md px-2 py-1"
                                  >
                                    <Pen className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                              )
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-5 pb-6 px-6">
                      {editingSectionId === section.id ? (
                          <div className="space-y-4 print:hidden">
                            <Label className="sr-only">Edit Content</Label>
                            <Textarea
                                value={tempEditContent}
                                onChange={(e) => setTempEditContent(e.target.value)}
                                className="min-h-[220px] font-mono text-sm leading-relaxed border rounded-lg shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder="Edit the section summary here..."
                            />

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelClick}
                                  className="text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                              <Button
                                  size="sm"
                                  onClick={() => handleSaveClick(section.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white shadow"
                              >
                                <Save className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                            </div>
                          </div>
                      ) : (
                          <div className="prose prose-sm max-w-none dark:prose-invert text-slate-700 dark:text-slate-300 leading-relaxed">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                components={{
                                  p: ({ node, ...props }) => (
                                      <p className="mb-3 leading-relaxed" {...props} />
                                  ),
                                  ul: ({ node, ...props }) => (
                                      <ul className="list-disc pl-5 mb-3 space-y-1.5" {...props} />
                                  ),
                                  strong: ({ node, ...props }) => (
                                      <span className="font-semibold text-slate-900 dark:text-slate-100" {...props} />
                                  ),
                                  table: ({ node, ...props }) => (
                                    <div className="overflow-x-auto my-4 border border-gray-200 rounded-lg">
                                      <table {...props} />
                                    </div>
                                  ),
                                  thead: ({ node, ...props }) => (
                                    <thead className="bg-gray-100 border-b text-gray-700 font-semibold" {...props} />
                                  ),
                                  tbody: ({ node, ...props }) => (
                                    <tbody className="border-t border-gray-200" {...props} />
                                  ),
                                  th: ({ node, ...props }) => (
                                    <th className="px-4 py-2 border-b bg-gray-50 text-sm font-semibold text-gray-700" {...props} />
                                  ),
                                  td: ({ node, ...props }) => (
                                    <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-pre-line break-words" {...props} />
                                  ),
                                }}
                            >
                              {section.content}
                            </ReactMarkdown>
                          </div>
                      )}
                    </CardContent>
                  </Card>
              ))}
            </div>
          </div>
      )}

      {/* Policy Wording Comparison Results */}
      {policyWordingIds.length > 0 && (
        <>
          <PolicyWordingComparison policyWordingIds={policyWordingIds} />
          
          {/* Disclaimer - Bottom of Policy Wording Comparison */}
          <Card className="border-2 border-primary/20 bg-muted/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground text-center">
                Produced by CoverCompass AI for comparison purposes only. Not advice or a recommendation. Always verify against original insurer documentation; the original documents prevail. Brokers must always refer to the full policy wording and schedule provided by the insurer.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default InstantQuoteComparison;