import { Html, Body, Container, Text, Heading } from '@react-email/components'

interface DeclinationEmailProps {
  ownerName: string
  propertyAddress: string
  senderName: string
}

export default function DeclinationEmail({ ownerName, propertyAddress, senderName }: DeclinationEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading style={{ fontSize: '18px' }}>Update — {propertyAddress}</Heading>
          <Text>Dear {ownerName},</Text>
          <Text>After careful review, we have decided to pass on {propertyAddress} at this time. We appreciate you sharing the details with us.</Text>
          <Text>We wish you the best with the sale.</Text>
          <Text>Best regards,<br />{senderName}</Text>
        </Container>
      </Body>
    </Html>
  )
}
