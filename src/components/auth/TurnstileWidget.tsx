'use client'
import Turnstile from 'react-turnstile'

interface TurnstileWidgetProps {
 onVerify: (token: string) => void
 onError?: (error?: unknown) => void
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
 return (
 <div className="flex justify-center">
 <Turnstile
 sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
 onVerify={onVerify}
 onError={onError}
 theme="light"
 />
 </div>
 )
}
