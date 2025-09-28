import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Button,
} from 'https://esm.sh/@react-email/components@0.0.22';
import * as React from 'https://esm.sh/react@18.3.1';

interface PasswordResetEmailProps {
  supabase_url: string;
  email_action_type: string;
  redirect_to: string;
  token_hash: string;
  token: string;
  user_email?: string;
}

export const PasswordResetEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
  user_email,
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your CoverCompass password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <div style={logo}>
            <div style={logoIcon}>🧭</div>
            <Text style={logoText}>CoverCompass</Text>
          </div>
          <Text style={tagline}>Markets Mapped. Cover Unlocked</Text>
        </Section>

        <Section style={content}>
          <Heading style={h1}>Reset Your Password</Heading>
          
          <Text style={text}>
            We received a request to reset the password for your CoverCompass account ({user_email}).
          </Text>

          <Text style={text}>
            Click the button below to create a new password:
          </Text>

          <Section style={buttonContainer}>
            <Button
              href={`${redirect_to}#type=recovery&token=${token}&email=${encodeURIComponent(user_email || '')}`}
              style={button}
            >
              Reset Password
            </Button>
          </Section>

          <Text style={text}>
            Or copy and paste this link into your browser:
          </Text>
          
          <code style={code}>
            {`${redirect_to}#type=recovery&token=${token}&email=${encodeURIComponent(user_email || '')}`}
          </code>

          <Section style={securityNotice}>
            <Text style={securityTitle}>🔒 Security Notice</Text>
            <Text style={securityText}>
              This password reset link will expire in 1 hour for your security. If you didn't request this password reset, you can safely ignore this email - your account remains secure.
            </Text>
          </Section>
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            If you didn't request this password reset, please ignore this email or contact support if you have concerns.
          </Text>
          <Text style={footerText}>
            Need help? Contact us at support@covercompass.io
          </Text>
          <Text style={footerText}>
            <Link href={redirect_to} style={footerLink}>
              CoverCompass
            </Link>
            {' '}- Transforming insurance placement with AI
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default PasswordResetEmail;

const main = {
  backgroundColor: '#f8fafc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  backgroundColor: '#1e40af', // Primary blue
  padding: '40px 32px',
  textAlign: 'center' as const,
};

const logo = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '16px',
};

const logoIcon = {
  fontSize: '32px',
  marginRight: '12px',
};

const logoText = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
};

const tagline = {
  color: '#e0e7ff',
  fontSize: '14px',
  margin: '0',
  opacity: 0.9,
};

const content = {
  padding: '40px 32px',
};

const h1 = {
  color: '#1e293b',
  fontSize: '24px',
  fontWeight: 'bold',
  lineHeight: '1.25',
  margin: '0 0 24px 0',
};

const text = {
  color: '#475569',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px 0',
};

const buttonContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#dc2626', // Red for password reset action
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1.25',
  padding: '16px 32px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const code = {
  backgroundColor: '#f1f5f9',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  color: '#475569',
  display: 'block',
  fontSize: '14px',
  padding: '16px',
  wordBreak: 'break-all' as const,
  margin: '16px 0',
};

const securityNotice = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  margin: '32px 0',
  padding: '24px',
};

const securityTitle = {
  color: '#991b1b',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const securityText = {
  color: '#7f1d1d',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
};

const footer = {
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #e2e8f0',
  padding: '32px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 8px 0',
};

const footerLink = {
  color: '#1e40af',
  textDecoration: 'none',
  fontWeight: '600',
};