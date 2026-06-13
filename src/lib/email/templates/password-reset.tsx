import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Preview,
  Section,
} from '@react-email/components'

interface PasswordResetEmailProps {
  email: string
  brandName: string
  brandDescription: string
  resetUrl: string
  expiresAt: string
  requestIp?: string
  requestLocation?: string
}

export default function PasswordResetEmail({
  email,
  brandName,
  brandDescription,
  resetUrl,
  expiresAt,
  requestIp,
  requestLocation,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Preview>Reset your {brandName} password</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Heading style={brandHeading}>{brandName}</Heading>
            <Text style={brandSubtext}>{brandDescription}</Text>
          </Section>

          <Hr style={divider} />

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={greeting}>Reset Your Password</Heading>

            <Text style={paragraph}>
              You requested a password reset for your <strong>{brandName}</strong>{' '}
              account associated with <strong>{email}</strong>.
            </Text>

            <Text style={paragraph}>
              Click the button below to set a new password. This link is valid
              for one use only.
            </Text>

            <Section style={buttonContainer}>
              <Button href={resetUrl} style={button}>
                Reset Password
              </Button>
            </Section>

            <Text style={expiryText}>
              This link expires on{' '}
              {expiresAt}. If you did not request a password reset, you can
              safely ignore this email — your password will not change.
            </Text>

            {(requestIp || requestLocation) && (
              <Section style={securityBox}>
                <Text style={securityLabel}>Request Information</Text>
                {requestIp && (
                  <Text style={securityDetail}>IP Address: {requestIp}</Text>
                )}
                {requestLocation && (
                  <Text style={securityDetail}>Location: {requestLocation}</Text>
                )}
                <Text style={securityDetail}>
                  Time: {new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </Text>
              </Section>
            )}
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              {brandName} &mdash; {brandDescription}
            </Text>
            <Text style={footerText}>Adriyan CRE</Text>
            <Text style={footerDisclaimer}>
              If you did not request this password reset, no action is required.
              Your account remains secure.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---------- inline styles ---------- */

const body: React.CSSProperties = {
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  backgroundColor: '#0a0a0a',
  margin: 0,
  padding: '40px 0',
}

const container: React.CSSProperties = {
  maxWidth: 520,
  margin: '0 auto',
  backgroundColor: '#111111',
  border: '1px solid #222222',
  borderRadius: 16,
  overflow: 'hidden',
}

const headerSection: React.CSSProperties = {
  padding: '32px 40px 20px',
  textAlign: 'center',
}

const brandHeading: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: '#f5f5f5',
  margin: 0,
  letterSpacing: '-0.02em',
}

const brandSubtext: React.CSSProperties = {
  fontSize: 13,
  color: '#888888',
  margin: '6px 0 0',
  fontWeight: 400,
}

const divider: React.CSSProperties = {
  borderColor: '#222222',
  margin: 0,
}

const contentSection: React.CSSProperties = {
  padding: '28px 40px 32px',
}

const greeting: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: '#f5f5f5',
  margin: '0 0 16px',
  letterSpacing: '-0.01em',
}

const paragraph: React.CSSProperties = {
  fontSize: 15,
  lineHeight: '1.6',
  color: '#cccccc',
  margin: '0 0 14px',
}

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '24px 0 20px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#f5f5f5',
  color: '#0a0a0a',
  fontSize: 14,
  fontWeight: 600,
  padding: '12px 32px',
  borderRadius: 8,
  textDecoration: 'none',
  textTransform: 'none',
}

const expiryText: React.CSSProperties = {
  fontSize: 12,
  color: '#666666',
  margin: 0,
  textAlign: 'center',
}

const footerSection: React.CSSProperties = {
  padding: '20px 40px 28px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  fontSize: 12,
  color: '#666666',
  margin: '0 0 2px',
}

const footerDisclaimer: React.CSSProperties = {
  fontSize: 11,
  color: '#555555',
  margin: '12px 0 0',
  fontStyle: 'italic',
}

const securityBox: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  border: '1px solid #333333',
  borderRadius: 8,
  padding: '14px 16px',
  marginTop: 16,
}

const securityLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#777777',
  margin: '0 0 6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const securityDetail: React.CSSProperties = {
  fontSize: 12,
  color: '#888888',
  margin: '0 0 2px',
}
