import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, XCircle, AlertTriangle, Shield, FileText, Crown, Scale, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PolicyWording {
  id: string;
  insurer_name: string;
  policy_version: string | null;
  policy_date: string | null;
  insured_name: string | null;
  policy_period: string | null;
  jurisdiction: string | null;
  coverage_sections: any;
  key_variables: any;
  emerging_risks: any;
  services: any;
  plain_language_summary: any;
}

interface PolicyWordingComparisonProps {
  policyWordingIds: string[];
}

const PolicyWordingComparison = ({ policyWordingIds }: PolicyWordingComparisonProps) => {
  const [policyWordings, setPolicyWordings] = useState<PolicyWording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicyWordings();
  }, [policyWordingIds]);

  const fetchPolicyWordings = async () => {
    if (policyWordingIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('policy_wordings')
        .select('*')
        .in('id', policyWordingIds);

      if (error) throw error;
      setPolicyWordings(data || []);
    } catch (error) {
      console.error('Error fetching policy wordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompletenessScore = (wording: PolicyWording): number => {
    let score = 0;
    const maxScore = 100;
    
    // Policy basics (20 points)
    if (wording.plain_language_summary?.policy?.carrier) score += 5;
    if (wording.plain_language_summary?.policy?.product) score += 5;
    if (wording.plain_language_summary?.policy?.jurisdiction) score += 5;
    if (wording.plain_language_summary?.policy?.territory) score += 5;
    
    // Structure (30 points)
    const structure = wording.plain_language_summary?.structure || {};
    if (structure.claims_basis) score += 10;
    if (structure.limits?.length > 0) score += 10;
    if (structure.deductibles?.length > 0) score += 10;
    
    // Terms (30 points)
    const terms = wording.plain_language_summary?.terms || {};
    if (terms.exclusions?.length > 0) score += 10;
    if (terms.conditions?.length > 0) score += 10;
    if (terms.notable_terms?.length > 0) score += 10;
    
    // Additional content (20 points)
    if (wording.plain_language_summary?.definitions?.length > 0) score += 10;
    if (wording.plain_language_summary?.citations?.length > 0) score += 10;
    
    return Math.min(score, maxScore);
  };

  const getBestPolicy = (): PolicyWording | null => {
    if (policyWordings.length === 0) return null;
    return policyWordings.reduce((best, current) => 
      getCompletenessScore(current) > getCompletenessScore(best) ? current : best
    );
  };

  const findCommonExclusions = (): string[] => {
    if (policyWordings.length < 2) return [];
    
    const exclusionSets = policyWordings.map(pw => 
      new Set(
        ((pw.plain_language_summary?.terms?.exclusions as string[]) || [])
          .map(e => e.toLowerCase())
      )
    );
    
    const common = Array.from(exclusionSets[0]).filter(exclusion =>
      exclusionSets.every(set => set.has(exclusion))
    );
    
    return common.map(e => {
      const exclusionsList = policyWordings[0].plain_language_summary?.terms?.exclusions as string[] | undefined;
      const found = exclusionsList?.find((ex: string) => ex.toLowerCase() === e);
      return found || String(e);
    });
  };

  const findUniqueExclusions = (wording: PolicyWording): string[] => {
    if (policyWordings.length < 2) return [];
    
    const thisExclusionsList = (wording.plain_language_summary?.terms?.exclusions as string[]) || [];
    const thisExclusions = new Set(thisExclusionsList.map(e => e.toLowerCase()));
    
    const otherExclusions = new Set(
      policyWordings
        .filter(pw => pw.id !== wording.id)
        .flatMap(pw => (pw.plain_language_summary?.terms?.exclusions as string[]) || [])
        .map(e => e.toLowerCase())
    );
    
    return Array.from(thisExclusions)
      .filter(e => !otherExclusions.has(e))
      .map(e => {
        const found = thisExclusionsList.find((ex: string) => ex.toLowerCase() === e);
        return found || String(e);
      });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <span className="animate-spin text-2xl">⚙️</span>
            <span className="ml-2">Loading policy wording comparison...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (policyWordings.length === 0) {
    return null;
  }

  const bestPolicy = getBestPolicy();
  const commonExclusions = findCommonExclusions();

  return (
    <div className="space-y-6">
      {/* Key Insights Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span>Policy Wording Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-background/50 rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground mb-1">Most Comprehensive</div>
              <div className="font-semibold text-lg">{bestPolicy?.insurer_name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Completeness Score: {getCompletenessScore(bestPolicy!)}%
              </div>
            </div>
            <div className="bg-background/50 rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground mb-1">Policies Analysed</div>
              <div className="font-semibold text-lg">{policyWordings.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {policyWordings.map(pw => pw.insurer_name).join(', ')}
              </div>
            </div>
            <div className="bg-background/50 rounded-lg p-4 border">
              <div className="text-sm text-muted-foreground mb-1">Common Exclusions</div>
              <div className="font-semibold text-lg">{commonExclusions.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Found across all policies
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policy Overview Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Policy Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Policy Details</TableHead>
                {policyWordings.map((pw) => (
                  <TableHead key={pw.id} className="text-center">
                    <div className="space-y-1">
                      <div className="font-semibold">{pw.insurer_name}</div>
                      {pw.id === bestPolicy?.id && (
                        <Badge variant="default" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Most Complete
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Product Name</TableCell>
                {policyWordings.map((pw) => (
                  <TableCell key={pw.id} className="text-center">
                    {pw.plain_language_summary?.policy?.product || 'N/A'}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Form/Version</TableCell>
                {policyWordings.map((pw) => (
                  <TableCell key={pw.id} className="text-center">
                    {pw.plain_language_summary?.policy?.form_number || 
                     pw.plain_language_summary?.policy?.version || 'N/A'}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Territory</TableCell>
                {policyWordings.map((pw) => (
                  <TableCell key={pw.id} className="text-center">
                    {pw.plain_language_summary?.policy?.territory || 'N/A'}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Jurisdiction</TableCell>
                {policyWordings.map((pw) => (
                  <TableCell key={pw.id} className="text-center">
                    {pw.plain_language_summary?.policy?.jurisdiction || 'N/A'}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Claims Basis</TableCell>
                {policyWordings.map((pw) => {
                  const claimsBasis = pw.plain_language_summary?.structure?.claims_basis;
                  const isClaimsMade = claimsBasis?.claims_made === true;
                  const isOccurrence = claimsBasis?.occurrence === true;
                  return (
                    <TableCell key={pw.id} className="text-center">
                      <Badge variant={isClaimsMade ? "default" : "secondary"}>
                        {isClaimsMade ? 'Claims Made' : isOccurrence ? 'Occurrence' : 'Unknown'}
                      </Badge>
                      {claimsBasis?.retro_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Retro: {claimsBasis.retro_date}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Coverage Limits Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Coverage Limits & Sublimits</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Main Limits */}
            <div>
              <h4 className="font-medium mb-3">Primary Limits of Liability</h4>
              <div className="grid gap-4">
                {policyWordings.map((pw) => (
                  <Card key={pw.id} className="bg-muted/30">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{pw.insurer_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-3">
                      {pw.plain_language_summary?.structure?.limits?.length > 0 ? (
                        <div className="space-y-2">
                          {pw.plain_language_summary.structure.limits.map((limit: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{limit.name}</span>
                              <Badge variant="outline" className="font-mono">
                                {limit.amount}
                                {limit.aggregate && ` (${limit.aggregate})`}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No limits specified</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Sublimits */}
            {policyWordings.some(pw => pw.plain_language_summary?.structure?.sublimits?.length > 0) && (
              <div>
                <h4 className="font-medium mb-3">Sublimits</h4>
                <div className="grid gap-4">
                  {policyWordings.map((pw) => (
                    <Card key={pw.id} className="bg-muted/30">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">{pw.insurer_name}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-3">
                        {pw.plain_language_summary?.structure?.sublimits?.length > 0 ? (
                          <div className="space-y-2">
                            {pw.plain_language_summary.structure.sublimits.map((sublimit: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{sublimit.name}</span>
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {sublimit.amount}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No sublimits</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Deductibles */}
            {policyWordings.some(pw => pw.plain_language_summary?.structure?.deductibles?.length > 0) && (
              <div>
                <h4 className="font-medium mb-3">Deductibles</h4>
                <div className="grid gap-4">
                  {policyWordings.map((pw) => (
                    <Card key={pw.id} className="bg-muted/30">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">{pw.insurer_name}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-3">
                        {pw.plain_language_summary?.structure?.deductibles?.length > 0 ? (
                          <div className="space-y-2">
                            {pw.plain_language_summary.structure.deductibles.map((deductible: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{deductible.name}</span>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {deductible.amount}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No deductibles specified</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exclusions Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span>Exclusions Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Common Exclusions */}
            {commonExclusions.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <Scale className="h-4 w-4 mr-2" />
                  Common Exclusions (All Policies)
                </h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <ul className="space-y-1 text-sm">
                    {commonExclusions.map((exclusion, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-yellow-600 mr-2">•</span>
                        <span>{exclusion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Unique Exclusions */}
            <div>
              <h4 className="font-medium mb-3">Policy-Specific Exclusions</h4>
              <div className="grid gap-4">
                {policyWordings.map((pw) => {
                  const uniqueExclusions = findUniqueExclusions(pw);
                  return (
                    <Card key={pw.id} className="bg-red-50/50 border-red-200">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center">
                          <XCircle className="h-4 w-4 mr-2 text-red-600" />
                          {pw.insurer_name}
                          {uniqueExclusions.length > 0 && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              {uniqueExclusions.length} unique
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-3">
                        {uniqueExclusions.length > 0 ? (
                          <ul className="space-y-1 text-sm">
                            {uniqueExclusions.map((exclusion, idx) => (
                              <li key={idx} className="flex items-start">
                                <AlertTriangle className="h-3 w-3 mr-2 mt-0.5 text-red-600 flex-shrink-0" />
                                <span>{exclusion}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No unique exclusions - same as other policies
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Terms */}
      <Accordion type="multiple" className="w-full">
        <AccordionItem value="conditions">
          <AccordionTrigger>
            <span className="flex items-center">
              <BookOpen className="h-4 w-4 mr-2" />
              Policy Conditions & Warranties
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4">
              {policyWordings.map((pw) => (
                <Card key={pw.id}>
                  <CardHeader>
                    <CardTitle className="text-sm">{pw.insurer_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pw.plain_language_summary?.terms?.conditions?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-sm mb-2">Conditions</h5>
                        <ul className="space-y-1 text-sm">
                          {pw.plain_language_summary.terms.conditions.map((condition: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                              <span>{condition}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {pw.plain_language_summary?.terms?.warranties?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-sm mb-2">Warranties</h5>
                        <ul className="space-y-1 text-sm">
                          {pw.plain_language_summary.terms.warranties.map((warranty: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <AlertTriangle className="h-3 w-3 mr-2 mt-0.5 text-yellow-600 flex-shrink-0" />
                              <span>{warranty}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="definitions">
          <AccordionTrigger>
            <span className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Key Definitions
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4">
              {policyWordings.map((pw) => (
                <Card key={pw.id}>
                  <CardHeader>
                    <CardTitle className="text-sm">{pw.insurer_name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pw.plain_language_summary?.definitions?.length > 0 ? (
                      <div className="space-y-3">
                        {pw.plain_language_summary.definitions.slice(0, 5).map((def: any, idx: number) => (
                          <div key={idx} className="border-l-2 border-primary pl-3">
                            <div className="font-medium text-sm">{def.term}</div>
                            <div className="text-sm text-muted-foreground mt-1">{def.definition}</div>
                          </div>
                        ))}
                        {pw.plain_language_summary.definitions.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            +{pw.plain_language_summary.definitions.length - 5} more definitions
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No definitions extracted</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Broker Recommendations */}
      <Card className="bg-gradient-to-br from-blue-50 to-background border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-900">
            <CheckCircle className="h-5 w-5" />
            <span>Broker Analysis Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-white/50 rounded-lg p-4 border">
              <h4 className="font-medium text-sm text-blue-900 mb-2">Most Comprehensive Policy</h4>
              <p className="text-sm text-blue-800">
                <strong>{bestPolicy?.insurer_name}</strong> provides the most detailed policy wording with a 
                completeness score of <strong>{getCompletenessScore(bestPolicy!)}%</strong>. This includes 
                comprehensive limits, clear definitions, and well-documented terms.
              </p>
            </div>
            
            {commonExclusions.length > 0 && (
              <div className="bg-white/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm text-blue-900 mb-2">Standard Industry Exclusions</h4>
                <p className="text-sm text-blue-800">
                  All policies share <strong>{commonExclusions.length} common exclusions</strong>, which represent 
                  standard industry practice. Review policy-specific exclusions carefully for unique coverage gaps.
                </p>
              </div>
            )}
            
            <div className="bg-white/50 rounded-lg p-4 border">
              <h4 className="font-medium text-sm text-blue-900 mb-2">Recommendation</h4>
              <p className="text-sm text-blue-800">
                Review the policy-specific exclusions and sublimits carefully. Consider your client's specific 
                risk profile when choosing between these policies. The claims basis and retroactive dates are 
                particularly important for claims-made policies.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyWordingComparison;