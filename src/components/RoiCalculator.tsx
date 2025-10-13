import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OperationalRoiCalculator from './OperationalRoiCalculator';
import GrowthCalculator from './GrowthCalculator';

interface RoiCalculatorProps {
  currency?: string;
  workHoursPerYear?: number;
}

export default function RoiCalculator({
  currency = 'GBP',
  workHoursPerYear = 1680,
}: RoiCalculatorProps) {
  const [activeTab, setActiveTab] = useState<'operational' | 'growth'>('operational');

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="operational">Operational ROI</TabsTrigger>
            <TabsTrigger value="growth">Growth ROI</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="operational" className="mt-8">
          <OperationalRoiCalculator currency={currency} workHoursPerYear={workHoursPerYear} />
        </TabsContent>

        <TabsContent value="growth" className="mt-8">
          <GrowthCalculator currency={currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
