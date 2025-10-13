/**
 * ROI Calculator Utility Functions
 * Authoritative formulas for CoverCompass ROI calculations
 */

export const WORK_HOURS_PER_YEAR = 1680;

export interface RoiInputs {
  employees: number;
  policiesPerMonth: number;
  manualTimeMin: number;
  ccTimeMin: number;
  annualSalary: number;
  platformMonthlyCost: number;
  workHoursPerYear?: number;
}

export interface RoiOutputs {
  monthlyOperations: number;
  currentMonthlyLabourCost: number;
  ccMonthlyLabourCost: number;
  platformMonthlyCost: number;
  monthlyTimeSavedHrs: number;
  annualTimeSavedHrs: number;
  netMonthlySavings: number;
  annualSavings: number;
  roiPercent: number;
  paybackMonths: number | null;
}

export function calculateRoi(inputs: RoiInputs): RoiOutputs {
  const {
    employees,
    policiesPerMonth,
    manualTimeMin,
    ccTimeMin,
    annualSalary,
    platformMonthlyCost,
    workHoursPerYear = WORK_HOURS_PER_YEAR,
  } = inputs;

  // Convert minutes to hours
  const tManualHr = manualTimeMin / 60;
  const tCcHr = ccTimeMin / 60;
  const deltaHr = Math.max(0, tManualHr - tCcHr);

  // Calculate hourly rate
  const hourlyRate = annualSalary / workHoursPerYear;

  // Time savings
  const timeSavedMonth = policiesPerMonth * deltaHr;
  const timeSavedYear = timeSavedMonth * 12;

  // Labour costs
  const labourCurrentMonth = policiesPerMonth * tManualHr * hourlyRate * employees;
  const labourCcMonth = policiesPerMonth * tCcHr * hourlyRate * employees;

  // Savings calculations
  const savingsMonth = Math.max(0, labourCurrentMonth - (labourCcMonth + platformMonthlyCost));
  const savingsYear = savingsMonth * 12;

  // ROI and payback
  const totalPlatformCostYear = platformMonthlyCost * 12;
  const roiPercent = totalPlatformCostYear === 0 ? 0 : (savingsYear / totalPlatformCostYear) * 100;
  const paybackMonths = savingsMonth <= 0 ? null : platformMonthlyCost / savingsMonth;

  return {
    monthlyOperations: policiesPerMonth,
    currentMonthlyLabourCost: labourCurrentMonth,
    ccMonthlyLabourCost: labourCcMonth,
    platformMonthlyCost,
    monthlyTimeSavedHrs: timeSavedMonth,
    annualTimeSavedHrs: timeSavedYear,
    netMonthlySavings: savingsMonth,
    annualSavings: savingsYear,
    roiPercent,
    paybackMonths,
  };
}

export function formatCurrency(value: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatHours(hours: number): string {
  return `${hours.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export const PRESETS = {
  conservative: {
    employees: 1,
    policiesPerMonth: 80,
    manualTimeMin: 15,
    ccTimeMin: 10,
    annualSalary: 40000,
    platformMonthlyCost: 900,
  },
  typical: {
    employees: 2,
    policiesPerMonth: 120,
    manualTimeMin: 20,
    ccTimeMin: 8,
    annualSalary: 45000,
    platformMonthlyCost: 900,
  },
  aggressive: {
    employees: 3,
    policiesPerMonth: 200,
    manualTimeMin: 25,
    ccTimeMin: 7,
    annualSalary: 50000,
    platformMonthlyCost: 900,
  },
};

export function generateCsvData(inputs: RoiInputs, outputs: RoiOutputs): string {
  const rows = [
    ['CoverCompass ROI Calculator Results'],
    [''],
    ['INPUTS'],
    ['Employees on Task', inputs.employees.toString()],
    ['Policies per Month', inputs.policiesPerMonth.toString()],
    ['Manual Time per Policy (min)', inputs.manualTimeMin.toString()],
    ['Time with CoverCompass (min)', inputs.ccTimeMin.toString()],
    ['Average Annual Salary', formatCurrency(inputs.annualSalary)],
    ['Platform Monthly Cost', formatCurrency(inputs.platformMonthlyCost)],
    [''],
    ['OUTPUTS'],
    ['Monthly Operations', outputs.monthlyOperations.toString()],
    ['Current Monthly Labour Cost', formatCurrency(outputs.currentMonthlyLabourCost)],
    ['CoverCompass Monthly Labour Cost', formatCurrency(outputs.ccMonthlyLabourCost)],
    ['Platform Monthly Cost', formatCurrency(outputs.platformMonthlyCost)],
    ['Monthly Time Saved', formatHours(outputs.monthlyTimeSavedHrs)],
    ['Annual Time Saved', formatHours(outputs.annualTimeSavedHrs)],
    ['Net Monthly Savings', formatCurrency(outputs.netMonthlySavings)],
    ['Annual Savings', formatCurrency(outputs.annualSavings)],
    ['ROI %', formatPercent(outputs.roiPercent)],
    ['Payback Period (months)', outputs.paybackMonths ? outputs.paybackMonths.toFixed(1) : 'N/A'],
  ];

  return rows.map(row => row.join(',')).join('\n');
}
