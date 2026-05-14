'use client'
import Turnstile from 'react-turnstile'

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
}

export function TurnstileWidget({ onVerify }: TurnstileWidgetProps) {
  return (
    <div className="flex justify-center">
      <Turnstile
        sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        onVerify={onVerify}
        theme="light"
      />
    </div>
  )
}
