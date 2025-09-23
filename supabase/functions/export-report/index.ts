import { corsHeaders } from '../_shared/cors.ts'

console.log("Export report function loaded")

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { comparisonData, format } = await req.json()
    console.log('Exporting report with format:', format)

    if (!comparisonData) {
      return new Response(
        JSON.stringify({ 
          error: 'Comparison data is required' 
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

    if (format !== 'pdf') {
      return new Response(
        JSON.stringify({ 
          error: 'Only PDF format is currently supported' 
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

    // Generate HTML content for the report
    const htmlContent = generateReportHTML(comparisonData)

    // For now, return the HTML content as a downloadable file
    // In a production environment, you would convert this to PDF using a library like Puppeteer
    const reportResponse = {
      success: true,
      message: 'Report generated successfully',
      downloadUrl: `data:text/html;base64,${btoa(htmlContent)}`,
      filename: `quote-comparison-${new Date().toISOString().split('T')[0]}.html`
    }

    console.log('Report generated successfully')

    return new Response(
      JSON.stringify(reportResponse),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in export-report function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during report generation' 
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

function generateReportHTML(comparisonData: any): string {
  const { premiumAnalysis, coverageAnalysis, recommendations, generatedAt } = comparisonData
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insurance Quote Comparison Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #0066cc;
            margin-bottom: 10px;
        }
        .section {
            margin-bottom: 30px;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
        }
        .section h2 {
            color: #0066cc;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 10px;
        }
        .premium-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-top: 15px;
        }
        .premium-item {
            background: white;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #0066cc;
        }
        .premium-item h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .premium-value {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
        }
        .recommendations ul {
            list-style-type: none;
            padding: 0;
        }
        .recommendations li {
            background: white;
            margin: 10px 0;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #28a745;
        }
        .inclusions {
            columns: 2;
            column-gap: 30px;
        }
        .inclusions li {
            break-inside: avoid;
            margin-bottom: 8px;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Insurance Quote Comparison Report</h1>
        <p>Generated on ${new Date(generatedAt).toLocaleDateString('en-GB', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
    </div>

    <div class="section">
        <h2>Premium Analysis Summary</h2>
        <div class="premium-grid">
            <div class="premium-item">
                <h3>Lowest Premium</h3>
                <div class="premium-value">£${premiumAnalysis.lowest?.toLocaleString()}</div>
            </div>
            <div class="premium-item">
                <h3>Highest Premium</h3>
                <div class="premium-value">£${premiumAnalysis.highest?.toLocaleString()}</div>
            </div>
            <div class="premium-item">
                <h3>Average Premium</h3>
                <div class="premium-value">£${Math.round(premiumAnalysis.average).toLocaleString()}</div>
            </div>
            <div class="premium-item">
                <h3>Premium Range</h3>
                <div class="premium-value">£${premiumAnalysis.range?.toLocaleString()}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Coverage Analysis</h2>
        <h3>Common Inclusions Across All Quotes</h3>
        <ul class="inclusions">
            ${coverageAnalysis.commonInclusions?.map((inclusion: string) => `<li>• ${inclusion}</li>`).join('') || '<li>No common inclusions found</li>'}
        </ul>
    </div>

    <div class="section recommendations">
        <h2>Key Recommendations</h2>
        <ul>
            ${recommendations?.map((rec: string) => `<li>${rec}</li>`).join('') || '<li>No recommendations available</li>'}
        </ul>
    </div>

    <div class="footer">
        <p>This report was generated by CoverCompass Insurance Comparison Platform</p>
        <p>Report ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
    </div>
</body>
</html>
  `
}