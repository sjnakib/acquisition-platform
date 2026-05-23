'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
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
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, fullName, turnstileToken }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Signup failed.'); return }
      router.push(data.role === 'client' ? '/overview' : '/dashboard')
    } catch { setError('An error occurred. Please try again.') }
    finally { setIsSubmitting(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-canvas)' }}>
      <div className="w-full max-w-[380px] rounded-xl p-8 max-sm:shadow-none max-sm:border-0 max-sm:p-4" style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)', boxShadow: 'var(--shadow-md)' }}>
        <div className="text-center mb-10 flex justify-center">
          <BrandLogo variant="full" disableLink={true} />
        </div>

        <h1 className="text-[20px] font-medium text-center mb-6" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Create account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Full name</Label>
            <Input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Email address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Password</Label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required className="pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }}>
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-center py-1">
            <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
          </div>

          <Button type="submit" size="lg" disabled={isSubmitting || !turnstileToken} className="w-full">
            {isSubmitting ? <><LoadingSpinner size="sm" /> Creating account...</> : 'Create account'}
          </Button>
        </form>

        {error && (
          <div className="flex items-center gap-2 mt-4 rounded-md p-3 text-[13px]" style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="mt-4 text-center">
          <a href="/login" className="text-[13px] hover:underline" style={{ color: 'var(--accent)' }}>Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  )
}
