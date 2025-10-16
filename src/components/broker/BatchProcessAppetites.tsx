import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProcessingResult {
  id: string;
  underwriter_name: string;
  status: 'success' | 'failed';
  error?: string;
}

export const BatchProcessAppetites = () => {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; processed: number; failed: number } | null>(null);
  const { toast } = useToast();

  const handleBatchProcess = async () => {
    try {
      setProcessing(true);
      setResults([]);
      setSummary(null);

      toast({
        title: "Processing Started",
        description: "Analyzing all appetite guides with AI...",
      });

      const { data, error } = await supabase.functions.invoke('batch-process-appetites', {
        body: {}
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Batch processing failed');
      }

      setResults(data.results || []);
      setSummary({
        total: data.total || 0,
        processed: data.processed || 0,
        failed: data.failed || 0
      });

      toast({
        title: "Processing Complete",
        description: `Successfully processed ${data.processed} appetite guide(s)`,
      });

    } catch (error) {
      console.error('Batch processing error:', error);
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to process appetite guides",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Appetite Intelligence Scanner
        </CardTitle>
        <CardDescription>
          Batch process all uploaded appetite guides to extract comprehensive intelligence for carrier matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="font-medium mb-2 text-sm">What this does:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Scans all uploaded appetite guide PDFs with AI</li>
            <li>• Extracts coverage types, limits, jurisdictions, and exclusions</li>
            <li>• Identifies target industries and risk appetite levels</li>
            <li>• Captures security requirements and placement notes</li>
            <li>• Powers intelligent carrier matching for your clients</li>
          </ul>
        </div>

        <Button 
          onClick={handleBatchProcess} 
          disabled={processing}
          className="w-full"
          size="lg"
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Appetite Guides...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Scan & Extract All Appetite Intelligence
            </>
          )}
        </Button>

        {processing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Analyzing appetite guides...</span>
            </div>
            <Progress value={undefined} className="h-2" />
          </div>
        )}

        {summary && (
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-xs text-muted-foreground">Total Guides</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{summary.processed}</div>
                  <div className="text-xs text-muted-foreground">Processed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Processing Results:</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div 
                  key={result.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {result.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{result.underwriter_name}</p>
                      {result.error && (
                        <p className="text-xs text-red-600">{result.error}</p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant={result.status === 'success' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {result.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {!processing && results.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Click the button above to scan all appetite guides</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
