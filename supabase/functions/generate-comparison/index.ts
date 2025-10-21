import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Generate comparison function loaded")

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let success = true;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { quoteIds } = await req.json()
    console.log('Generating comparison for quotes:', quoteIds)

    if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length < 2) {
      return new Response(
        JSON.stringify({ 
          error: 'At least 2 quote IDs are required for comparison' 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Fetch the quotes from the database
    const { data: quotes, error: quotesError } = await supabase
      .from('structured_quotes')
      .select('*')
      .in('id', quoteIds)

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch quotes for comparison' 
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    if (!quotes || quotes.length < 2) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient quotes found for comparison' 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    console.log(`Found ${quotes.length} quotes for comparison`)

    // Generate robust comparison analysis with numeric safety
    const premiumsRaw = quotes.map((q: any) => q.premium_amount).filter((p: any) => p !== null && p !== undefined)
    const premiums = premiumsRaw
      .map((p: any) => (typeof p === 'string' ? parseFloat(p) : Number(p)))
      .filter((n: number) => Number.isFinite(n))

    console.log('Premiums parsed:', premiums)

    const premiumStats = premiums.length > 0
      ? {
          average: premiums.reduce((a: number, b: number) => a + b, 0) / premiums.length,
          lowest: Math.min(...premiums),
          highest: Math.max(...premiums),
        }
      : { average: null as number | null, lowest: null as number | null, highest: null as number | null }

    const range = premiumStats.lowest != null && premiumStats.highest != null
      ? premiumStats.highest - premiumStats.lowest
      : null

    // Find common inclusions across all quotes
    const allInclusions = quotes.map((q: any) => q.inclusions || [])
    const commonInclusions = allInclusions.length > 0 
      ? allInclusions.reduce((common: string[], current: string[]) => 
          common.filter((inclusion: string) => current.includes(inclusion))
        )
      : []

    const recommendedQuoteId = premiumStats.lowest != null
      ? quotes.find((q: any) => {
          const v = typeof q.premium_amount === 'string' ? parseFloat(q.premium_amount) : Number(q.premium_amount)
          return Number.isFinite(v) && v === premiumStats.lowest
        })?.id
      : undefined

    // Generate comparison results
    const comparisonResults = {
      quoteCount: quotes.length,
      premiumAnalysis: {
        average: premiumStats.average,
        lowest: premiumStats.lowest,
        highest: premiumStats.highest,
        range,
      },
      coverageAnalysis: {
        commonInclusions,
        recommendedQuote: recommendedQuoteId,
      },
      recommendations: [
        `Best Value: ${quotes.find((q: any) => q.id === recommendedQuoteId)?.insurer_name || 'Unknown'}${premiumStats.lowest != null ? ` with £${premiumStats.lowest.toLocaleString()}` : ''}`,
        `Premium range: ${premiumStats.lowest != null ? `£${premiumStats.lowest.toLocaleString()}` : 'n/a'} - ${premiumStats.highest != null ? `£${premiumStats.highest.toLocaleString()}` : 'n/a'}`,
        `Average market premium: ${premiumStats.average != null ? `£${Math.round(premiumStats.average).toLocaleString()}` : 'n/a'}`,
        'Consider coverage limits and exclusions when making final decision',
      ],
      generatedAt: new Date().toISOString(),
    }

    console.log('Comparison analysis completed successfully')

    // Record processing time
    const duration = Date.now() - startTime;
    await supabase.from('processing_metrics').insert({
      operation_type: 'generate_comparison',
      duration_ms: duration,
      success: true,
      metadata: { quote_count: quotes.length }
    });

    return new Response(
      JSON.stringify(comparisonResults),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    success = false;
    console.error('Error in generate-comparison function:', error)
    
    // Record failed processing time
    const duration = Date.now() - startTime;
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      await supabase.from('processing_metrics').insert({
        operation_type: 'generate_comparison',
        duration_ms: duration,
        success: false,
        metadata: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log metrics:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during comparison generation' 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})