'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { Mail, AlertCircle, ArrowLeft, Send, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useSearchParams } from 'next/navigation'

const webmailMap: Record<string, string> = {
  'gmail.com': 'https://mail.google.com/',
  'googlemail.com': 'https://mail.google.com/',
  'outlook.com': 'https://outlook.live.com/',
  'hotmail.com': 'https://outlook.live.com/',
  'live.com': 'https://outlook.live.com/',
  'yahoo.com': 'https://mail.yahoo.com/',
  'protonmail.com': 'https://mail.proton.me/',
  'proton.me': 'https://mail.proton.me/',
  'icloud.com': 'https://www.icloud.com/mail/',
  'zoho.com': 'https://mail.zoho.com/',
  'yandex.com': 'https://mail.yandex.com/',
}

function resolveWebmail(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase()
  if (domain && webmailMap[domain]) return webmailMap[domain]!
  return 'https://mail.google.com/'
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const prefillEmail = searchParams.get('email') ?? ''

  const [email, setEmail] = useState(prefillEmail)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<'idle' | 'sent' | 'not_found'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'An error occurred. Please try again.')
        return
      }
      if (data.sent === true) {
        setResult('sent')
      } else {
        setResult('not_found')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---- Email sent confirmation ----
  if (result === 'sent') {
    return (
      <div className="w-full max-w-[380px] rounded-2xl p-8 max-sm:p-6 glass-auth-card text-center transition-all duration-300 animate-card-entrance">
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
          Email Sent
        </h1>

        <p
          className="text-[13px] leading-relaxed mb-2 animate-item-entrance"
          style={{ color: 'var(--color-text-secondary)', animationDelay: '280ms' }}
        >
          We&apos;ve sent a password reset link to{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>.
        </p>

        <p
          className="text-[12px] leading-relaxed mb-8 animate-item-entrance"
          style={{ color: 'var(--color-text-tertiary)', animationDelay: '320ms' }}
        >
          The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
        </p>

        <div
          className="space-y-3 animate-item-entrance"
          style={{ animationDelay: '380ms' }}
        >
          <Button
            className="w-full font-semibold"
            onClick={() => window.open(resolveWebmail(email), '_blank')}
          >
            <ExternalLink size={15} className="mr-1.5" /> Open Email
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft size={14} className="mr-1.5" /> Back to Sign in
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ---- Account not found ----
  if (result === 'not_found') {
    return (
      <div className="w-full max-w-[380px] rounded-2xl p-8 max-sm:p-6 glass-auth-card text-center transition-all duration-300 animate-card-entrance">
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
          No Account Found
        </h1>

        <p
          className="text-[13px] leading-relaxed mb-2 animate-item-entrance"
          style={{ color: 'var(--color-text-secondary)', animationDelay: '280ms' }}
        >
          There is no account associated with{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>.
        </p>

        <p
          className="text-[12px] leading-relaxed mb-8 animate-item-entrance"
          style={{ color: 'var(--color-text-tertiary)', animationDelay: '320ms' }}
        >
          Check the spelling or contact your administrator for an invitation.
        </p>

        <div className="space-y-3 animate-item-entrance" style={{ animationDelay: '380ms' }}>
          <Button
            className="w-full font-semibold"
            onClick={() => { setResult('idle'); setError(null) }}
          >
            Try a Different Email
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft size={14} className="mr-1.5" /> Back to Sign in
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ---- Request form ----
  return (
    <div
      className={`w-full max-w-[380px] rounded-2xl p-8 max-sm:p-6 glass-auth-card transition-all duration-300 animate-card-entrance ${
        error ? 'animate-card-shake' : ''
      }`}
    >
      {/* Brand Logo */}
      <div
        className="text-center mb-10 flex justify-center animate-item-entrance"
        style={{ animationDelay: '80ms' }}
      >
        <BrandLogo variant="full" disableLink />
      </div>

      <h1
        className="text-[21px] font-semibold text-center mb-2 tracking-tight animate-item-entrance"
        style={{
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans)',
          animationDelay: '140ms',
        }}
      >
        Reset Password
      </h1>

      <p
        className="text-[13px] text-center mb-6 leading-relaxed animate-item-entrance"
        style={{ color: 'var(--color-text-secondary)', animationDelay: '200ms' }}
      >
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="animate-item-entrance" style={{ animationDelay: '260ms' }}>
          <Label
            className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Email address
          </Label>
          <div className="relative">
            <Mail
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="pl-9 transition-all duration-200"
            />
          </div>
        </div>

        <div
          className="flex justify-center py-1.5 z-20 relative animate-item-entrance"
          style={{ animationDelay: '320ms' }}
        >
          <TurnstileWidget
            onVerify={(t) => setTurnstileToken(t)}
            onError={() => setTurnstileError(true)}
          />
        </div>

        {turnstileError && (
          <p
            className="text-xs text-center font-medium animate-error-banner"
            style={{ color: 'var(--color-danger-text)' }}
          >
            Bot check failed to load.
          </p>
        )}

        <div className="animate-item-entrance" style={{ animationDelay: '380ms' }}>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || !turnstileToken}
            className="w-full font-semibold"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" /> Sending Link...
              </>
            ) : (
              <>
                <Send size={15} className="mr-1.5" /> Send Reset Link
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-2 mt-4 rounded-lg p-3 text-[13px] font-medium animate-error-banner"
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger-text)',
          }}
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
        </div>
      )}

      <div
        className="mt-5 text-center animate-item-entrance"
        style={{ animationDelay: '440ms' }}
      >
        <Link
          href="/login"
          className="text-[13px] font-medium hover:underline transition-all duration-300 hover:opacity-80 inline-flex items-center gap-1"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft size={13} /> Back to Sign in
        </Link>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[380px] rounded-2xl p-8 glass-auth-card animate-card-entrance flex flex-col items-center gap-4">
          <BrandLogo variant="full" disableLink />
          <LoadingSpinner size="md" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
