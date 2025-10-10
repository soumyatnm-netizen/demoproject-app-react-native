import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, XCircle, AlertTriangle, Shield, FileText } from "lucide-react";
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

  const getCoverageIcon = (covered: boolean | string) => {
    if (covered === true || covered === 'Yes') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (covered === 'Partial') {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <span className="animate-spin text-2xl">⚙️</span>
            <span className="ml-2">Loading policy comparison...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (policyWordings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Policy Wording Comparison</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Overview Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Document Overview</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insurer</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Policy Date</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Policy Period</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policyWordings.map((pw) => (
                    <TableRow key={pw.id}>
                      <TableCell className="font-medium">{pw.insurer_name}</TableCell>
                      <TableCell>{pw.policy_version || 'N/A'}</TableCell>
                      <TableCell>{pw.policy_date || 'N/A'}</TableCell>
                      <TableCell>{pw.jurisdiction || 'N/A'}</TableCell>
                      <TableCell>{pw.policy_period || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Plain Language Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Quick Coverage Summary</h3>
              <div className="grid gap-4">
                {policyWordings.map((pw) => (
                  <Card key={pw.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{pw.insurer_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pw.plain_language_summary?.gdpr_fines_covered && (
                        <div className="flex items-start space-x-2">
                          {getCoverageIcon(pw.plain_language_summary.gdpr_fines_covered.answer)}
                          <div>
                            <span className="font-medium">GDPR Fines: </span>
                            <span>{pw.plain_language_summary.gdpr_fines_covered.answer}</span>
                            {pw.plain_language_summary.gdpr_fines_covered.details && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {pw.plain_language_summary.gdpr_fines_covered.details}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {pw.plain_language_summary?.ransomware_payments && (
                        <div className="flex items-start space-x-2">
                          {getCoverageIcon(pw.plain_language_summary.ransomware_payments.answer)}
                          <div>
                            <span className="font-medium">Ransomware Payments: </span>
                            <span>{pw.plain_language_summary.ransomware_payments.answer}</span>
                            {pw.plain_language_summary.ransomware_payments.sublimit && (
                              <Badge variant="secondary" className="ml-2">
                                {pw.plain_language_summary.ransomware_payments.sublimit}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {pw.plain_language_summary?.ai_claims && (
                        <div className="flex items-start space-x-2">
                          {getCoverageIcon(pw.plain_language_summary.ai_claims.answer)}
                          <div>
                            <span className="font-medium">AI-related Claims: </span>
                            <span>{pw.plain_language_summary.ai_claims.answer}</span>
                            {pw.plain_language_summary.ai_claims.details && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {pw.plain_language_summary.ai_claims.details}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Detailed Coverage Comparison */}
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="coverage">
                <AccordionTrigger>
                  <span className="flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Core Coverage Sections
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coverage Type</TableHead>
                        {policyWordings.map((pw) => (
                          <TableHead key={pw.id}>{pw.insurer_name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Professional Indemnity</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            <div className="flex items-center space-x-2">
                              {getCoverageIcon(pw.coverage_sections?.professional_indemnity?.covered)}
                              <span className="text-sm">
                                {pw.coverage_sections?.professional_indemnity?.limit || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Cyber & Data Liability</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            <div className="flex items-center space-x-2">
                              {getCoverageIcon(pw.coverage_sections?.cyber_data_liability?.covered)}
                              <span className="text-sm">
                                {pw.coverage_sections?.cyber_data_liability?.limit || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Crime & Fraud</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            <div className="flex items-center space-x-2">
                              {getCoverageIcon(pw.coverage_sections?.crime_fraud?.covered)}
                              <span className="text-sm">
                                {pw.coverage_sections?.crime_fraud?.limit || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Technology/Media/IP</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            <div className="flex items-center space-x-2">
                              {getCoverageIcon(pw.coverage_sections?.technology_media_ip?.covered)}
                              <span className="text-sm">
                                {pw.coverage_sections?.technology_media_ip?.limit || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="emerging-risks">
                <AccordionTrigger>
                  <span className="flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Emerging Risks
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {policyWordings.map((pw) => (
                      <Card key={pw.id}>
                        <CardHeader>
                          <CardTitle className="text-sm">{pw.insurer_name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {pw.emerging_risks?.ai_ml_liability && (
                            <div className="flex items-start space-x-2">
                              {getCoverageIcon(pw.emerging_risks.ai_ml_liability.covered)}
                              <div>
                                <span className="font-medium text-sm">AI/ML Liability: </span>
                                <span className="text-sm">{pw.emerging_risks.ai_ml_liability.details || 'Not specified'}</span>
                              </div>
                            </div>
                          )}
                          {pw.emerging_risks?.cloud_services_failures && (
                            <div className="flex items-start space-x-2">
                              {getCoverageIcon(pw.emerging_risks.cloud_services_failures.covered)}
                              <div>
                                <span className="font-medium text-sm">Cloud Services: </span>
                                <span className="text-sm">{pw.emerging_risks.cloud_services_failures.details || 'Not specified'}</span>
                              </div>
                            </div>
                          )}
                          {pw.emerging_risks?.cryptocurrency_blockchain && (
                            <div className="flex items-start space-x-2">
                              {getCoverageIcon(pw.emerging_risks.cryptocurrency_blockchain.covered)}
                              <div>
                                <span className="font-medium text-sm">Cryptocurrency/Blockchain: </span>
                                <span className="text-sm">{pw.emerging_risks.cryptocurrency_blockchain.details || 'Not specified'}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="key-variables">
                <AccordionTrigger>
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Key Policy Variables
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variable</TableHead>
                        {policyWordings.map((pw) => (
                          <TableHead key={pw.id}>{pw.insurer_name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Coverage Trigger</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            {pw.key_variables?.coverage_trigger || 'N/A'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Limit of Indemnity</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            {pw.key_variables?.limit_of_indemnity_overall || 'N/A'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Limit Type</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            {pw.key_variables?.limit_type || 'N/A'}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Retroactive Date</TableCell>
                        {policyWordings.map((pw) => (
                          <TableCell key={pw.id}>
                            {pw.key_variables?.retroactive_date || 'N/A'}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyWordingComparison;