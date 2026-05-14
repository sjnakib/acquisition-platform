import { Html, Body, Container, Text, Heading } from '@react-email/components'

interface OutreachEmailProps {
  ownerName: string
  propertyAddress: string
  senderName: string
  customParagraph?: string
}

export default function OutreachEmail({ ownerName, propertyAddress, senderName, customParagraph }: OutreachEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading style={{ fontSize: '18px' }}>Regarding {propertyAddress}</Heading>
          <Text>Dear {ownerName},</Text>
          <Text>{customParagraph ?? 'I am reaching out regarding your property. We are active acquirers in this market and would love to connect.'}</Text>
          <Text>Best regards,<br />{senderName}</Text>
        </Container>
      </Body>
    </Html>
  )
}
