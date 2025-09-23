import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Shield, Lock, FileText, Eye } from "lucide-react";

export const SecurityReport = () => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Enhanced Security Implementation</h2>
        <p className="text-muted-foreground">
          Comprehensive PII data protection with encryption and audit logging
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Encryption */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Lock className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">Encryption</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Data in Transit</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                TLS 1.2+
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Data at Rest</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                AES-256
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Client-side Encryption</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                AES-GCM
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              • TLS 1.2+ enforced for all data transmission
              • Supabase provides automatic AES-256 encryption at rest
              • Additional client-side encryption layer available
            </p>
          </CardContent>
        </Card>

        {/* Audit Logging */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Eye className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">Audit Logging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">File Operations</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">PII Data Access</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">User Authentication</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              • All file uploads, downloads, and processing logged
              • PII access with consent tracking and risk scoring
              • Complete audit trail for security compliance
            </p>
          </CardContent>
        </Card>

        {/* Security Headers */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Shield className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">Security Headers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">HSTS</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">CSP</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">XSS Protection</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              • Strict-Transport-Security with HSTS preload
              • Content Security Policy prevents XSS attacks
              • X-Frame-Options prevents clickjacking
            </p>
          </CardContent>
        </Card>

        {/* Compliance Features */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <FileText className="h-5 w-5 text-primary mr-2" />
            <CardTitle className="text-lg">Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">GDPR Ready</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Compliant
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Data Consent</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Tracked
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Audit Trail</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              • User consent management for PII access
              • Complete audit trails for compliance reporting
              • Automatic data retention policies
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="text-lg text-green-800">Security Implementation Complete</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>✅ Encryption:</strong> TLS 1.2+ for transit, AES-256 for storage (Supabase managed)
            </p>
            <p className="text-sm">
              <strong>✅ Audit Logging:</strong> Comprehensive logging for all file operations and PII access
            </p>
            <p className="text-sm">
              <strong>✅ Security Headers:</strong> HSTS, CSP, XSS protection, and frame options configured
            </p>
            <p className="text-sm">
              <strong>✅ Compliance:</strong> GDPR-ready with consent management and audit trails
            </p>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> All security measures are automatically applied. File uploads now include 
              enhanced audit logging, and PII data access is tracked with consent management for compliance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};