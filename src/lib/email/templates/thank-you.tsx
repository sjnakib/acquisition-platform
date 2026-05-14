import { Html, Body, Container, Text, Heading } from '@react-email/components'

interface ThankYouEmailProps {
  ownerName: string
  propertyAddress: string
  senderName: string
}

export default function ThankYouEmail({ ownerName, propertyAddress, senderName }: ThankYouEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading style={{ fontSize: '18px' }}>Thank You — {propertyAddress}</Heading>
          <Text>Dear {ownerName},</Text>
          <Text>Thank you for your time and for providing the information regarding {propertyAddress}. We appreciate the opportunity to review the materials.</Text>
          <Text>We will be in touch with next steps shortly.</Text>
          <Text>Best regards,<br />{senderName}</Text>
        </Container>
      </Body>
    </Html>
  )
}
