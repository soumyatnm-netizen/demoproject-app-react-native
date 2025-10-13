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
  currentMonthlyOperationalCost: number;
  ccMonthlyOperationalCost: number;
  monthlyTimeSavedHrs: number;
  annualTimeSavedHrs: number;
  monthlyOperationalSavings: number;
  annualOperationalSavings: number;
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

  // Operational costs
  const operationalCurrentMonth = policiesPerMonth * tManualHr * hourlyRate * employees;
  const operationalCcMonth = policiesPerMonth * tCcHr * hourlyRate * employees;

  // Operational savings (no platform cost)
  const savingsMonth = Math.max(0, operationalCurrentMonth - operationalCcMonth);
  const savingsYear = savingsMonth * 12;

  // ROI % (cost reduction)
  const roiPercent = operationalCurrentMonth <= 0 ? 0 : (savingsMonth / operationalCurrentMonth) * 100;

  return {
    monthlyOperations: Math.round(policiesPerMonth),
    currentMonthlyOperationalCost: operationalCurrentMonth,
    ccMonthlyOperationalCost: operationalCcMonth,
    monthlyTimeSavedHrs: timeSavedMonth,
    annualTimeSavedHrs: timeSavedYear,
    monthlyOperationalSavings: savingsMonth,
    annualOperationalSavings: savingsYear,
    roiPercent,
  };
}

export function formatCurrency(value: number, currency: string = 'GBP', decimals: number = 2): string {
  const symbol = currency === 'GBP' ? '£' : '$';
  const safeValue = value ?? 0;
  return `${symbol}${safeValue.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatHours(hours: number): string {
  const safeHours = hours ?? 0;
  return `${safeHours.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}h`;
}

export function formatPercent(value: number): string {
  const safeValue = value ?? 0;
  return `${safeValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
}

export const PRESETS = {
  typical: {
    employees: 7,
    policiesPerMonth: 120,
    manualTimeMin: 40,
    ccTimeMin: 8,
    annualSalary: 50000,
  },
};

export function generateCsvData(inputs: RoiInputs, outputs: RoiOutputs): string {
  const rows = [
    ['CoverCompass ROI Calculator - Operational Savings Analysis'],
    [''],
    ['INPUTS'],
    ['Brokers on Task', inputs.employees.toString()],
    ['Policies per Month', inputs.policiesPerMonth.toString()],
    ['Manual Time per Policy (min)', inputs.manualTimeMin.toString()],
    ['Time with CoverCompass (min)', inputs.ccTimeMin.toString()],
    ['Average Annual Salary', formatCurrency(inputs.annualSalary)],
    [''],
    ['OUTPUTS'],
    ['Monthly Operations', outputs.monthlyOperations.toString()],
    ['Monthly Time Saved', formatHours(outputs.monthlyTimeSavedHrs)],
    ['Annual Time Saved', formatHours(outputs.annualTimeSavedHrs)],
    ['Current Monthly Operational Cost', formatCurrency(outputs.currentMonthlyOperationalCost)],
    ['CoverCompass Monthly Operational Cost', formatCurrency(outputs.ccMonthlyOperationalCost)],
    ['Monthly Operational Savings', formatCurrency(outputs.monthlyOperationalSavings)],
    ['Annual Operational Savings', formatCurrency(outputs.annualOperationalSavings)],
    ['ROI % (Cost Reduction)', formatPercent(outputs.roiPercent)],
  ];

  return rows.map(row => row.join(',')).join('\n');
}
