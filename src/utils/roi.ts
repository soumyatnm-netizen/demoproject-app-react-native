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
  workHoursPerYear?: number;
}

export interface RoiOutputs {
  monthlyOperations: number;
  currentMonthlyLabourCost: number;
  ccMonthlyLabourCost: number;
  monthlyTimeSavedHrs: number;
  annualTimeSavedHrs: number;
  monthlyLabourSavings: number;
  annualLabourSavings: number;
  roiPercent: number;
}

export function calculateRoi(inputs: RoiInputs): RoiOutputs {
  const {
    employees,
    policiesPerMonth,
    manualTimeMin,
    ccTimeMin,
    annualSalary,
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

  // Labour savings (no platform cost)
  const savingsMonth = Math.max(0, labourCurrentMonth - labourCcMonth);
  const savingsYear = savingsMonth * 12;

  // ROI % (cost reduction)
  const roiPercent = labourCurrentMonth <= 0 ? 0 : (savingsMonth / labourCurrentMonth) * 100;

  return {
    monthlyOperations: Math.round(policiesPerMonth),
    currentMonthlyLabourCost: labourCurrentMonth,
    ccMonthlyLabourCost: labourCcMonth,
    monthlyTimeSavedHrs: timeSavedMonth,
    annualTimeSavedHrs: timeSavedYear,
    monthlyLabourSavings: savingsMonth,
    annualLabourSavings: savingsYear,
    roiPercent,
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
  },
  typical: {
    employees: 2,
    policiesPerMonth: 120,
    manualTimeMin: 20,
    ccTimeMin: 8,
    annualSalary: 45000,
  },
  aggressive: {
    employees: 3,
    policiesPerMonth: 200,
    manualTimeMin: 25,
    ccTimeMin: 7,
    annualSalary: 50000,
  },
};

export function generateCsvData(inputs: RoiInputs, outputs: RoiOutputs): string {
  const rows = [
    ['CoverCompass ROI Calculator - Labour Savings Analysis'],
    [''],
    ['INPUTS'],
    ['Employees on Task', inputs.employees.toString()],
    ['Policies per Month', inputs.policiesPerMonth.toString()],
    ['Manual Time per Policy (min)', inputs.manualTimeMin.toString()],
    ['Time with CoverCompass (min)', inputs.ccTimeMin.toString()],
    ['Average Annual Salary', formatCurrency(inputs.annualSalary)],
    [''],
    ['OUTPUTS'],
    ['Monthly Operations', outputs.monthlyOperations.toString()],
    ['Monthly Time Saved', formatHours(outputs.monthlyTimeSavedHrs)],
    ['Annual Time Saved', formatHours(outputs.annualTimeSavedHrs)],
    ['Current Monthly Labour Cost', formatCurrency(outputs.currentMonthlyLabourCost)],
    ['CoverCompass Monthly Labour Cost', formatCurrency(outputs.ccMonthlyLabourCost)],
    ['Monthly Labour Savings', formatCurrency(outputs.monthlyLabourSavings)],
    ['Annual Labour Savings', formatCurrency(outputs.annualLabourSavings)],
    ['ROI % (Cost Reduction)', formatPercent(outputs.roiPercent)],
  ];

  return rows.map(row => row.join(',')).join('\n');
}
