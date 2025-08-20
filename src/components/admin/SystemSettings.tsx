import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Mail, Database, Lock, Bell, Globe } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SystemSettings = () => {
  const [settings, setSettings] = useState({
    // Email Settings
    emailEnabled: true,
    smtpServer: "smtp.gmail.com",
    smtpPort: "587",
    emailUsername: "",
    emailPassword: "",
    
    // Processing Settings
    autoProcessing: true,
    maxFileSize: "10",
    supportedFormats: "pdf,doc,docx",
    aiModel: "gpt-4",
    
    // Security Settings
    mfaEnabled: false,
    sessionTimeout: "60",
    passwordPolicy: "strong",
    
    // Notification Settings
    adminNotifications: true,
    brokerNotifications: true,
    clientNotifications: false,
    
    // System Settings
    maintenanceMode: false,
    backupFrequency: "daily",
    logRetention: "30"
  });

  const { toast } = useToast();

  const handleSave = async () => {
    try {
      // In a real implementation, this would save to the database
      toast({
        title: "Success",
        description: "System settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update system settings",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    // Reset to default values
    setSettings({
      emailEnabled: true,
      smtpServer: "smtp.gmail.com",
      smtpPort: "587",
      emailUsername: "",
      emailPassword: "",
      autoProcessing: true,
      maxFileSize: "10",
      supportedFormats: "pdf,doc,docx",
      aiModel: "gpt-4",
      mfaEnabled: false,
      sessionTimeout: "60",
      passwordPolicy: "strong",
      adminNotifications: true,
      brokerNotifications: true,
      clientNotifications: false,
      maintenanceMode: false,
      backupFrequency: "daily",
      logRetention: "30"
    });
    
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to defaults",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Settings</h2>
        <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Email Configuration</span>
            </CardTitle>
            <CardDescription>Configure SMTP settings for system emails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={settings.emailEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, emailEnabled: checked })}
              />
              <Label>Enable Email Notifications</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtpServer">SMTP Server</Label>
                <Input
                  id="smtpServer"
                  value={settings.smtpServer}
                  onChange={(e) => setSettings({ ...settings, smtpServer: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emailUsername">Username</Label>
                <Input
                  id="emailUsername"
                  type="email"
                  value={settings.emailUsername}
                  onChange={(e) => setSettings({ ...settings, emailUsername: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="emailPassword">Password</Label>
                <Input
                  id="emailPassword"
                  type="password"
                  value={settings.emailPassword}
                  onChange={(e) => setSettings({ ...settings, emailPassword: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Document Processing</span>
            </CardTitle>
            <CardDescription>Configure PDF processing and AI extraction settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={settings.autoProcessing}
                onCheckedChange={(checked) => setSettings({ ...settings, autoProcessing: checked })}
              />
              <Label>Enable Automatic Processing</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
                <Input
                  id="maxFileSize"
                  type="number"
                  value={settings.maxFileSize}
                  onChange={(e) => setSettings({ ...settings, maxFileSize: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="aiModel">AI Model</Label>
                <Select value={settings.aiModel} onValueChange={(value) => setSettings({ ...settings, aiModel: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="supportedFormats">Supported File Formats</Label>
              <Input
                id="supportedFormats"
                value={settings.supportedFormats}
                onChange={(e) => setSettings({ ...settings, supportedFormats: e.target.value })}
                placeholder="pdf,doc,docx,txt"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5" />
              <span>Security & Authentication</span>
            </CardTitle>
            <CardDescription>Configure security policies and authentication settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={settings.mfaEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, mfaEnabled: checked })}
              />
              <Label>Enable Multi-Factor Authentication</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="passwordPolicy">Password Policy</Label>
                <Select value={settings.passwordPolicy} onValueChange={(value) => setSettings({ ...settings, passwordPolicy: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic (8+ characters)</SelectItem>
                    <SelectItem value="strong">Strong (12+ chars, mixed case, numbers)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (16+ chars, special chars)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notification Settings</span>
            </CardTitle>
            <CardDescription>Configure notification preferences for different user types</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.adminNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, adminNotifications: checked })}
                />
                <Label>Admin Notifications</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.brokerNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, brokerNotifications: checked })}
                />
                <Label>Broker Notifications</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.clientNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, clientNotifications: checked })}
                />
                <Label>Client Notifications</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>System Maintenance</span>
            </CardTitle>
            <CardDescription>System backup, logging, and maintenance settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
              />
              <Label>Maintenance Mode</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="backupFrequency">Backup Frequency</Label>
                <Select value={settings.backupFrequency} onValueChange={(value) => setSettings({ ...settings, backupFrequency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="logRetention">Log Retention (days)</Label>
                <Input
                  id="logRetention"
                  type="number"
                  value={settings.logRetention}
                  onChange={(e) => setSettings({ ...settings, logRetention: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
        <Button onClick={handleSave}>
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default SystemSettings;