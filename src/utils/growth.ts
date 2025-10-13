/**
 * Growth Calculator Utility Functions
 * Formulas for retention + new business uplift projections
 */

export interface GrowthInputs {
  currentPolicies: number;
  avgPremium: number;
  commissionRate: number;
  currentRetention: number;
  retentionUplift: number;
  newPoliciesPerMonth: number;
  currentWinRate: number;
  efficiencyGain: number;
  winRateUplift: number;
  aiUplift: number;
  horizonYears: number;
  discountRate?: number;
  currency?: string;
}

export interface GrowthOutputs {
  baselinePoliciesEndYear: number;
  ccPoliciesEndYear: number;
  baselineAnnualCommission: number;
  ccAnnualCommission: number;
  incrementalAnnualCommission: number;
  cumulativeIncrementalCommission: number;
  npvIncrementalCommission: number;
  monthlyData: {
    month: number;
    baselinePolicies: number;
    ccPolicies: number;
  }[];
  yearlyData: {
    year: number;
    baselineCommission: number;
    ccCommission: number;
    incrementalCommission: number;
  }[];
}

export function calculateGrowth(inputs: GrowthInputs): GrowthOutputs {
  const {
    currentPolicies,
    avgPremium,
    commissionRate,
    currentRetention,
    retentionUplift,
    newPoliciesPerMonth,
    currentWinRate,
    efficiencyGain,
    winRateUplift,
    aiUplift,
    horizonYears,
    discountRate = 8,
  } = inputs;

  // Convert annual retention to monthly retention rate
  const rm0 = 1 - Math.pow(1 - currentRetention / 100, 1 / 12);
  const r1 = Math.min(99.5, currentRetention + retentionUplift) / 100;
  const rm1 = 1 - Math.pow(1 - r1, 1 / 12);

  // Win rates
  const win0 = currentWinRate / 100;
  const win1 = Math.min(
    0.99,
    (currentWinRate / 100) * (1 + winRateUplift / 100) * (1 + aiUplift / 100)
  );

  // Capacity multiplier and new business attempts
  const capMult = 1 + efficiencyGain / 100;
  const nb1 = newPoliciesPerMonth * capMult;

  // Monthly wins
  const nbWon0M = newPoliciesPerMonth * win0;
  const nbWon1M = nb1 * win1;

  // Annual revenue per policy
  const arp = avgPremium * (commissionRate / 100);

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
    });
  }

  // Yearly data
  const yearlyData = [];
  let cumulativeIncremental = 0;
  let npvIncremental = 0;

  for (let y = 1; y <= horizonYears; y++) {
    const endMonth = y * 12;
    const baselineComm = nBase[endMonth] * arp;
    const ccComm = nCc[endMonth] * arp;
    const incremental = ccComm - baselineComm;

    yearlyData.push({
      year: y,
      baselineCommission: baselineComm,
      ccCommission: ccComm,
      incrementalCommission: incremental,
    });

    cumulativeIncremental += incremental;
    npvIncremental += incremental / Math.pow(1 + discountRate / 100, y);
  }

  const lastYear = yearlyData[yearlyData.length - 1];

  return {
    baselinePoliciesEndYear: Math.round(nBase[totalMonths]),
    ccPoliciesEndYear: Math.round(nCc[totalMonths]),
    baselineAnnualCommission: lastYear.baselineCommission,
    ccAnnualCommission: lastYear.ccAnnualCommission,
    incrementalAnnualCommission: lastYear.incrementalCommission,
    cumulativeIncrementalCommission: cumulativeIncremental,
    npvIncrementalCommission: npvIncremental,
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
};
