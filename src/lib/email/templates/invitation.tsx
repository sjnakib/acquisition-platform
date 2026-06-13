import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Link,
  Button,
  Hr,
  Preview,
  Section,
  Row,
  Column,
} from '@react-email/components'

interface InvitationEmailProps {
  inviteeEmail: string
  role: string
  brandName: string
  brandDescription: string
  acceptUrl: string
  expiresAt: string
  message?: string
}

const roleLabels: Record<string, string> = {
  internal: 'Team Member',
  client: 'Sponsor',
  admin: 'Administrator',
}

export default function InvitationEmail({
  inviteeEmail,
  role,
  brandName,
  brandDescription,
  acceptUrl,
  expiresAt,
  message,
}: InvitationEmailProps) {
  const roleLabel = roleLabels[role] ?? role

  return (
    <Html>
      <Preview>
        You have been invited to join {brandName} as a {roleLabel}
      </Preview>
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
            <Heading style={greeting}>You&apos;ve Been Invited</Heading>

            <Text style={paragraph}>
              You have been invited to join <strong>{brandName}</strong> as a{' '}
              <strong>{roleLabel}</strong>. {brandName} is a{' '}
              {brandDescription.toLowerCase()}, powered by Adriyan CRE.
            </Text>

            <Section style={roleBadge}>
              <Text style={roleBadgeText}>Account Type: {roleLabel}</Text>
            </Section>

            {message && (
              <Section style={messageBox}>
                <Text style={messageText}>{message}</Text>
              </Section>
            )}

            <Text style={paragraph}>
              Click the button below to create your account and set up your
              credentials. This invitation is addressed to{' '}
              <strong>{inviteeEmail}</strong>.
            </Text>

            <Section style={buttonContainer}>
              <Button href={acceptUrl} style={button}>
                Accept Invitation
              </Button>
            </Section>

            <Text style={expiryText}>
              This invitation link expires on{' '}
              {expiresAt}. Please accept before then.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              {brandName} &mdash; {brandDescription}
            </Text>
            <Text style={footerText}>Adriyan CRE</Text>
            <Text style={footerDisclaimer}>
              If you were not expecting this invitation, you can safely ignore
              this email. No account will be created without your action.
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

const roleBadge: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#1a1a1a',
  border: '1px solid #333333',
  borderRadius: 8,
  padding: '8px 16px',
  marginBottom: 18,
}

const roleBadgeText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#e0e0e0',
  margin: 0,
}

const messageBox: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  borderLeft: '3px solid #444444',
  borderRadius: '0 8px 8px 0',
  padding: '12px 16px',
  marginBottom: 18,
}

const messageText: React.CSSProperties = {
  fontSize: 14,
  color: '#aaaaaa',
  margin: 0,
  fontStyle: 'italic',
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
