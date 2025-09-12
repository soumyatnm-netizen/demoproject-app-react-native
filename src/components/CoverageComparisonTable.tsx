import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, AlertTriangle, Crown } from "lucide-react";
import { getInsurerInfo } from "@/lib/insurers";

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

interface CoverageComparisonTableProps {
  rankings: QuoteRanking[];
}

// Helper function to format coverage limits
const formatCoverageLimit = (limit: any) => {
  if (!limit || limit === null) return "Not Covered";
  if (typeof limit === 'number') {
    if (limit >= 1000000) {
      return `£${(limit / 1000000).toFixed(1)}M`;
    } else if (limit >= 1000) {
      return `£${(limit / 1000).toFixed(0)}K`;
    } else {
      return `£${limit.toLocaleString()}`;
    }
  }
  return limit.toString();
};

// Helper function to determine best coverage for each type
const getBestCoverageInsurer = (rankings: QuoteRanking[], coverageType: string) => {
  // This would be enhanced with actual quote data - for now using mock logic
  // In real implementation, we'd fetch the actual structured_quotes data
  return rankings[0]?.insurer_name || "N/A";
};

const CoverageComparisonTable = ({ rankings }: CoverageComparisonTableProps) => {
  // Mock coverage data - in real implementation, this would come from structured_quotes
  const mockCoverageData = rankings.map((ranking) => ({
    ...ranking,
    professional_indemnity: ranking.rank_position === 1 ? "£2M" : ranking.rank_position === 2 ? "£1M" : "Not Covered",
    public_liability: "£1M",
    employers_liability: "£10M",
    cyber_data: ranking.rank_position <= 2 ? "£500K" : "Basic Cover",
    product_liability: ranking.rank_position === 1 ? "£2M" : "£1M"
  }));

  const coverageTypes = [
    { key: 'professional_indemnity', label: 'Professional Indemnity', icon: Shield },
    { key: 'public_liability', label: 'Public Liability', icon: Shield },
    { key: 'employers_liability', label: 'Employers Liability', icon: Shield },
    { key: 'cyber_data', label: 'Cyber & Data Protection', icon: Shield },
    { key: 'product_liability', label: 'Product Liability', icon: Shield }
  ];

  const getBestForCoverage = (coverageKey: string) => {
    const sortedByLimit = mockCoverageData.sort((a, b) => {
      const aValue = a[coverageKey as keyof typeof a];
      const bValue = b[coverageKey as keyof typeof b];
      
      // Simple comparison - in real implementation would parse limits properly
      if (aValue === "Not Covered") return 1;
      if (bValue === "Not Covered") return -1;
      return 0;
    });
    return sortedByLimit[0];
  };

  return (
    <div className="space-y-6">
      {/* Coverage Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coverageTypes.map((coverage) => {
          const bestInsurer = getBestForCoverage(coverage.key);
          const Icon = coverage.icon;
          
          return (
            <div key={coverage.key} className="bg-gradient-to-br from-primary/5 to-background border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Icon className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm">{coverage.label}</h4>
              </div>
               <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Best Coverage:</span>
                  <div className="flex items-center space-x-1">
                    {(() => {
                      const insurerInfo = getInsurerInfo(bestInsurer?.insurer_name || "");
                      return insurerInfo.logo ? (
                        <img 
                          src={insurerInfo.logo} 
                          alt={insurerInfo.altText}
                          className="h-4 w-4 object-contain rounded"
                        />
                      ) : null;
                    })()}
                    <Badge variant="outline" className="text-xs">
                      <Crown className="h-3 w-3 mr-1" />
                      {bestInsurer?.insurer_name}
                    </Badge>
                  </div>
                </div>
                <div className="text-lg font-bold text-primary">
                  {bestInsurer?.[coverage.key as keyof typeof bestInsurer] || "N/A"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Comparison Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Insurer</TableHead>
              <TableHead className="text-center">Premium</TableHead>
              <TableHead className="text-center">Professional Indemnity</TableHead>
              <TableHead className="text-center">Public Liability</TableHead>
              <TableHead className="text-center">Employers Liability</TableHead>
              <TableHead className="text-center">Cyber & Data</TableHead>
              <TableHead className="text-center">Overall Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockCoverageData.map((quote, index) => (
              <TableRow key={quote.quote_id} className={index === 0 ? "bg-primary/5" : ""}>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {index === 0 && <Crown className="h-4 w-4 text-yellow-500" />}
                    <div className="flex items-center space-x-3">
                      {/* Insurer Logo */}
                      {(() => {
                        const insurerInfo = getInsurerInfo(quote.insurer_name);
                        return insurerInfo.logo ? (
                          <img 
                            src={insurerInfo.logo} 
                            alt={insurerInfo.altText}
                            className="h-8 w-8 object-contain rounded"
                          />
                        ) : (
                          <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {quote.insurer_name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        );
                      })()}
                      <div>
                        <div className="font-medium">{quote.insurer_name}</div>
                        <Badge 
                          variant={index === 0 ? "default" : "secondary"} 
                          className="text-xs"
                        >
                          Rank #{quote.rank_position}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center font-medium">
                  £{quote.premium_amount?.toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                    quote.professional_indemnity === "Not Covered" 
                      ? "bg-red-50 text-red-700" 
                      : "bg-green-50 text-green-700"
                  }`}>
                    {quote.professional_indemnity === "Not Covered" ? (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {quote.professional_indemnity}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {quote.public_liability}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {quote.employers_liability}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                    quote.cyber_data === "Basic Cover" 
                      ? "bg-yellow-50 text-yellow-700" 
                      : "bg-green-50 text-green-700"
                  }`}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {quote.cyber_data}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="font-semibold text-primary">
                    {quote.overall_score}%
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2 flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Best Value for Money
          </h4>
          <p className="text-sm text-green-700">
            <strong>{rankings[0]?.insurer_name}</strong> offers the best combination of coverage and price at £{rankings[0]?.premium_amount?.toLocaleString()}.
          </p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center">
            <Shield className="h-4 w-4 mr-2" />
            Coverage Recommendation
          </h4>
          <p className="text-sm text-blue-700">
            For your business type, ensure Professional Indemnity and Cyber coverage are adequately covered.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CoverageComparisonTable;