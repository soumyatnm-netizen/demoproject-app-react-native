import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { htmlContent } = await req.json();

    if (!htmlContent) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating PDF from HTML content...');

    // Use Browserless.io API for PDF generation
    // Alternative: You can use PDFShift, HTML2PDF, or any other PDF service
    const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
    
    if (!browserlessApiKey) {
      return new Response(
        JSON.stringify({ error: 'PDF service not configured. Please add BROWSERLESS_API_KEY secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Browserless API to generate PDF with proper wait for styles
    const pdfResponse = await fetch(`https://production-sfo.browserless.io/pdf?token=${browserlessApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent,
        waitFor: 2000, // Wait 2 seconds for Tailwind to load and process
        options: {
          displayHeaderFooter: false,
          printBackground: true,
          format: 'A4',
          margin: {
            top: '12mm',
            right: '12mm',
            bottom: '16mm',
            left: '12mm'
          },
          preferCSSPageSize: false,
        }
      })
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('Browserless API error:', errorText);
      throw new Error(`PDF generation failed: ${errorText}`);
    }

    // Get the PDF buffer
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    console.log(`PDF generated successfully, size: ${pdfBuffer.byteLength} bytes`);

    // Return the PDF with proper headers
    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Policy_Comparison_Report.pdf"',
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
        details: 'Check edge function logs for more information'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
