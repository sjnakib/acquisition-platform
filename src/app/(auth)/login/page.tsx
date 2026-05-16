'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { BrandLogo } from '@/components/shared/BrandLogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, turnstileToken }) })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) setError('Invalid email or password.')
        else if (res.status === 429) setError('Too many attempts. Try again in 5 minutes.')
        else if (res.status === 400) setError(data.error ?? 'Bot verification failed.')
        else setError(data.error ?? 'An error occurred.')
        return
      }
      router.push(data.role === 'client' ? '/overview' : '/dashboard')
    } catch { setError('An error occurred. Please try again.') }
    finally { setIsSubmitting(false) }
  }

  const inputClass = "w-full h-[34px] rounded-md px-3 text-[13px] outline-none transition-all duration-80 border"

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-canvas)' }}>
      <div className="w-full max-w-[380px] rounded-[14px] p-8 max-sm:shadow-none max-sm:border-0 max-sm:p-4" style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)', boxShadow: 'var(--shadow-md)' }}>
        {/* Logo */}
        <div className="text-center mb-10 flex justify-center">
          <BrandLogo variant="full" />
        </div>

        <h1 className="text-[20px] font-medium text-center mb-6" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Welcome back</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required className={inputClass}
              style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-3)', color: 'var(--color-text-primary)' }} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className={inputClass + ' pr-10'}
                style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-3)', color: 'var(--color-text-primary)' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }}>
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-center py-1">
            <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} onError={() => setTurnstileError(true)} />
          </div>

          {turnstileError && <p className="text-xs text-center" style={{ color: 'var(--color-danger-text)' }}>Bot check failed to load.</p>}

          <button type="submit" disabled={isSubmitting || !turnstileToken}
            className="w-full h-10 rounded-md text-[14px] font-medium flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            style={{ background: 'var(--accent)', color: '#FFFFFF' }}>
            {isSubmitting ? <><LoadingSpinner size="sm" /> Signing in...</> : 'Sign in'}
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-2 mt-4 rounded-md p-3 text-[13px]" style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="mt-4 text-center">
          <a href="/reset-password" className="text-[13px] hover:underline" style={{ color: 'var(--accent)' }}>Forgot password?</a>
        </div>
      </div>
    </div>
  )
}
