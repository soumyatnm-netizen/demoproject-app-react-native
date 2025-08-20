import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText, Target, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import UnderwriterRecommendations from "./UnderwriterRecommendations";

interface StructuredQuote {
  id: string;
  insurer_name: string;
  product_type: string;
  premium_amount: number;
  industry: string;
  revenue_band: string;
  coverage_limits: any;
  created_at: string;
}

interface DocumentProcessingSuccessProps {
  quote: StructuredQuote;
  onClose: () => void;
  onViewRecommendations: () => void;
}

const DocumentProcessingSuccess = ({ quote, onClose, onViewRecommendations }: DocumentProcessingSuccessProps) => {
  const [showRecommendations, setShowRecommendations] = useState(false);

  if (showRecommendations) {
    return (
      <UnderwriterRecommendations 
        quote={quote} 
        onClose={() => setShowRecommendations(false)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Card */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-green-800">Document Processed Successfully!</CardTitle>
              <CardDescription className="text-green-600">
                AI has extracted key data from your client's policy document
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Policy Details</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Product: {quote.product_type || 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">
                Premium: £{quote.premium_amount?.toLocaleString() || 'N/A'}
              </p>
            </div>
            
            <div className="bg-white/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Client Profile</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Industry: {quote.industry || 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">
                Size: {quote.revenue_band || 'N/A'}
              </p>
            </div>
            
            <div className="bg-white/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Next Steps</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Ready for underwriter matching
              </p>
              <Badge variant="secondary" className="text-xs mt-1">
                AI Analysis Complete
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation CTA */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Get Underwriter Recommendations
                </h3>
                <p className="text-muted-foreground">
                  See which underwriters would be best matched for your client using live market data and recent placements
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => setShowRecommendations(true)} className="flex items-center gap-2">
                View Recommendations
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center p-4">
          <div className="text-2xl font-bold text-primary">5+</div>
          <div className="text-xs text-muted-foreground">Potential Matches</div>
        </Card>
        <Card className="text-center p-4">
          <div className="text-2xl font-bold text-green-600">A+</div>
          <div className="text-xs text-muted-foreground">Top Rated Available</div>
        </Card>
        <Card className="text-center p-4">
          <div className="text-2xl font-bold text-amber-600">85%</div>
          <div className="text-xs text-muted-foreground">Avg Match Score</div>
        </Card>
        <Card className="text-center p-4">
          <div className="text-2xl font-bold text-blue-600">Live</div>
          <div className="text-xs text-muted-foreground">Market Data</div>
        </Card>
      </div>
    </div>
  );
};

export default DocumentProcessingSuccess;