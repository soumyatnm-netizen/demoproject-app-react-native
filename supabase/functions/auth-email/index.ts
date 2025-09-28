import React from 'https://esm.sh/react@18.3.1';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22';
import { WelcomeEmail } from './_templates/welcome-email.tsx';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const hookSecret = Deno.env.get('AUTH_EMAIL_HOOK_SECRET') as string;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    console.log('Processing authentication email webhook...');

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    // If no hook secret is set, skip webhook verification for development
    let webhookData;
    if (hookSecret) {
      const wh = new Webhook(hookSecret);
      webhookData = wh.verify(payload, headers);
    } else {
      console.log('No webhook secret set, parsing payload directly (development mode)');
      webhookData = JSON.parse(payload);
    }

    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = webhookData as {
      user: {
        email: string;
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
      };
    };

    console.log('Email action type:', email_action_type);
    console.log('User email:', user.email);

    // Determine email subject and template based on action type
    let subject = 'Welcome to CoverCompass';
    let fromName = 'CoverCompass';
    
    switch (email_action_type) {
      case 'signup':
        subject = 'Welcome to CoverCompass - Confirm your account';
        break;
      case 'recovery':
        subject = 'Reset your CoverCompass password';
        break;
      case 'email_change':
        subject = 'Confirm your new email address';
        break;
      case 'invite':
        subject = 'You\'ve been invited to CoverCompass';
        break;
      default:
        subject = 'CoverCompass Account Verification';
    }

    // Render the email template
    const html = await renderAsync(
      React.createElement(WelcomeEmail, {
        supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
        token,
        token_hash,
        redirect_to: redirect_to || `${Deno.env.get('SUPABASE_URL')}/`,
        email_action_type,
        user_email: user.email,
      })
    );

    console.log('Sending email to:', user.email);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `${fromName} <onboarding@resend.dev>`, // Replace with your verified domain
      to: [user.email],
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
    
  } catch (error: any) {
    console.error('Error in auth-email function:', error);
    
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          details: error.toString(),
        },
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
});