import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientProfile {
  client_id?: string;
  document_id: string;
  insurance_product: string;
  industry: string;
  revenue?: number;
  employees?: number;
  requested_coverage_amount: number;
  jurisdiction?: string[];
  hq_country?: string;
  security_controls?: string[];
  special_exposures?: string[];
}

interface AppetiteMatch {
  carrier_id: string;
  carrier_name: string;
  confidence_score: number;
  coverage_fit: string;
  jurisdiction_fit: boolean;
  industry_fit: string;
  capacity_fit_diff: number;
  exclusions_hit: string[];
  primary_reasons: string[];
  explanation: string;
  last_guide_update: string;
  score_breakdown: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting appetite matching process');

    const { client_profile } = await req.json() as { client_profile: ClientProfile };
    
    if (!client_profile || !client_profile.document_id) {
      throw new Error('client_profile with document_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all appetite data that matches the product type
    const { data: appetiteData, error: appetiteError } = await supabase
      .from('underwriter_appetite_data')
      .select(`
        *,
        appetite_document:underwriter_appetites!inner(
          id,
          underwriter_name,
          logo_url,
          updated_at,
          status
        )
      `)
      .eq('product_type', client_profile.insurance_product)
      .eq('appetite_document.status', 'processed');

    if (appetiteError) {
      console.error('Error fetching appetite data:', appetiteError);
      throw new Error(`Error fetching appetite data: ${appetiteError.message}`);
    }

    if (!appetiteData || appetiteData.length === 0) {
      console.log('No appetite guides found for product:', client_profile.insurance_product);
      return new Response(JSON.stringify({ 
        top_matches: [],
        nearest_misses: [],
        message: `No appetite guides available for ${client_profile.insurance_product}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${appetiteData.length} appetite guides to match against`);

    // Calculate match scores
    const matches: AppetiteMatch[] = [];

    for (const appetite of appetiteData) {
      const match = calculateAppetiteMatch(client_profile, appetite);
      matches.push(match);
    }

    // Sort by confidence score
    matches.sort((a, b) => b.confidence_score - a.confidence_score);

    // Get top 3 strong matches (>=60 score)
    const topMatches = matches.filter(m => m.confidence_score >= 60).slice(0, 3);
    
    // Get nearest misses (50-59 score) if we don't have 3 strong matches
    const nearestMisses = topMatches.length < 3 
      ? matches.filter(m => m.confidence_score >= 50 && m.confidence_score < 60).slice(0, 3 - topMatches.length)
      : matches.filter(m => m.confidence_score >= 50 && m.confidence_score < 60).slice(0, 3);

    // Store match results in database
    for (const match of topMatches) {
      await supabase.from('appetite_match_results').insert({
        client_document_id: client_profile.document_id,
        carrier_id: match.carrier_id,
        confidence_score: match.confidence_score,
        coverage_fit: match.coverage_fit,
        jurisdiction_fit: match.jurisdiction_fit,
        industry_fit: match.industry_fit,
        capacity_fit_diff: match.capacity_fit_diff,
        exclusions_hit: match.exclusions_hit,
        primary_reasons: match.primary_reasons,
        explanation: match.explanation,
        score_breakdown: match.score_breakdown,
      });
    }

    console.log(`Matching complete. Top matches: ${topMatches.length}, Nearest misses: ${nearestMisses.length}`);

    return new Response(JSON.stringify({ 
      top_matches: topMatches,
      nearest_misses: nearestMisses,
      total_evaluated: matches.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in appetite-matching:', error);
    return new Response(JSON.stringify({ 
      error: (error as any).message,
      top_matches: [],
      nearest_misses: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateAppetiteMatch(client: ClientProfile, appetite: any): AppetiteMatch {
  let score = 50; // Base score
  const reasons: string[] = [];
  const exclusionsHit: string[] = [];
  const failedCriteria: string[] = [];
  
  const scoreBreakdown: any = {
    base: 50,
    coverage: 0,
    jurisdiction: 0,
    industry: 0,
    revenue: 0,
    security: 0,
    exclusions: 0
  };

  // 1. COVERAGE AMOUNT FIT (+20 or -30 points)
  let coverageFit = 'unknown';
  if (appetite.coverage_amount_min || appetite.coverage_amount_max) {
    const min = appetite.coverage_amount_min || 0;
    const max = appetite.coverage_amount_max || Infinity;
    const requested = client.requested_coverage_amount;

    if (requested >= min && requested <= max) {
      score += 20;
      scoreBreakdown.coverage = 20;
      coverageFit = 'within-range';
      reasons.push(`Coverage capacity £${(requested/1000000).toFixed(1)}m within appetite (£${(min/1000000).toFixed(1)}m-£${(max/1000000).toFixed(1)}m)`);
    } else if (requested <= max * 1.1 && requested >= min * 0.9) {
      score += 5;
      scoreBreakdown.coverage = 5;
      coverageFit = 'near-range';
      reasons.push(`Coverage £${(requested/1000000).toFixed(1)}m close to appetite range`);
    } else if (requested < min) {
      score -= 15;
      scoreBreakdown.coverage = -15;
      coverageFit = 'below-minimum';
      failedCriteria.push(`Coverage £${(requested/1000000).toFixed(1)}m below minimum £${(min/1000000).toFixed(1)}m`);
    } else if (requested > max * 1.2) {
      score -= 30;
      scoreBreakdown.coverage = -30;
      coverageFit = 'above-maximum';
      failedCriteria.push(`Coverage £${(requested/1000000).toFixed(1)}m exceeds max £${(max/1000000).toFixed(1)}m by >20%`);
    }
  }

  // 2. JURISDICTION FIT (+10 or -20 points)
  let jurisdictionFit = false;
  if (appetite.jurisdictions && appetite.jurisdictions.length > 0 && client.jurisdiction) {
    const clientJurisdictions = Array.isArray(client.jurisdiction) ? client.jurisdiction : [client.jurisdiction];
    const matchingJurisdictions = clientJurisdictions.filter(cj => 
      appetite.jurisdictions.some((aj: string) => 
        aj.toLowerCase() === cj.toLowerCase() || 
        aj.toLowerCase().startsWith(cj.toLowerCase()) ||
        cj.toLowerCase().startsWith(aj.toLowerCase())
      )
    );

    if (matchingJurisdictions.length === clientJurisdictions.length) {
      score += 10;
      scoreBreakdown.jurisdiction = 10;
      jurisdictionFit = true;
      reasons.push(`Active in all client jurisdictions (${matchingJurisdictions.join(', ')})`);
    } else if (matchingJurisdictions.length > 0) {
      score -= 10;
      scoreBreakdown.jurisdiction = -10;
      failedCriteria.push(`Partial jurisdiction match (${matchingJurisdictions.length}/${clientJurisdictions.length})`);
    } else {
      score -= 20;
      scoreBreakdown.jurisdiction = -20;
      jurisdictionFit = false;
      failedCriteria.push(`No jurisdiction match (client: ${clientJurisdictions.join(', ')})`);
    }
  }

  // 3. INDUSTRY FIT (+20 or +10 points)
  let industryFit = 'no-match';
  if (appetite.industry_classes && appetite.industry_classes.length > 0) {
    const normalizedClientIndustry = client.industry.toLowerCase();
    const matchingIndustries = appetite.industry_classes.filter((ind: string) =>
      ind.toLowerCase().includes(normalizedClientIndustry) ||
      normalizedClientIndustry.includes(ind.toLowerCase())
    );

    if (matchingIndustries.length > 0) {
      score += 20;
      scoreBreakdown.industry = 20;
      industryFit = 'direct-match';
      reasons.push(`${client.insurance_product} appetite for ${client.industry}`);
    } else if (appetite.target_sectors) {
      const sectorMatch = appetite.target_sectors.some((sector: string) =>
        sector.toLowerCase().includes(normalizedClientIndustry) ||
        normalizedClientIndustry.includes(sector.toLowerCase())
      );
      if (sectorMatch) {
        score += 10;
        scoreBreakdown.industry = 10;
        industryFit = 'sector-match';
        reasons.push(`Covers related sectors in ${client.industry}`);
      }
    }
  }

  // 4. REVENUE FIT (+5 or -10 points)
  if (appetite.revenue_range_min || appetite.revenue_range_max) {
    const min = appetite.revenue_range_min || 0;
    const max = appetite.revenue_range_max || Infinity;
    const clientRevenue = client.revenue || 0;

    if (clientRevenue >= min && clientRevenue <= max) {
      score += 5;
      scoreBreakdown.revenue = 5;
    } else if (clientRevenue < min || clientRevenue > max) {
      score -= 10;
      scoreBreakdown.revenue = -10;
      failedCriteria.push(`Revenue £${(clientRevenue/1000000).toFixed(1)}m outside range`);
    }
  }

  // 5. SECURITY REQUIREMENTS (+5 or -20 points)
  if (appetite.security_requirements && appetite.security_requirements.length > 0 && client.security_controls) {
    const requiredControls = appetite.security_requirements.map((r: string) => r.toLowerCase());
    const clientControls = client.security_controls.map(c => c.toLowerCase());
    
    const missingControls = requiredControls.filter((req: string) => 
      !clientControls.some(cc => cc.includes(req) || req.includes(cc))
    );

    if (missingControls.length === 0) {
      score += 5;
      scoreBreakdown.security = 5;
      reasons.push('All security requirements met');
    } else {
      score -= 20;
      scoreBreakdown.security = -20;
      failedCriteria.push(`Missing security controls: ${missingControls.join(', ')}`);
    }
  }

  // 6. HARD EXCLUSIONS (score = 0 if hit)
  if (appetite.exclusions && appetite.exclusions.length > 0) {
    const normalizedExclusions = appetite.exclusions.map((e: string) => e.toLowerCase());
    const clientIndustryLower = client.industry.toLowerCase();
    const clientExposuresLower = (client.special_exposures || []).map(e => e.toLowerCase());

    const hitExclusions = normalizedExclusions.filter((excl: string) =>
      clientIndustryLower.includes(excl) ||
      clientExposuresLower.some(exp => exp.includes(excl) || excl.includes(exp))
    );

    if (hitExclusions.length > 0) {
      score = 0;
      scoreBreakdown.exclusions = -100;
      exclusionsHit.push(...hitExclusions);
      failedCriteria.push(`Exclusions hit: ${hitExclusions.join(', ')}`);
    }
  }

  // Cap score between 0-100
  score = Math.max(0, Math.min(100, score));

  // Generate explanation
  const explanation = reasons.length > 0 
    ? reasons.slice(0, 2).join('; ') + (failedCriteria.length > 0 ? `. Watch: ${failedCriteria[0]}` : '')
    : `Score ${score}/100. ${failedCriteria.slice(0, 2).join('; ')}`;

  // Get appetite document details
  const appetiteDoc = Array.isArray(appetite.appetite_document) 
    ? appetite.appetite_document[0] 
    : appetite.appetite_document;

  return {
    carrier_id: appetiteDoc.id,
    carrier_name: appetiteDoc.underwriter_name || appetite.underwriter_name,
    confidence_score: score,
    coverage_fit: coverageFit,
    jurisdiction_fit: jurisdictionFit,
    industry_fit: industryFit,
    capacity_fit_diff: client.requested_coverage_amount - (appetite.coverage_amount_max || 0),
    exclusions_hit: exclusionsHit,
    primary_reasons: reasons.slice(0, 3),
    explanation: explanation.substring(0, 200),
    last_guide_update: appetiteDoc.updated_at?.split('T')[0] || 'Unknown',
    score_breakdown: scoreBreakdown
  };
}