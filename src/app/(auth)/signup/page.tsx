'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'

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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, turnstileToken }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Signup failed.'); return }
      router.push(data.role === 'client' ? '/overview' : '/dashboard')
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const darkInput = "w-full h-[34px] rounded-md px-3 text-[13px] outline-none transition-all duration-80 border bg-transparent text-[rgba(255,255,255,0.9)] placeholder:text-[rgba(255,255,255,0.25)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.15)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--color-accent-light)]"

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#0E0E0E' }}>
      <div className="fixed pointer-events-none" style={{ top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,150,60,0.08) 0%, transparent 70%)' }} />

      <div className="w-full max-w-[380px] rounded-[14px] p-8 max-sm:bg-transparent max-sm:border-0 max-sm:p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl" style={{ color: 'var(--accent)' }}>◆</span>
            <span className="text-[18px] font-medium" style={{ color: '#FFFFFF', fontFamily: 'var(--font-dm-sans)' }}>Acquire</span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.3)' }}>Acquisition Platform</p>
        </div>

        <h1 className="text-[20px] font-medium text-center mb-6" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-dm-sans)' }}>
          Create account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required className={darkInput} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required className={darkInput} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required className={darkInput + ' pr-10'} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-center py-1">
            <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
          </div>

          <button type="submit" disabled={isSubmitting || !turnstileToken} className="w-full h-10 rounded-md text-[14px] font-medium flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none" style={{ background: 'var(--accent)', color: '#FFFFFF' }}>
            {isSubmitting ? <><LoadingSpinner size="sm" /> Creating account...</> : 'Create account'}
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-2 mt-4 rounded-md p-3 text-[13px]" style={{ background: 'rgba(196, 43, 43, 0.12)', border: '1px solid rgba(196, 43, 43, 0.3)', color: '#F08080' }}>
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
