import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  companyName: string;
  inviteCode: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, companyName, inviteCode, role }: InviteEmailRequest = await req.json();

    console.log("Sending invite email to:", email, "for company:", companyName);

    const emailResponse = await resend.emails.send({
      from: `${Deno.env.get("RESEND_FROM_NAME") || "CoverCompass"} <${Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev"}>`,
      to: [email],
      subject: `Welcome to CoverCompass - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
            .invite-code { background: #f5f5f5; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; font-family: 'Courier New', monospace; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            .info-box { background: #f9f9f9; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to CoverCompass!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              
              <p>You've been invited to join <strong>${companyName}</strong> on the CoverCompass platform as a <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong>.</p>
              
              <div class="info-box">
                <strong>📋 What is CoverCompass?</strong><br>
                CoverCompass is an intelligent insurance platform that helps brokers compare quotes, match with underwriters, and streamline the placement process.
              </div>
              
              <p><strong>Your Company Login Code:</strong></p>
              
              <div class="invite-code">
                <div class="code">${inviteCode}</div>
                <p style="margin-top: 10px; color: #666;">Use this code when signing up or logging in</p>
              </div>
              
              <div class="info-box">
                <strong>🚀 Getting Started:</strong><br>
                1. Visit the CoverCompass platform<br>
                2. Sign up or log in with your email<br>
                3. Enter the invite code: <strong>${inviteCode}</strong><br>
                4. Start using CoverCompass with your team!
              </div>
              
              <p>If you have any questions or need assistance, please don't hesitate to reach out to your company administrator.</p>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                <strong>Note:</strong> This invite code will expire in 7 days. Make sure to complete your registration before then.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} CoverCompass. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-company-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
