'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, Lock, Shield, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; icon: React.ReactNode; title: string; message: string }
  | { kind: 'ready'; email: string }

export default function ResetPasswordTokenPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [eyePopPw, setEyePopPw] = useState(false)
  const [eyePopCfm, setEyePopCfm] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/auth/reset-password/${token}`)
        const data = await res.json()
        if (!res.ok) {
          const err = data.error as string
          if (err === 'token_expired') {
            setState({
              kind: 'error',
              icon: <Clock size={26} style={{ color: 'var(--color-text-tertiary)' }} />,
              title: 'Link Expired',
              message:
                'This password reset link has expired. For security, reset links are only valid for 1 hour. Please request a new one.',
            })
          } else if (err === 'token_used') {
            setState({
              kind: 'error',
              icon: <XCircle size={26} style={{ color: 'var(--color-text-tertiary)' }} />,
              title: 'Link Already Used',
              message:
                'This password reset link has already been used. If you still need to reset your password, please request a new link.',
            })
          } else {
            setState({
              kind: 'error',
              icon: <XCircle size={26} style={{ color: 'var(--color-text-tertiary)' }} />,
              title: 'Invalid Link',
              message:
                'This password reset link is invalid. It may have been mistyped or already expired. Please request a new one.',
            })
          }
          return
        }
        setState({ kind: 'ready', email: data.email })
      } catch {
        setState({
          kind: 'error',
          icon: <XCircle size={26} style={{ color: 'var(--color-text-tertiary)' }} />,
          title: 'Something Went Wrong',
          message: 'Unable to validate your reset link. Please try again or request a new one.',
        })
      }
    }
    validate()
  }, [token])

  const handleTogglePassword = () => {
    setShowPassword(!showPassword)
    setEyePopPw(true)
    setTimeout(() => setEyePopPw(false), 300)
  }

  const handleToggleConfirm = () => {
    setShowConfirm(!showConfirm)
    setEyePopCfm(true)
    setTimeout(() => setEyePopCfm(false), 300)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken || state.kind !== 'ready') return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          confirmPassword,
          turnstileToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.details) {
          // Zod validation errors — surface first field error
          const firstIssue = data.details.fieldErrors
          const firstMsg =
            firstIssue?.password?.[0] ??
            firstIssue?.confirmPassword?.[0] ??
            firstIssue?.turnstileToken?.[0] ??
            data.error
          setError(firstMsg ?? 'Invalid input.')
        } else {
          setError(data.error ?? 'Failed to reset password. Please try again.')
        }
        return
      }
      setIsExiting(true)
      setTimeout(() => {
        router.push('/login?info=password_reset_success')
      }, 130)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---- Loading state ----
  if (state.kind === 'loading') {
    return (
      <div className="w-full max-w-[380px] rounded-2xl p-8 glass-auth-card animate-card-entrance flex flex-col items-center gap-4">
        <BrandLogo variant="full" disableLink />
        <LoadingSpinner size="md" />
        <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Validating your reset link...
        </p>
      </div>
    )
  }

  // ---- Error state ----
  if (state.kind === 'error') {
    return (
      <div className="w-full max-w-[380px] rounded-2xl p-8 max-sm:p-6 glass-auth-card animate-card-entrance text-center">
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
            {state.icon}
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
          {state.title}
        </h1>

        <p
          className="text-[13px] leading-relaxed mb-8 animate-item-entrance"
          style={{ color: 'var(--color-text-secondary)', animationDelay: '280ms' }}
        >
          {state.message}
        </p>

        <div className="space-y-3 animate-item-entrance" style={{ animationDelay: '340ms' }}>
          <Button asChild className="w-full font-semibold">
            <Link href="/reset-password">Request New Link</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Return to Login</Link>
          </Button>
        </div>
      </div>
    )
  }

  // ---- Ready state: set new password ----
  const { email } = state
  const passwordsMatch = password && confirmPassword && password === confirmPassword
  const canSubmit =
    !isSubmitting &&
    !!turnstileToken &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    passwordsMatch

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

      {/* Heading */}
      <div className="text-center mb-6 animate-item-entrance" style={{ animationDelay: '140ms' }}>
        <h1
          className="text-[20px] font-semibold tracking-tight mb-2"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
        >
          Set New Password
        </h1>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Choose a new password for your account.
        </p>
      </div>

      {/* Email badge */}
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
          {email}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {/* New Password */}
        <div className="animate-item-entrance" style={{ animationDelay: '220ms' }}>
          <Label
            className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            New Password
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
                eyePopPw ? 'animate-eye-pop' : ''
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

        {/* Confirm Password */}
        <div className="animate-item-entrance" style={{ animationDelay: '280ms' }}>
          <Label
            className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              minLength={8}
              className={`pr-10 transition-all duration-200 ${
                confirmPassword && !passwordsMatch
                  ? 'ring-2'
                  : ''
              }`}
              style={
                confirmPassword && !passwordsMatch
                  ? { borderColor: 'var(--color-danger-border)', boxShadow: 'none' }
                  : undefined
              }
            />
            <button
              type="button"
              onClick={handleToggleConfirm}
              disabled={isSubmitting}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 ${
                eyePopCfm ? 'animate-eye-pop' : ''
              }`}
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {showConfirm ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {confirmPassword && !passwordsMatch && (
            <p
              className="text-[11px] mt-1 font-medium"
              style={{ color: 'var(--color-danger-text)' }}
            >
              Passwords do not match
            </p>
          )}
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
            disabled={!canSubmit}
            className="w-full font-semibold"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" /> Resetting Password...
              </>
            ) : (
              <>
                <Lock size={16} className="mr-1.5" /> Reset Password
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
