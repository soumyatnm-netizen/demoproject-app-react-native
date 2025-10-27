import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AVAILABLE_FEATURES = [
  { id: 'document_processing', name: 'Document Processing' },
  { id: 'quote_comparison', name: 'Quote Comparison' },
  { id: 'market_intelligence', name: 'Market Intelligence' },
  { id: 'placement_tracking', name: 'Placement Tracking' },
  { id: 'underwriter_matching', name: 'Underwriter Matching' },
  { id: 'appetite_guides', name: 'Appetite Guides' },
  { id: 'attack_intelligence', name: 'Attack Intelligence' },
  { id: 'predictive_analytics', name: 'Predictive Analytics' },
  { id: 'api_access', name: 'API Access' },
  { id: 'custom_reporting', name: 'Custom Reporting' },
  { id: 'white_label', name: 'White Label' },
];

const FeaturesManagement = ({ selectedCompanyId }: { selectedCompanyId?: string | null }) => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [features, setFeatures] = useState<any[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId && companies.length > 0) {
      setSelectedCompany(selectedCompanyId);
    }
  }, [selectedCompanyId, companies]);

  useEffect(() => {
    if (selectedCompany) {
      loadFeatures();
      setPendingChanges(new Map()); // Clear pending changes when switching companies
    }
  }, [selectedCompany]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_companies')
        .select('id, name, subscription_tier')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
      
      if (data && data.length > 0) {
        setSelectedCompany(data[0].id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_company_features')
        .select('*')
        .eq('company_id', selectedCompany);

      if (error) throw error;
      setFeatures(data || []);
    } catch (error) {
      console.error('Error loading features:', error);
    }
  };

  const toggleFeature = (featureId: string, enabled: boolean) => {
    // Track the pending change
    setPendingChanges(prev => {
      const newChanges = new Map(prev);
      newChanges.set(featureId, enabled);
      return newChanges;
    });
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    try {
      // Process all pending changes
      for (const [featureId, enabled] of pendingChanges.entries()) {
        const existingFeature = features.find(f => f.feature === featureId);
        
        if (existingFeature) {
          const { error } = await supabase
            .from('broker_company_features')
            .update({ enabled })
            .eq('id', existingFeature.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('broker_company_features')
            .insert({
              company_id: selectedCompany,
              feature: featureId,
              enabled,
            });

          if (error) throw error;
        }
      }

      toast({
        title: "Success",
        description: `${pendingChanges.size} feature${pendingChanges.size > 1 ? 's' : ''} updated successfully`,
      });

      setPendingChanges(new Map());
      loadFeatures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Management</CardTitle>
          <CardDescription>Control which features are available for each client</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Select Company</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCompanyData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">
                  {selectedCompanyData.name}
                </h3>
              </div>

              <div className="space-y-3">
                {AVAILABLE_FEATURES.map((feature) => {
                  const featureRecord = features.find(f => f.feature === feature.id);
                  // Check if there's a pending change, otherwise use current state
                  const hasPendingChange = pendingChanges.has(feature.id);
                  const currentEnabled = featureRecord ? featureRecord.enabled : true;
                  const isEnabled = hasPendingChange ? pendingChanges.get(feature.id)! : currentEnabled;

                  return (
                    <div
                      key={feature.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <Label htmlFor={feature.id}>{feature.name}</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        {isEnabled ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                        {hasPendingChange && (
                          <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">
                            Unsaved
                          </Badge>
                        )}
                        <Switch
                          id={feature.id}
                          checked={isEnabled}
                          onCheckedChange={(checked) => toggleFeature(feature.id, checked)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedCompanyData && pendingChanges.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                  {pendingChanges.size} Unsaved Change{pendingChanges.size > 1 ? 's' : ''}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Click save to apply changes to this client's account
                </span>
              </div>
              <Button 
                onClick={saveChanges} 
                disabled={saving}
                className="ml-4"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeaturesManagement;
