import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Download, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateGrowth, type GrowthInputs } from '@/utils/growth';
import { formatCurrency, formatPercent } from '@/utils/roi';

interface GrowthCalculatorProps {
  currency?: string;
}

export default function GrowthCalculator({ currency = 'GBP' }: GrowthCalculatorProps) {
  const { toast } = useToast();
  const [showMonetary, setShowMonetary] = useState(false);
  const [inputs, setInputs] = useState<GrowthInputs>({
    currentPolicies: 1000,
    avgPremium: 1200,
    currentRetention: 85,
    retentionUplift: 5,
    newPoliciesPerMonth: 120,
    currentWinRate: 25,
    efficiencyGain: 30,
    winRateUplift: 10,
    aiUplift: 5,
    horizonYears: 3,
    currency,
  });

  const outputs = useMemo(() => calculateGrowth(inputs), [inputs]);

  const handleInputChange = (field: keyof GrowthInputs, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: Math.max(0, numValue) }));
  };

  const downloadCsv = () => {
    const rows = [
      ['CoverCompass Growth ROI Calculator - Business Impact'],
      [''],
      ['INPUTS'],
      ['Current Active Policies', inputs.currentPolicies.toString()],
      ['Avg Annual Premium', formatCurrency(inputs.avgPremium, currency, 0)],
      ['Current Annual Retention', `${inputs.currentRetention}%`],
      ['Retention Uplift', `+${inputs.retentionUplift}%`],
      ['New Policy Attempts per Month', inputs.newPoliciesPerMonth.toString()],
      ['Current Win Rate', `${inputs.currentWinRate}%`],
      ['Efficiency Gain', `+${inputs.efficiencyGain}%`],
      ['Win Rate Uplift', `+${inputs.winRateUplift}%`],
      ['AI Uplift', `+${inputs.aiUplift}%`],
      ['Horizon Years', inputs.horizonYears.toString()],
      [''],
      ['YEARLY PROJECTIONS'],
      ['Year', 'Baseline Policies', 'CoverCompass Policies', 'Baseline GWP', 'CoverCompass GWP'],
      ...outputs.yearlyData.map((y) => [
        y.year.toString(),
        y.baselinePolicies.toString(),
        y.ccPolicies.toString(),
        formatCurrency(y.baselineGwp, currency, 0),
        formatCurrency(y.ccGwp, currency, 0),
      ]),
    ];

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'covercompass-growth-roi.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Downloaded', description: 'Your growth projection has been downloaded.' });
  };

  const noUplift =
    inputs.retentionUplift === 0 &&
    inputs.efficiencyGain === 0 &&
    inputs.winRateUplift === 0 &&
    inputs.aiUplift === 0;

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">Growth ROI Calculator</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Project your policy book growth from higher retention and increased new business wins using
          CoverCompass's Attack Intelligence AI.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Inputs Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Book Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="currentPolicies" className="text-sm">Current Active Policies</Label>
                <Input
                  id="currentPolicies"
                  type="number"
                  min="1"
                  value={inputs.currentPolicies}
                  onChange={(e) => handleInputChange('currentPolicies', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="avgPremium" className="text-sm">Avg Annual Premium ({currency})</Label>
                <Input
                  id="avgPremium"
                  type="number"
                  min="0"
                  value={inputs.avgPremium}
                  onChange={(e) => handleInputChange('avgPremium', e.target.value)}
                  className="h-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="currentRetention" className="text-sm">Current Annual Retention (%)</Label>
                <Input
                  id="currentRetention"
                  type="number"
                  min="0"
                  max="100"
                  value={inputs.currentRetention}
                  onChange={(e) => handleInputChange('currentRetention', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="retentionUplift" className="text-sm">Retention Uplift (%)</Label>
                <Input
                  id="retentionUplift"
                  type="number"
                  min="0"
                  max="20"
                  value={inputs.retentionUplift}
                  onChange={(e) => handleInputChange('retentionUplift', e.target.value)}
                  className="h-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">New Business Engine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="newPoliciesPerMonth" className="text-sm">New Policy Attempts per Month</Label>
                <Input
                  id="newPoliciesPerMonth"
                  type="number"
                  min="0"
                  value={inputs.newPoliciesPerMonth}
                  onChange={(e) => handleInputChange('newPoliciesPerMonth', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="currentWinRate" className="text-sm">Current Win Rate (%)</Label>
                <Input
                  id="currentWinRate"
                  type="number"
                  min="0"
                  max="100"
                  value={inputs.currentWinRate}
                  onChange={(e) => handleInputChange('currentWinRate', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="efficiencyGain" className="text-sm">Efficiency Gain (%)</Label>
                <Input
                  id="efficiencyGain"
                  type="number"
                  min="0"
                  value={inputs.efficiencyGain}
                  onChange={(e) => handleInputChange('efficiencyGain', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="winRateUplift" className="text-sm">Win Rate Uplift (%)</Label>
                <Input
                  id="winRateUplift"
                  type="number"
                  min="0"
                  value={inputs.winRateUplift}
                  onChange={(e) => handleInputChange('winRateUplift', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aiUplift" className="text-sm">Attack Intelligence AI Uplift (%)</Label>
                <Input
                  id="aiUplift"
                  type="number"
                  min="0"
                  value={inputs.aiUplift}
                  onChange={(e) => handleInputChange('aiUplift', e.target.value)}
                  className="h-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Projection Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="horizonYears" className="text-sm">Horizon (Years)</Label>
                <Input
                  id="horizonYears"
                  type="number"
                  min="1"
                  max="5"
                  value={inputs.horizonYears}
                  onChange={(e) => handleInputChange('horizonYears', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showMonetary" className="text-sm">Show Monetary Impact (GWP)</Label>
                <Switch
                  id="showMonetary"
                  checked={showMonetary}
                  onCheckedChange={setShowMonetary}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outputs Section */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Policies (Year {inputs.horizonYears})
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <p className="text-xl font-bold text-primary">
                  {outputs.ccPoliciesEndYear.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  vs {outputs.baselinePoliciesEndYear.toLocaleString()} baseline
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Incremental Policies</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <p className="text-xl font-bold text-primary">
                  +{outputs.incrementalPolicies.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPercent(outputs.roiPoliciesPercent)} growth
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Growth ROI % (Policies)</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <p className="text-3xl font-bold">{formatPercent(outputs.roiPoliciesPercent)}</p>
            </CardContent>
          </Card>

          {showMonetary && (
            <>
              <Card className="bg-secondary text-secondary-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Incremental GWP (Year {inputs.horizonYears})
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-4">
                  <p className="text-2xl font-bold">
                    {formatCurrency(outputs.incrementalGwp, currency, 0)}
                  </p>
                  <p className="text-xs opacity-90 mt-1">
                    {formatPercent(outputs.roiGwpPercent)} growth
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">GWP Breakdown (Year {inputs.horizonYears})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 py-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Baseline GWP</span>
                    <span className="font-semibold">
                      {formatCurrency(outputs.baselineGwp, currency, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">With CoverCompass GWP</span>
                    <span className="font-semibold">
                      {formatCurrency(outputs.ccGwp, currency, 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {noUplift && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-center text-muted-foreground">
                  No uplift configured. Adjust retention, efficiency, win rate, or AI uplift values.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center">
        <Button onClick={downloadCsv} variant="outline" size="lg">
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </div>
    </div>
  );
}
