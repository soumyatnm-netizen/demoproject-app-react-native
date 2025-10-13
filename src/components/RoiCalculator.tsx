import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Mail, TrendingUp, Clock, DollarSign, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  calculateRoi,
  formatCurrency,
  formatHours,
  formatPercent,
  generateCsvData,
  PRESETS,
  type RoiInputs,
} from '@/utils/roi';

interface RoiCalculatorProps {
  currency?: string;
  defaultPlatformCost?: number;
  workHoursPerYear?: number;
}

export default function RoiCalculator({
  currency = 'GBP',
  defaultPlatformCost = 900,
  workHoursPerYear = 1680,
}: RoiCalculatorProps) {
  const { toast } = useToast();
  const [preset, setPreset] = useState<'conservative' | 'typical' | 'aggressive'>('typical');
  const [inputs, setInputs] = useState<RoiInputs>({
    ...PRESETS.typical,
    platformMonthlyCost: defaultPlatformCost,
    workHoursPerYear,
  });

  const outputs = useMemo(() => calculateRoi(inputs), [inputs]);

  useEffect(() => {
    setInputs({ ...PRESETS[preset], platformMonthlyCost: defaultPlatformCost, workHoursPerYear });
  }, [preset, defaultPlatformCost, workHoursPerYear]);

  const handleInputChange = (field: keyof RoiInputs, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: Math.max(0, numValue) }));
  };

  const downloadCsv = () => {
    const csv = generateCsvData(inputs, outputs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'covercompass-roi-calculation.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Downloaded', description: 'Your ROI calculation has been downloaded.' });
  };

  const emailRoi = () => {
    toast({
      title: 'Email ROI',
      description: 'Email functionality coming soon. Download CSV for now.',
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">CoverCompass ROI Calculator</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Calculate your time and cost savings with CoverCompass. See how much you could save by
          automating your insurance comparison workflow.
        </p>
      </div>

      {/* Preset Selector */}
      <div className="flex justify-center">
        <Tabs value={preset} onValueChange={(v) => setPreset(v as typeof preset)} className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conservative">Conservative</TabsTrigger>
            <TabsTrigger value="typical">Typical</TabsTrigger>
            <TabsTrigger value="aggressive">Aggressive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Calculator Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Inputs Section */}
        <Card>
          <CardHeader>
            <CardTitle>Your Current Process</CardTitle>
            <CardDescription>Adjust the values to match your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="employees">Employees on Task</Label>
              <Input
                id="employees"
                type="number"
                min="1"
                value={inputs.employees}
                onChange={(e) => handleInputChange('employees', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="policiesPerMonth">Policies per Month</Label>
              <Input
                id="policiesPerMonth"
                type="number"
                min="1"
                value={inputs.policiesPerMonth}
                onChange={(e) => handleInputChange('policiesPerMonth', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualTimeMin">Manual Time per Policy (minutes)</Label>
              <Input
                id="manualTimeMin"
                type="number"
                min="0"
                value={inputs.manualTimeMin}
                onChange={(e) => handleInputChange('manualTimeMin', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ccTimeMin">Time with CoverCompass (minutes)</Label>
              <Input
                id="ccTimeMin"
                type="number"
                min="0"
                value={inputs.ccTimeMin}
                onChange={(e) => handleInputChange('ccTimeMin', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="annualSalary">Average Annual Salary ({currency})</Label>
              <Input
                id="annualSalary"
                type="number"
                min="0"
                value={inputs.annualSalary}
                onChange={(e) => handleInputChange('annualSalary', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformMonthlyCost">Platform Monthly Cost ({currency})</Label>
              <Input
                id="platformMonthlyCost"
                type="number"
                min="0"
                value={inputs.platformMonthlyCost}
                onChange={(e) => handleInputChange('platformMonthlyCost', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Outputs Section */}
        <div className="space-y-4">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Annual Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{formatCurrency(outputs.annualSavings, currency)}</p>
              <p className="text-sm opacity-90 mt-2">
                {formatCurrency(outputs.netMonthlySavings, currency)} per month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-secondary text-secondary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Saved Annually
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{formatHours(outputs.annualTimeSavedHrs)}</p>
              <p className="text-sm opacity-90 mt-2">
                {formatHours(outputs.monthlyTimeSavedHrs)} per month
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatPercent(outputs.roiPercent)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payback Period</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {outputs.paybackMonths ? `${outputs.paybackMonths.toFixed(1)} mo` : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Monthly Labour Cost</span>
                <span className="font-semibold">
                  {formatCurrency(outputs.currentMonthlyLabourCost, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CoverCompass Monthly Labour Cost</span>
                <span className="font-semibold">
                  {formatCurrency(outputs.ccMonthlyLabourCost, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Cost</span>
                <span className="font-semibold">
                  {formatCurrency(outputs.platformMonthlyCost, currency)}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Net Monthly Savings</span>
                <span className="text-primary">
                  {formatCurrency(outputs.netMonthlySavings, currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Button onClick={downloadCsv} variant="outline" size="lg">
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
        <Button onClick={emailRoi} variant="outline" size="lg">
          <Mail className="h-4 w-4 mr-2" />
          Email Me This ROI
        </Button>
        <Button size="lg">
          <Zap className="h-4 w-4 mr-2" />
          Compare Plans
        </Button>
      </div>
    </div>
  );
}
