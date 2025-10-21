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
}: PasswordResetEmailProps) => {
  const resetUrl = `${redirect_to}#type=recovery&token=${token}&email=${encodeURIComponent(user_email || '')}`;
  
  return (
    <Html>
      <Head />
      <Preview>Reset your Cover Compass password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logoText}>Cover Compass</Heading>
            <Text style={tagline}>Markets Mapped. Cover Unlocked</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Password Reset Request</Heading>
            
            <Text style={greeting}>Hello,</Text>

            <Text style={text}>
              We received a request to reset the password for your Cover Compass account. 
              If you initiated this request, please click the secure link below to proceed.
            </Text>

            <Section style={buttonContainer}>
              <Button
                href={resetUrl}
                style={button}
              >
                Reset My Password
              </Button>
            </Section>

            <Section style={securityNotice}>
              <Text style={securityText}>
                <strong style={strongText}>Important:</strong> This link is only valid for a limited time. 
                If you did not request a password reset, please ignore this email. Your password will remain secure.
              </Text>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You are receiving this email because a password reset was requested for the user associated with this email address.
            </Text>
            <Text style={footerText}>
              If the button above does not work, copy and paste this URL into your browser:
            </Text>
            <Text style={footerLink}>
              <Link href={resetUrl} style={linkStyle}>
                {resetUrl}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

const main = {
  backgroundColor: '#f6f6f6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  marginBottom: '40px',
  marginTop: '20px',
  maxWidth: '600px',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  overflow: 'hidden',
};

const header = {
  backgroundColor: '#ffffff',
  padding: '20px 20px 10px 20px',
  textAlign: 'center' as const,
  borderBottom: '2px solid #007bff',
};

const logoText = {
  color: '#007bff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
};

const tagline = {
  color: '#666666',
  fontSize: '14px',
  margin: '5px 0 0 0',
};

const content = {
  padding: '40px 40px 20px 40px',
};

const h1 = {
  color: '#333333',
  fontSize: '22px',
  fontWeight: '600',
  margin: '0 0 20px 0',
};

const greeting = {
  color: '#555555',
  fontSize: '16px',
  margin: '0 0 15px 0',
};

const text = {
  color: '#555555',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 25px 0',
};

const buttonContainer = {
  margin: '20px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#007bff',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 'bold',
  lineHeight: '1.25',
  padding: '12px 25px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const securityNotice = {
  margin: '0 0 25px 0',
};

const securityText = {
  color: '#555555',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
};

const strongText = {
  color: '#ff4747',
};

const footer = {
  backgroundColor: '#f6f6f6',
  borderTop: '1px solid #eeeeee',
  padding: '20px 40px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#999999',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '0 0 10px 0',
};

const footerLink = {
  color: '#999999',
  fontSize: '12px',
  margin: '10px 0 0 0',
  wordBreak: 'break-all' as const,
};

const linkStyle = {
  color: '#007bff',
  fontSize: '12px',
  textDecoration: 'none',
};