'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) setError('Invalid email or password.')
        else if (res.status === 429) setError('Too many attempts. Try again in 5 minutes.')
        else setError(data.error ?? 'Bot verification failed.')
        return
      }

      router.push('/projects')
    } catch {
      setError('An error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          required
          className="w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-1"
          style={{
            borderColor: 'var(--color-surface-3)',
            color: 'var(--color-text-primary)',
            background: 'var(--color-surface-0)',
          }}
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full h-9 rounded-md border px-3 pr-10 text-sm focus:outline-none focus:ring-1"
            style={{
              borderColor: 'var(--color-surface-3)',
              color: 'var(--color-text-primary)',
              background: 'var(--color-surface-0)',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
      <button
        type="submit"
        disabled={isSubmitting || !turnstileToken}
        className="w-full h-10 rounded-md text-sm font-medium flex items-center justify-center transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        style={{
          background: 'var(--accent)',
          color: 'var(--color-text-inverse)',
        }}
      >
        {isSubmitting ? <LoadingSpinner size="sm" /> : 'Sign in'}
      </button>
      {error && (
        <div
          className="rounded-md border p-3 text-sm"
          style={{
            background: 'var(--color-danger-bg)',
            borderColor: 'var(--color-danger-border)',
            color: 'var(--color-danger-text)',
          }}
        >
          {error}
        </div>
      )}
    </form>
  )
}
