import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function InviteExpiredPage() {
  return (
    <div className="w-full max-w-[380px] rounded-2xl p-8 glass-auth-card animate-card-entrance text-center">
      <div
        className="flex flex-col items-center animate-item-entrance"
        style={{ animationDelay: '80ms' }}
      >
        <BrandLogo variant="full" disableLink />
      </div>

      <div
        className="mt-8 mb-6 flex justify-center animate-item-entrance"
        style={{ animationDelay: '160ms' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-surface-2)',
          }}
        >
          <XCircle size={26} style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      </div>

      <h1
        className="text-[20px] font-semibold tracking-tight mb-2 animate-item-entrance"
        style={{
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans)',
          animationDelay: '220ms',
        }}
      >
        Link Expired or Invalid
      </h1>

      <p
        className="text-[13px] leading-relaxed mb-8 animate-item-entrance"
        style={{
          color: 'var(--color-text-secondary)',
          animationDelay: '280ms',
        }}
      >
        This invitation link is no longer valid. It may have expired, already
        been used, or been revoked. Please contact your administrator for a new
        invitation.
      </p>

      <div
        className="animate-item-entrance"
        style={{ animationDelay: '340ms' }}
      >
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Return to Login</Link>
        </Button>
      </div>
    </div>
  )
}
