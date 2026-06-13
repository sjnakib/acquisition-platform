'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, Shield, CheckCircle2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const roleLabels: Record<string, string> = {
  internal: 'Team Member',
  client: 'Sponsor',
  admin: 'Administrator',
}

type InviteInfo = {
  email: string
  role: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string; redirect: string }
  | { kind: 'ready'; info: InviteInfo }

export default function InviteSignupPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [eyePop, setEyePop] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/invitations/${token}`)
        const data = await res.json()
        if (!res.ok) {
          const redirect = data.redirect ?? '/invite/expired'
          router.replace(redirect)
          return
        }
        setState({ kind: 'ready', info: { email: data.email, role: data.role } })
      } catch {
        router.replace('/invite/expired')
      }
    }
    validate()
  }, [token, router])

  const handleTogglePassword = () => {
    setShowPassword(!showPassword)
    setEyePop(true)
    setTimeout(() => setEyePop(false), 300)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken || state.kind !== 'ready') return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name,
          password,
          turnstileToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create account. Please try again.')
        return
      }
      setIsExiting(true)
      setTimeout(() => {
        router.push('/invite/accepted')
      }, 130)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (state.kind === 'loading') {
    return (
      <div className="w-full max-w-[380px] rounded-2xl p-8 glass-auth-card animate-card-entrance flex flex-col items-center gap-4">
        <BrandLogo variant="full" disableLink />
        <LoadingSpinner size="md" />
        <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Validating your invitation...
        </p>
      </div>
    )
  }

  if (state.kind !== 'ready') return null
  const { info } = state
  const roleLabel = roleLabels[info.role] ?? info.role

  return (
    <div
      className={`w-full max-w-[420px] rounded-2xl p-8 max-sm:p-6 glass-auth-card transition-all duration-300 ${
        isExiting ? 'animate-page-exit' : 'animate-card-entrance'
      } ${error ? 'animate-card-shake' : ''}`}
    >
      {/* Brand Logo */}
      <div
        className="text-center mb-8 flex justify-center animate-item-entrance"
        style={{ animationDelay: '80ms' }}
      >
        <BrandLogo variant="full" disableLink />
      </div>

      {/* Invitation details */}
      <div
        className="text-center mb-6 animate-item-entrance"
        style={{ animationDelay: '140ms' }}
      >
        <h1
          className="text-[20px] font-semibold tracking-tight mb-2"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
        >
          Create Your Account
        </h1>
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          You have been invited to join as a{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{roleLabel}</strong>
        </p>
      </div>

      {/* Email + Role badge */}
      <div
        className="flex items-center justify-center gap-3 mb-6 animate-item-entrance"
        style={{ animationDelay: '180ms' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-surface-2)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Shield size={13} />
          {info.email}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {/* Name */}
        <div className="animate-item-entrance" style={{ animationDelay: '220ms' }}>
          <Label
            className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Full Name
          </Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            required
            disabled={isSubmitting}
            className="transition-all duration-200"
          />
        </div>

        {/* Password */}
        <div className="animate-item-entrance" style={{ animationDelay: '280ms' }}>
          <Label
            className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Password
          </Label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              minLength={8}
              className="pr-10 transition-all duration-200"
            />
            <button
              type="button"
              onClick={handleTogglePassword}
              disabled={isSubmitting}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 ${
                eyePop ? 'animate-eye-pop' : ''
              }`}
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {showPassword ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Turnstile */}
        <div
          className="flex justify-center py-1.5 z-20 relative animate-item-entrance"
          style={{ animationDelay: '340ms' }}
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

        {/* Submit */}
        <div className="animate-item-entrance" style={{ animationDelay: '400ms' }}>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || !turnstileToken || !name || password.length < 8}
            className="w-full font-semibold"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" /> Creating Account...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} className="mr-1.5" /> Create Account
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
    </div>
  )
}
