interface EmailThreadProps {
  gmailThreadId?: string | null
  gmailMessageId?: string | null
}

export function EmailThread({ gmailThreadId }: EmailThreadProps) {
  if (!gmailThreadId) {
    return <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No email sent yet.</p>
  }

  return (
    <a
      href={`https://mail.google.com/mail/u/0/#inbox/${gmailThreadId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm hover:underline"
      style={{ color: 'var(--accent)' }}
    >
      View Full Thread in Gmail →
    </a>
  )
}
