import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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

interface OperationalRoiCalculatorProps {
  currency?: string;
  workHoursPerYear?: number;
}

export default function OperationalRoiCalculator({
  currency = 'GBP',
  workHoursPerYear = 1680,
}: OperationalRoiCalculatorProps) {
  const { toast } = useToast();
  const [inputs, setInputs] = useState<RoiInputs>({
    ...PRESETS.typical,
    workHoursPerYear,
  });

  const outputs = useMemo(() => calculateRoi(inputs), [inputs]);

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
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">Operational ROI Calculator</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Calculate your operational time and cost savings with CoverCompass. See the efficiency gains
          from automating your insurance comparison workflow.
        </p>
      </div>

      {/* Main Calculator Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Inputs Section */}
        <Card>
          <CardHeader>
            <CardTitle>Your Current Process</CardTitle>
            <CardDescription>Adjust the values to match your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="employees" className="text-sm">Brokers on Task</Label>
              <Input
                id="employees"
                type="number"
                min="1"
                value={inputs.employees}
                onChange={(e) => handleInputChange('employees', e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="policiesPerMonth" className="text-sm">Policies per Month</Label>
              <Input
                id="policiesPerMonth"
                type="number"
                min="1"
                value={inputs.policiesPerMonth}
                onChange={(e) => handleInputChange('policiesPerMonth', e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="manualTimeMin" className="text-sm">Manual Time per Policy (minutes)</Label>
              <Input
                id="manualTimeMin"
                type="number"
                min="0"
                value={inputs.manualTimeMin}
                onChange={(e) => handleInputChange('manualTimeMin', e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ccTimeMin" className="text-sm">Time with CoverCompass (minutes)</Label>
              <Input
                id="ccTimeMin"
                type="number"
                min="0"
                value={inputs.ccTimeMin}
                onChange={(e) => handleInputChange('ccTimeMin', e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="annualSalary" className="text-sm">Average Annual Salary ({currency})</Label>
              <Input
                id="annualSalary"
                type="number"
                min="0"
                value={inputs.annualSalary}
                onChange={(e) => handleInputChange('annualSalary', e.target.value)}
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Outputs Section */}
        <div className="space-y-3">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Annual Operational Savings
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <p className="text-3xl font-bold">{formatCurrency(outputs.annualOperationalSavings, currency, 0)}</p>
              <p className="text-xs opacity-90 mt-1">
                {formatCurrency(outputs.monthlyOperationalSavings, currency, 0)} per month
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
            <CardContent className="py-4">
              <p className="text-3xl font-bold">{formatHours(outputs.annualTimeSavedHrs)}</p>
              <p className="text-xs opacity-90 mt-1">
                {formatHours(outputs.monthlyTimeSavedHrs)} per month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ROI % (Cost Reduction)</CardTitle>
              <CardDescription className="text-xs">
                Percentage reduction in operational costs vs current manual process
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-primary">{formatPercent(outputs.roiPercent)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operational Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Monthly Operational Cost</span>
                <span className="font-semibold">
                  {formatCurrency(outputs.currentMonthlyOperationalCost, currency, 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">With CoverCompass Monthly Operational Cost</span>
                <span className="font-semibold">
                  {formatCurrency(outputs.ccMonthlyOperationalCost, currency, 0)}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Monthly Operational Savings</span>
                <span className="text-primary">
                  {formatCurrency(outputs.monthlyOperationalSavings, currency, 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {outputs.monthlyOperationalSavings === 0 && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardContent className="pt-6">
                <p className="text-sm text-center text-muted-foreground">
                  No operational savings with current assumptions. Try adjusting the time values.
                </p>
              </CardContent>
            </Card>
          )}
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
