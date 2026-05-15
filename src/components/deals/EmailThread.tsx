interface EmailThreadProps {
 gmailThreadId?: string | null
 gmailMessageId?: string | null
}

export function EmailThread({ gmailThreadId }: EmailThreadProps) {
 if (!gmailThreadId) {
 return <p className="text-sm text-slate-400">No email sent yet.</p>
 }

 return (
 <a
 href={`https://mail.google.com/mail/u/0/#inbox/${gmailThreadId}`}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
 >
 View Full Thread in Gmail →
 </a>
 )
}
