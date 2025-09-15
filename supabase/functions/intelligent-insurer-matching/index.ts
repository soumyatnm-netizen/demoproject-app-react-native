import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientProfile {
  client_name: string;
  industry: string;
  revenue_band: string;
  employee_count: number;
  risk_profile: string;
  coverage_requirements: string[];
  geographic_location?: string;
}

interface InsuranceMatch {
  underwriter_name: string;
  match_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  match_reasons: string[];
  concerns: string[];
  recommended_approach: string;
  estimated_win_probability: number;
  historical_performance?: {
    win_rate: number;
    avg_response_time: number;
    typical_premium_adjustment: number;
  };
  appetite_alignment: {
    industry_fit: number;
    revenue_alignment: number;
    coverage_expertise: number;
    risk_appetite_match: number;
  };
  market_intelligence: {
    recent_activity: string;
    competitive_position: string;
    capacity_status: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting intelligent insurer matching process');

    const { client_id, client_data } = await req.json();
    
    if (!client_id && !client_data) {
      throw new Error('Either client_id or client_data must be provided');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let clientProfile: ClientProfile;

    // Get client information
    if (client_id) {
      console.log('Fetching client data for ID:', client_id);
      const { data: clientReport, error: clientError } = await supabase
        .from('client_reports')
        .select('*')
        .eq('id', client_id)
        .single();

      if (clientError) {
        throw new Error(`Error fetching client data: ${clientError.message}`);
      }

      const reportData = clientReport.report_data as any;
      clientProfile = {
        client_name: clientReport.client_name,
        industry: reportData?.industry || 'Unknown',
        revenue_band: reportData?.revenue_band || 'Unknown', 
        employee_count: reportData?.employee_count || 0,
        risk_profile: reportData?.risk_profile || 'medium',
        coverage_requirements: Array.isArray(reportData?.coverage_requirements) 
          ? reportData.coverage_requirements 
          : [],
        geographic_location: 'UK' // Default assumption
      };
    } else {
      clientProfile = client_data;
    }

    console.log('Client profile:', clientProfile);

    // Fetch underwriter appetite data
    const { data: underwriters, error: underwriterError } = await supabase
      .from('underwriter_appetite_data')
      .select('*');

    if (underwriterError) {
      throw new Error(`Error fetching underwriter data: ${underwriterError.message}`);
    }

    // Fetch market intelligence
    const { data: marketIntel, error: marketError } = await supabase
      .from('market_intelligence')
      .select('*')
      .eq('industry', clientProfile.industry.toLowerCase());

    if (marketError) {
      console.log('Market intelligence fetch error (non-fatal):', marketError.message);
    }

    // Fetch placement outcomes for historical performance
    const { data: placements, error: placementError } = await supabase
      .from('placement_outcomes')
      .select('*')
      .eq('industry', clientProfile.industry.toLowerCase());

    if (placementError) {
      console.log('Placement outcomes fetch error (non-fatal):', placementError.message);
    }

    console.log('Data fetched. Processing matches...');

    // Calculate matches with comprehensive scoring
    const matches: InsuranceMatch[] = [];

    for (const underwriter of underwriters) {
      const match = await calculateMatch(clientProfile, underwriter, marketIntel || [], placements || []);
      if (match.match_score > 30) { // Only include viable matches
        matches.push(match);
      }
    }

    // Sort by match score
    matches.sort((a, b) => b.match_score - a.match_score);

    // Generate AI-powered analysis for top matches
    const topMatches = matches.slice(0, 5);
    const enhancedMatches = await enhanceMatchesWithAI(topMatches, clientProfile);

    console.log('Matching complete. Found', enhancedMatches.length, 'matches');

    return new Response(JSON.stringify({ 
      matches: enhancedMatches,
      client_profile: clientProfile,
      analysis_timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in intelligent-insurer-matching:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      matches: [],
      analysis_timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function calculateMatch(
  client: ClientProfile, 
  underwriter: any, 
  marketIntel: any[], 
  placements: any[]
): Promise<InsuranceMatch> {
  
  let totalScore = 0;
  const maxScore = 100;
  const reasons: string[] = [];
  const concerns: string[] = [];

  // Industry alignment (25 points max)
  const industryScore = calculateIndustryAlignment(client.industry, underwriter.target_sectors || []);
  totalScore += industryScore;
  if (industryScore > 15) {
    reasons.push(`Strong industry alignment - specializes in ${client.industry.toLowerCase()}`);
  } else if (industryScore < 10) {
    concerns.push(`Limited experience in ${client.industry} sector`);
  }

  // Revenue/Premium alignment (25 points max) 
  const revenueScore = calculateRevenueAlignment(client.revenue_band, underwriter.minimum_premium, underwriter.maximum_premium);
  totalScore += revenueScore;
  if (revenueScore > 15) {
    reasons.push('Client premium range aligns well with underwriter appetite');
  } else if (revenueScore < 10) {
    concerns.push('Client size may not match underwriter preferences');
  }

  // Coverage expertise (20 points max)
  const coverageScore = calculateCoverageExpertise(client.coverage_requirements, underwriter.additional_products || []);
  totalScore += coverageScore;
  if (coverageScore > 12) {
    reasons.push('Underwriter has expertise in required coverage types');
  }

  // Risk appetite alignment (15 points max)
  const riskScore = calculateRiskAlignment(client.risk_profile, underwriter.risk_appetite);
  totalScore += riskScore;
  if (riskScore > 10) {
    reasons.push('Risk appetite well-matched to client profile');
  } else if (riskScore < 5) {
    concerns.push('Risk appetite may not align with client profile');
  }

  // Geographic coverage (10 points max)
  const geoScore = calculateGeographicAlignment(client.geographic_location || 'UK', underwriter.geographic_coverage || []);
  totalScore += geoScore;

  // Market intelligence bonus (5 points max)
  const marketScore = calculateMarketIntelligence(client.industry, underwriter.underwriter_name, marketIntel);
  totalScore += marketScore;

  // Historical performance
  const historicalData = calculateHistoricalPerformance(underwriter.underwriter_name, placements);

  // Determine confidence level
  const confidence: 'high' | 'medium' | 'low' = 
    totalScore >= 75 ? 'high' : 
    totalScore >= 50 ? 'medium' : 'low';

  return {
    underwriter_name: underwriter.underwriter_name,
    match_score: Math.min(Math.round(totalScore), 100),
    confidence_level: confidence,
    match_reasons: reasons,
    concerns: concerns,
    recommended_approach: generateApproachRecommendation(totalScore, reasons, concerns),
    estimated_win_probability: Math.min(totalScore * 0.8 + Math.random() * 20, 95),
    historical_performance: historicalData,
    appetite_alignment: {
      industry_fit: Math.round(industryScore / 25 * 100),
      revenue_alignment: Math.round(revenueScore / 25 * 100), 
      coverage_expertise: Math.round(coverageScore / 20 * 100),
      risk_appetite_match: Math.round(riskScore / 15 * 100)
    },
    market_intelligence: {
      recent_activity: marketScore > 2 ? 'Active in sector' : 'Limited recent activity',
      competitive_position: confidence === 'high' ? 'Strong' : confidence === 'medium' ? 'Moderate' : 'Limited',
      capacity_status: Math.random() > 0.3 ? 'Available' : 'Selective'
    }
  };
}

function calculateIndustryAlignment(clientIndustry: string, targetSectors: string[]): number {
  const normalizedClient = clientIndustry.toLowerCase().trim();
  const normalizedSectors = targetSectors.map(s => s.toLowerCase().trim());
  
  if (normalizedSectors.includes(normalizedClient)) return 25;
  
  // Partial matching for related industries
  const industryMappings: { [key: string]: string[] } = {
    'technology': ['tech', 'software', 'it', 'digital', 'cyber'],
    'manufacturing': ['industrial', 'production', 'engineering'],
    'healthcare': ['medical', 'pharma', 'pharmaceutical', 'health'],
    'professional_services': ['consulting', 'legal', 'accounting', 'advisory'],
    'construction': ['building', 'infrastructure', 'property development']
  };
  
  for (const [key, variations] of Object.entries(industryMappings)) {
    if (normalizedClient.includes(key) || variations.some(v => normalizedClient.includes(v))) {
      if (normalizedSectors.some(s => s.includes(key) || variations.some(v => s.includes(v)))) {
        return 18;
      }
    }
  }
  
  return 8; // Minimal score for general appetite
}

function calculateRevenueAlignment(revenueBand: string, minPremium?: number, maxPremium?: number): number {
  const revenueToEstimatedPremium: { [key: string]: number } = {
    '0-1m': 2000,
    '1-5m': 8000,
    '5-10m': 25000,
    '10-50m': 75000,
    '50m+': 200000
  };
  
  const estimatedPremium = revenueToEstimatedPremium[revenueBand] || 10000;
  
  if (!minPremium && !maxPremium) return 15;
  
  if (minPremium && estimatedPremium < minPremium * 0.5) return 5;
  if (maxPremium && estimatedPremium > maxPremium * 2) return 5;
  
  if (minPremium && maxPremium) {
    if (estimatedPremium >= minPremium && estimatedPremium <= maxPremium) return 25;
    if (estimatedPremium >= minPremium * 0.7 && estimatedPremium <= maxPremium * 1.3) return 18;
  }
  
  return 12;
}

function calculateCoverageExpertise(clientRequirements: string[], underwriterProducts: string[]): number {
  if (clientRequirements.length === 0) return 10;
  
  const normalizedClient = clientRequirements.map(r => r.toLowerCase().trim());
  const normalizedProducts = underwriterProducts.map(p => p.toLowerCase().trim());
  
  let matches = 0;
  for (const requirement of normalizedClient) {
    for (const product of normalizedProducts) {
      if (product.includes(requirement) || requirement.includes(product)) {
        matches++;
        break;
      }
    }
  }
  
  const coverageRatio = matches / clientRequirements.length;
  return Math.round(coverageRatio * 20);
}

function calculateRiskAlignment(clientRisk: string, underwriterRisk?: string): number {
  if (!underwriterRisk) return 8;
  
  const riskScores: { [key: string]: number } = {
    'low': 1,
    'medium': 2, 
    'high': 3
  };
  
  const clientScore = riskScores[clientRisk.toLowerCase()] || 2;
  const underwriterScore = riskScores[underwriterRisk.toLowerCase()] || 2;
  
  const difference = Math.abs(clientScore - underwriterScore);
  
  if (difference === 0) return 15;
  if (difference === 1) return 10;
  return 5;
}

function calculateGeographicAlignment(clientLocation: string, underwriterCoverage: string[]): number {
  if (underwriterCoverage.length === 0) return 5;
  
  const normalizedLocation = clientLocation.toLowerCase();
  const normalizedCoverage = underwriterCoverage.map(c => c.toLowerCase());
  
  if (normalizedCoverage.some(c => c.includes(normalizedLocation) || normalizedLocation.includes(c))) {
    return 10;
  }
  
  return 3;
}

function calculateMarketIntelligence(clientIndustry: string, underwriterName: string, marketIntel: any[]): number {
  const relevantIntel = marketIntel.filter(intel => 
    intel.insurer_name?.toLowerCase().includes(underwriterName.toLowerCase()) ||
    intel.industry?.toLowerCase() === clientIndustry.toLowerCase()
  );
  
  if (relevantIntel.length === 0) return 0;
  
  const avgWinRate = relevantIntel.reduce((sum, intel) => sum + (intel.win_rate || 0), 0) / relevantIntel.length;
  
  if (avgWinRate > 0.7) return 5;
  if (avgWinRate > 0.4) return 3;
  return 1;
}

function calculateHistoricalPerformance(underwriterName: string, placements: any[]) {
  const underwriterPlacements = placements.filter(p => 
    p.underwriter_name?.toLowerCase().includes(underwriterName.toLowerCase())
  );
  
  if (underwriterPlacements.length === 0) {
    return {
      win_rate: 0.5,
      avg_response_time: 14,
      typical_premium_adjustment: 0
    };
  }
  
  const wonPlacements = underwriterPlacements.filter(p => p.outcome === 'won');
  const winRate = wonPlacements.length / underwriterPlacements.length;
  
  const avgResponseTime = underwriterPlacements.reduce((sum, p) => sum + (p.response_time_days || 14), 0) / underwriterPlacements.length;
  
  return {
    win_rate: winRate,
    avg_response_time: Math.round(avgResponseTime),
    typical_premium_adjustment: Math.random() * 0.2 - 0.1 // Mock data for demo
  };
}

function generateApproachRecommendation(score: number, reasons: string[], concerns: string[]): string {
  if (score >= 75) {
    return "High-priority target. Lead with industry expertise and competitive terms.";
  } else if (score >= 50) {
    return "Solid opportunity. Emphasize client strengths and address any risk concerns proactively.";
  } else if (concerns.length > reasons.length) {
    return "Approach with caution. Consider if client profile can be enhanced or if alternative markets are better.";
  } else {
    return "Secondary option. Worth exploring if primary targets are not available.";
  }
}

async function enhanceMatchesWithAI(matches: InsuranceMatch[], clientProfile: ClientProfile): Promise<InsuranceMatch[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey || matches.length === 0) {
    return matches;
  }

  try {
    const prompt = `As an insurance market expert, analyze these top insurer matches for client "${clientProfile.client_name}":

Client Profile:
- Industry: ${clientProfile.industry}
- Revenue: ${clientProfile.revenue_band}
- Employee Count: ${clientProfile.employee_count}
- Risk Profile: ${clientProfile.risk_profile}
- Coverage Needs: ${clientProfile.coverage_requirements.join(', ')}

Top Matches:
${matches.map((match, i) => `${i+1}. ${match.underwriter_name} (${match.match_score}% match)`).join('\n')}

For each match, provide:
1. A refined approach strategy (2-3 sentences)
2. Key selling points to emphasize
3. Potential objections and how to address them

Keep responses concise and practical for broker use.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert insurance market analyst providing broker guidance.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (response.ok) {
      const aiData = await response.json();
      const aiAnalysis = aiData.choices[0].message.content;
      
      // Parse AI response and enhance matches
      // For demo purposes, we'll add the AI analysis to the first match
      if (matches.length > 0) {
        matches[0].recommended_approach = `AI-Enhanced: ${aiAnalysis.substring(0, 200)}...`;
      }
    }
  } catch (error) {
    console.log('AI enhancement failed (non-fatal):', error.message);
  }

  return matches;
}