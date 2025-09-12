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

// Main scoring function
const calculateOverallScore = (rankings: QuoteRanking[], mockCoverageData: any[]): QuoteRanking[] => {
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
    
    return {
      ...ranking,
      overall_score: Math.max(1, Math.min(100, totalScore)), // Ensure score is between 1-100
      coverage_score: Math.round(coverageScore * (100/60)), // Scale coverage to 100 for display
      competitiveness_score: Math.round(priceScore * (100/40)) // Scale price to 100 for display
    };
  });
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

  // Calculate real scores based on coverage and pricing
  const scoredRankings = calculateOverallScore(rankings, mockCoverageData);
  
  // Sort by overall score (highest first)
  const sortedRankings = [...scoredRankings].sort((a, b) => b.overall_score - a.overall_score);
  
  // Update mock data to match sorted order
  const sortedMockData = sortedRankings.map((ranking) => {
    const originalIndex = rankings.findIndex(r => r.quote_id === ranking.quote_id);
    return mockCoverageData[originalIndex];
  });

  const coverageTypes = [
    { key: 'professional_indemnity', label: 'Professional Indemnity', icon: Shield },
    { key: 'public_liability', label: 'Public Liability', icon: Shield },
    { key: 'employers_liability', label: 'Employers Liability', icon: Shield },
    { key: 'cyber_data', label: 'Cyber & Data Protection', icon: Shield },
    { key: 'product_liability', label: 'Product Liability', icon: Shield }
  ];

  const getBestForCoverage = (coverageKey: string) => {
    const sortedByLimit = sortedMockData.sort((a, b) => {
      const aValue = parseCoverageLimit(a[coverageKey as keyof typeof a] as string);
      const bValue = parseCoverageLimit(b[coverageKey as keyof typeof b] as string);
      return bValue - aValue; // Highest coverage first
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
            {sortedRankings.map((quote, index) => {
              const coverageData = sortedMockData[index];
              return (
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
                            Rank #{index + 1}
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
                      coverageData.professional_indemnity === "Not Covered" 
                        ? "bg-red-50 text-red-700" 
                        : "bg-green-50 text-green-700"
                    }`}>
                      {coverageData.professional_indemnity === "Not Covered" ? (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      {coverageData.professional_indemnity}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {coverageData.public_liability}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {coverageData.employers_liability}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      coverageData.cyber_data === "Basic Cover" 
                        ? "bg-yellow-50 text-yellow-700" 
                        : "bg-green-50 text-green-700"
                    }`}>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {coverageData.cyber_data}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={`font-semibold ${
                      quote.overall_score >= 80 ? "text-green-600" :
                      quote.overall_score >= 70 ? "text-blue-600" :
                      quote.overall_score >= 60 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {quote.overall_score}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Coverage: {quote.coverage_score}% | Price: {quote.competitiveness_score}%
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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
            <strong>{sortedRankings[0]?.insurer_name}</strong> offers the best combination of coverage and price at £{sortedRankings[0]?.premium_amount?.toLocaleString()} 
            with an overall score of {sortedRankings[0]?.overall_score}%.
          </p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center">
            <Shield className="h-4 w-4 mr-2" />
            Coverage Analysis
          </h4>
          <p className="text-sm text-blue-700">
            Scoring considers coverage limits (60%) and pricing competitiveness (40%). 
            {sortedRankings.filter(r => r.overall_score >= 80).length > 0 ? 
              `${sortedRankings.filter(r => r.overall_score >= 80).length} quote${sortedRankings.filter(r => r.overall_score >= 80).length > 1 ? 's' : ''} scored 80%+ overall.` :
              "Consider quotes with higher professional indemnity and cyber coverage."
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default CoverageComparisonTable;