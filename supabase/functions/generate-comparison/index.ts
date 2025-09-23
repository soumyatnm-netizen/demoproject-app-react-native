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

    // Generate basic comparison analysis
    const premiums = quotes.map(q => q.premium_amount).filter(p => p != null)
    const averagePremium = premiums.reduce((a, b) => a + b, 0) / premiums.length
    const lowestPremium = Math.min(...premiums)
    const highestPremium = Math.max(...premiums)

    // Find common inclusions across all quotes
    const allInclusions = quotes.map(q => q.inclusions || [])
    const commonInclusions = allInclusions.length > 0 
      ? allInclusions.reduce((common, current) => 
          common.filter(inclusion => current.includes(inclusion))
        )
      : []

    // Generate comparison results
    const comparisonResults = {
      quoteCount: quotes.length,
      premiumAnalysis: {
        average: averagePremium,
        lowest: lowestPremium,
        highest: highestPremium,
        range: highestPremium - lowestPremium
      },
      coverageAnalysis: {
        commonInclusions,
        recommendedQuote: quotes.find(q => q.premium_amount === lowestPremium)?.id
      },
      recommendations: [
        `Best Value: ${quotes.find(q => q.premium_amount === lowestPremium)?.insurer_name || 'Unknown'} with £${lowestPremium?.toLocaleString()}`,
        `Premium range: £${lowestPremium?.toLocaleString()} - £${highestPremium?.toLocaleString()}`,
        `Average market premium: £${Math.round(averagePremium).toLocaleString()}`,
        'Consider coverage limits and exclusions when making final decision'
      ],
      generatedAt: new Date().toISOString()
    }

    console.log('Comparison analysis completed successfully')

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
    console.error('Error in generate-comparison function:', error)
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