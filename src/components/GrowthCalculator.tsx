import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateGrowth, GROWTH_PRESETS, type GrowthInputs } from '@/utils/growth';
import { formatCurrency } from '@/utils/roi';

interface GrowthCalculatorProps {
  currency?: string;
}

export default function GrowthCalculator({ currency = 'GBP' }: GrowthCalculatorProps) {
  const { toast } = useToast();
  const [inputs, setInputs] = useState<GrowthInputs>({
    currentPolicies: 1000,
    avgPremium: 1200,
    commissionRate: 15,
    currentRetention: 85,
    retentionUplift: 5,
    newPoliciesPerMonth: 30,
    currentWinRate: 25,
    efficiencyGain: 30,
    winRateUplift: 10,
    aiUplift: 5,
    horizonYears: 3,
    discountRate: 8,
    currency,
  });

  const outputs = useMemo(() => calculateGrowth(inputs), [inputs]);

  const handleInputChange = (field: keyof GrowthInputs, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: Math.max(0, numValue) }));
  };

  const downloadCsv = () => {
    const rows = [
      ['CoverCompass Growth Calculator - Projection'],
      [''],
      ['INPUTS'],
      ['Current Active Policies', inputs.currentPolicies.toString()],
      ['Avg Annual Premium', formatCurrency(inputs.avgPremium, currency, 0)],
      ['Commission Rate', `${inputs.commissionRate}%`],
      ['Current Annual Retention', `${inputs.currentRetention}%`],
      ['Retention Uplift', `+${inputs.retentionUplift}%`],
      ['New Policies per Month', inputs.newPoliciesPerMonth.toString()],
      ['Current Win Rate', `${inputs.currentWinRate}%`],
      ['Efficiency Gain', `+${inputs.efficiencyGain}%`],
      ['Win Rate Uplift', `+${inputs.winRateUplift}%`],
      ['AI Uplift', `+${inputs.aiUplift}%`],
      ['Horizon Years', inputs.horizonYears.toString()],
      [''],
      ['YEARLY PROJECTIONS'],
      ['Year', 'Baseline Commission', 'CoverCompass Commission', 'Incremental Commission'],
      ...outputs.yearlyData.map((y) => [
        y.year.toString(),
        formatCurrency(y.baselineCommission, currency, 0),
        formatCurrency(y.ccCommission, currency, 0),
        formatCurrency(y.incrementalCommission, currency, 0),
      ]),
    ];

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'covercompass-growth-projection.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Downloaded', description: 'Your growth projection has been downloaded.' });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">CoverCompass Growth Calculator</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Project your book growth and revenue uplift from higher retention, increased new business
          wins, and Attack Intelligence AI.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Inputs Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Book & Economics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPolicies">Current Active Policies</Label>
                <Input
                  id="currentPolicies"
                  type="number"
                  min="1"
                  value={inputs.currentPolicies}
                  onChange={(e) => handleInputChange('currentPolicies', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avgPremium">Avg Annual Premium ({currency})</Label>
                <Input
                  id="avgPremium"
                  type="number"
                  min="0"
                  value={inputs.avgPremium}
                  onChange={(e) => handleInputChange('avgPremium', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                <Input
                  id="commissionRate"
                  type="number"
                  min="0"
                  max="100"
                  value={inputs.commissionRate}
                  onChange={(e) => handleInputChange('commissionRate', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentRetention">Current Annual Retention (%)</Label>
                <Input
                  id="currentRetention"
                  type="number"
                  min="0"
                  max="100"
                  value={inputs.currentRetention}
                  onChange={(e) => handleInputChange('currentRetention', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retentionUplift">Expected Uplift from CoverCompass (%)</Label>
                <Input
                  id="retentionUplift"
                  type="number"
                  min="0"
                  max="20"
                  value={inputs.retentionUplift}
                  onChange={(e) => handleInputChange('retentionUplift', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>New Business Engine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPoliciesPerMonth">Current New Policies per Month</Label>
                <Input
                  id="newPoliciesPerMonth"
                  type="number"
                  min="0"
                  value={inputs.newPoliciesPerMonth}
                  onChange={(e) => handleInputChange('newPoliciesPerMonth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentWinRate">Current Win Rate (%)</Label>
                <Input
                  id="currentWinRate"
                  type="number"
                  min="0"
                  max="100"
                  value={inputs.currentWinRate}
                  onChange={(e) => handleInputChange('currentWinRate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="efficiencyGain">Efficiency Gain (%)</Label>
                <Input
                  id="efficiencyGain"
                  type="number"
                  min="0"
                  value={inputs.efficiencyGain}
                  onChange={(e) => handleInputChange('efficiencyGain', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="winRateUplift">Win Rate Uplift (%)</Label>
                <Input
                  id="winRateUplift"
                  type="number"
                  min="0"
                  value={inputs.winRateUplift}
                  onChange={(e) => handleInputChange('winRateUplift', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aiUplift">Attack Intelligence AI Uplift (%)</Label>
                <Input
                  id="aiUplift"
                  type="number"
                  min="0"
                  value={inputs.aiUplift}
                  onChange={(e) => handleInputChange('aiUplift', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time & Finance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="horizonYears">Projection Horizon (Years)</Label>
                <Input
                  id="horizonYears"
                  type="number"
                  min="1"
                  max="5"
                  value={inputs.horizonYears}
                  onChange={(e) => handleInputChange('horizonYears', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountRate">Discount Rate for NPV (%)</Label>
                <Input
                  id="discountRate"
                  type="number"
                  min="0"
                  value={inputs.discountRate}
                  onChange={(e) => handleInputChange('discountRate', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outputs Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Policies (Year {inputs.horizonYears})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {outputs.ccPoliciesEndYear.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {outputs.baselinePoliciesEndYear.toLocaleString()} baseline
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Annual Commission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(outputs.ccAnnualCommission, currency, 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(outputs.baselineAnnualCommission, currency, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>Incremental Annual Commission (Year {inputs.horizonYears})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">
                {formatCurrency(outputs.incrementalAnnualCommission, currency, 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cumulative Incremental Commission</CardTitle>
              <CardDescription>Over {inputs.horizonYears}-year horizon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Nominal Total</span>
                <span className="font-semibold">
                  {formatCurrency(outputs.cumulativeIncrementalCommission, currency, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">NPV (@ {inputs.discountRate}%)</span>
                <span className="font-semibold">
                  {formatCurrency(outputs.npvIncrementalCommission, currency, 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Policy Growth Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={outputs.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottom', offset: -5 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="baselinePolicies"
                    stroke="hsl(var(--muted-foreground))"
                    name="Baseline"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="ccPolicies"
                    stroke="hsl(var(--primary))"
                    name="With CoverCompass"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
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
