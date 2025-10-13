/**
 * Growth Calculator Utility Functions
 * Business-level formulas for policy growth and retention
 */

export interface GrowthInputs {
  currentPolicies: number;
  avgPremium: number;
  currentRetention: number;
  retentionUplift: number;
  newPoliciesPerMonth: number;
  currentWinRate: number;
  efficiencyGain: number;
  winRateUplift: number;
  aiUplift: number;
  horizonYears: number;
  currency?: string;
}

export interface GrowthOutputs {
  baselinePoliciesEndYear: number;
  ccPoliciesEndYear: number;
  incrementalPolicies: number;
  roiPoliciesPercent: number;
  baselineGwp: number;
  ccGwp: number;
  incrementalGwp: number;
  roiGwpPercent: number;
  monthlyData: {
    month: number;
    baselinePolicies: number;
    ccPolicies: number;
    baselineGwp: number;
    ccGwp: number;
  }[];
  yearlyData: {
    year: number;
    baselinePolicies: number;
    ccPolicies: number;
    baselineGwp: number;
    ccGwp: number;
  }[];
}

export function calculateGrowth(inputs: GrowthInputs): GrowthOutputs {
  const {
    currentPolicies,
    avgPremium,
    currentRetention,
    retentionUplift,
    newPoliciesPerMonth,
    currentWinRate,
    efficiencyGain,
    winRateUplift,
    aiUplift,
    horizonYears,
  } = inputs;

  // Convert annual retention to monthly retention rate
  const r0 = currentRetention / 100;
  const rm0 = 1 - Math.pow(1 - r0, 1 / 12);
  
  const r1 = Math.min(0.995, (currentRetention + retentionUplift) / 100);
  const rm1 = 1 - Math.pow(1 - r1, 1 / 12);

  // Win rates
  const w0 = currentWinRate / 100;
  const win1 = Math.min(
    0.99,
    w0 * (1 + winRateUplift / 100) * (1 + aiUplift / 100)
  );

  // Capacity and attempts
  const capMult = 1 + efficiencyGain / 100;
  
  // Monthly wins
  const nbWon0M = newPoliciesPerMonth * w0;
  const nbWon1M = newPoliciesPerMonth * capMult * win1;

  // Monthly evolution
  const totalMonths = horizonYears * 12;
  const nBase: number[] = [currentPolicies];
  const nCc: number[] = [currentPolicies];

  for (let t = 1; t <= totalMonths; t++) {
    nBase[t] = nBase[t - 1] * rm0 + nbWon0M;
    nCc[t] = nCc[t - 1] * rm1 + nbWon1M;
  }

  // Monthly data for charts
  const monthlyData = [];
  for (let t = 0; t <= totalMonths; t++) {
    monthlyData.push({
      month: t,
      baselinePolicies: Math.round(nBase[t]),
      ccPolicies: Math.round(nCc[t]),
      baselineGwp: Math.round(nBase[t] * avgPremium),
      ccGwp: Math.round(nCc[t] * avgPremium),
    });
  }

  // Yearly data
  const yearlyData = [];
  for (let y = 1; y <= horizonYears; y++) {
    const endMonth = y * 12;
    yearlyData.push({
      year: y,
      baselinePolicies: Math.round(nBase[endMonth]),
      ccPolicies: Math.round(nCc[endMonth]),
      baselineGwp: Math.round(nBase[endMonth] * avgPremium),
      ccGwp: Math.round(nCc[endMonth] * avgPremium),
    });
  }

  // Final year metrics
  const baselinePif = nBase[totalMonths] || 0;
  const ccPif = nCc[totalMonths] || 0;
  const incrementalPolicies = ccPif - baselinePif;
  const roiPoliciesPercent = baselinePif > 0 ? (incrementalPolicies / baselinePif) * 100 : 0;

  // GWP metrics
  const baselineGwp = baselinePif * avgPremium;
  const ccGwp = ccPif * avgPremium;
  const incrementalGwp = ccGwp - baselineGwp;
  const roiGwpPercent = baselineGwp > 0 ? (incrementalGwp / baselineGwp) * 100 : 0;

  return {
    baselinePoliciesEndYear: Math.round(baselinePif),
    ccPoliciesEndYear: Math.round(ccPif),
    incrementalPolicies: Math.round(incrementalPolicies),
    roiPoliciesPercent,
    baselineGwp: Math.round(baselineGwp),
    ccGwp: Math.round(ccGwp),
    incrementalGwp: Math.round(incrementalGwp),
    roiGwpPercent,
    monthlyData,
    yearlyData,
  };
}

export const GROWTH_PRESETS = {
  conservative: {
    retentionUplift: 3,
    efficiencyGain: 20,
    winRateUplift: 5,
    aiUplift: 3,
  },
  typical: {
    retentionUplift: 5,
    efficiencyGain: 30,
    winRateUplift: 10,
    aiUplift: 5,
  },
  aggressive: {
    retentionUplift: 7,
    efficiencyGain: 40,
    winRateUplift: 15,
    aiUplift: 8,
  },
};
