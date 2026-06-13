import Link from 'next/link'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

export default function InviteAcceptedPage() {
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
            background: 'var(--color-accent-bg)',
            border: '1px solid var(--color-accent-light)',
          }}
        >
          <CheckCircle2 size={26} style={{ color: 'var(--accent)' }} />
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
        Welcome to Acquire
      </h1>

      <p
        className="text-[13px] leading-relaxed mb-2 animate-item-entrance"
        style={{
          color: 'var(--color-text-secondary)',
          animationDelay: '280ms',
        }}
      >
        Your account has been created successfully.
      </p>

      <p
        className="text-[13px] leading-relaxed mb-8 animate-item-entrance"
        style={{
          color: 'var(--color-text-tertiary)',
          animationDelay: '320ms',
        }}
      >
        You can now sign in with the email and password you just set.
      </p>

      <div
        className="animate-item-entrance"
        style={{ animationDelay: '380ms' }}
      >
        <Button asChild className="w-full font-semibold">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    </div>
  )
}
