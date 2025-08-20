import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Send, Eye, FileText, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  type: 'shortlist' | 'quote_follow_up' | 'meeting_request';
}

interface EmailHistory {
  id: string;
  client_name: string;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'delivered' | 'opened' | 'failed';
  sent_at: string;
}

const EmailIntegration = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [emailData, setEmailData] = useState({
    to: "",
    subject: "",
    content: "",
    attachments: [] as string[]
  });

  useEffect(() => {
    loadTemplates();
    loadEmailHistory();
  }, []);

  const loadTemplates = () => {
    // Mock templates - in real app these would come from database
    const mockTemplates: EmailTemplate[] = [
      {
        id: "1",
        name: "Insurer Shortlist",
        subject: "Insurance Options for {{client_name}}",
        content: `Dear {{client_name}},

Based on our analysis of your requirements, I'm pleased to present a shortlist of insurance providers that match your needs:

{{insurer_list}}

Each of these insurers has been selected based on:
- Their appetite for your industry sector
- Competitive premium rates
- Strong financial ratings
- Coverage that aligns with your requirements

I'd be happy to discuss these options with you in more detail. Please let me know when you're available for a call.

Best regards,
{{broker_name}}`,
        type: 'shortlist'
      },
      {
        id: "2",
        name: "Quote Follow-up",
        subject: "Follow-up on your insurance quote",
        content: `Dear {{client_name}},

I wanted to follow up on the insurance quote we discussed last week. 

Have you had a chance to review the proposal? I'm here to answer any questions you might have about:
- Coverage details
- Premium structure
- Policy terms and conditions
- Next steps

Please don't hesitate to reach out if you need any clarification.

Best regards,
{{broker_name}}`,
        type: 'quote_follow_up'
      },
      {
        id: "3",
        name: "Meeting Request",
        subject: "Let's discuss your insurance needs",
        content: `Dear {{client_name}},

I hope this message finds you well. I'd like to schedule a brief meeting to discuss your insurance requirements and how we can best serve your needs.

During our meeting, we can cover:
- Your current coverage and any gaps
- Market opportunities and competitive options
- Tailored recommendations for your business

Would you be available for a 30-minute call this week? I'm flexible with timing to accommodate your schedule.

Looking forward to hearing from you.

Best regards,
{{broker_name}}`,
        type: 'meeting_request'
      }
    ];
    
    setTemplates(mockTemplates);
  };

  const loadEmailHistory = () => {
    // Mock email history - in real app this would come from database
    const mockHistory: EmailHistory[] = [
      {
        id: "1",
        client_name: "ABC Corporation",
        recipient_email: "contact@abccorp.com",
        subject: "Insurance Options for ABC Corporation",
        status: 'opened',
        sent_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      },
      {
        id: "2",
        client_name: "XYZ Ltd",
        recipient_email: "info@xyzltd.com",
        subject: "Follow-up on your insurance quote",
        status: 'delivered',
        sent_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
      },
      {
        id: "3",
        client_name: "Tech Startup Inc",
        recipient_email: "ceo@techstartup.com",
        subject: "Let's discuss your insurance needs",
        status: 'sent',
        sent_at: new Date(Date.now() - 259200000).toISOString() // 3 days ago
      }
    ];
    
    setEmailHistory(mockHistory);
  };

  const handleSendEmail = async () => {
    if (!emailData.to || !emailData.subject || !emailData.content) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, this would call an edge function to send the email
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      toast({
        title: "Success",
        description: "Email sent successfully",
      });
      
      setShowComposeDialog(false);
      setEmailData({
        to: "",
        subject: "",
        content: "",
        attachments: []
      });
      
      // Refresh email history
      loadEmailHistory();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEmailData({
        ...emailData,
        subject: template.subject,
        content: template.content
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'opened': return 'bg-green-500';
      case 'delivered': return 'bg-blue-500';
      case 'sent': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'opened': return <Eye className="h-4 w-4" />;
      case 'delivered': return <CheckCircle2 className="h-4 w-4" />;
      case 'sent': return <Clock className="h-4 w-4" />;
      case 'failed': return <FileText className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Integration</h2>
          <p className="text-muted-foreground">Send personalized emails to clients with insurer recommendations</p>
        </div>
        
        <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="h-4 w-4 mr-2" />
              Compose Email
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compose Email</DialogTitle>
              <DialogDescription>
                Send a personalized email to your client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template">Email Template</Label>
                  <Select value={selectedTemplate} onValueChange={(value) => {
                    setSelectedTemplate(value);
                    applyTemplate(value);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="to">To Email Address</Label>
                  <Input
                    id="to"
                    type="email"
                    value={emailData.to}
                    onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                    placeholder="client@company.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  placeholder="Email subject..."
                />
              </div>

              <div>
                <Label htmlFor="content">Message Content</Label>
                <Textarea
                  id="content"
                  value={emailData.content}
                  onChange={(e) => setEmailData({ ...emailData, content: e.target.value })}
                  placeholder="Email content..."
                  rows={12}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use placeholders: {`{{client_name}}`}, {`{{broker_name}}`}, {`{{insurer_list}}`}
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowComposeDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendEmail} disabled={loading}>
                  {loading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Email Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Email Templates</span>
          </CardTitle>
          <CardDescription>Pre-built templates for common email scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <Badge variant="outline" className="w-fit">
                    {template.type.replace('_', ' ')}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {template.subject}
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Email History</span>
          </CardTitle>
          <CardDescription>Track your recent email communications</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailHistory.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="font-medium">{email.client_name}</TableCell>
                  <TableCell>{email.recipient_email}</TableCell>
                  <TableCell className="max-w-xs truncate">{email.subject}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(email.status)}`}></div>
                      <span className="capitalize">{email.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(email.sent_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailIntegration;