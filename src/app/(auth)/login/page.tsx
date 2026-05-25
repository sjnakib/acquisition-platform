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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [eyePop, setEyePop] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  const handleTogglePassword = () => {
    setShowPassword(!showPassword)
    setEyePop(true)
    setTimeout(() => setEyePop(false), 300)
  }

  // ----------------------------------------------------
  // SUBMIT HANDLER
  // ----------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email, password, turnstileToken }) 
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) setError('Invalid email or password.')
        else if (res.status === 429) setError('Too many attempts. Try again in 5 minutes.')
        else if (res.status === 400) setError(data.error ?? 'Bot verification failed.')
        else setError(data.error ?? 'An error occurred.')
        return
      }
      setIsExiting(true)
      setTimeout(() => {
        router.push(data.role === 'client' ? '/overview' : '/dashboard')
      }, 130)
    } catch { 
      setError('An error occurred. Please try again.') 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  return (
    <div className={`w-full max-w-[380px] rounded-2xl p-8 max-sm:p-6 glass-auth-card transition-all duration-300 ${isExiting ? 'animate-page-exit' : 'animate-card-entrance'} ${error ? 'animate-card-shake' : ''}`}>
      
      {/* Brand Skyscraper Logo */}
      <div className="text-center mb-10 flex justify-center animate-item-entrance" style={{ animationDelay: '80ms' }}>
        <BrandLogo variant="full" disableLink={true} />
      </div>

      <h1 
        className="text-[21px] font-semibold text-center mb-6 tracking-tight animate-item-entrance" 
        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)', animationDelay: '140ms' }}
      >
        Welcome back
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="animate-item-entrance" style={{ animationDelay: '200ms' }}>
          <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Email address</Label>
          <Input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="you@company.com" 
            autoComplete="email" 
            required 
            className="transition-all duration-200" 
          />
        </div>
        <div className="animate-item-entrance" style={{ animationDelay: '260ms' }}>
          <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Password</Label>
          <div className="relative">
            <Input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              autoComplete="current-password" 
              required 
              className="pr-10 transition-all duration-200" 
            />
            <button 
              type="button" 
              onClick={handleTogglePassword} 
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 ${eyePop ? 'animate-eye-pop' : ''}`} 
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex justify-center py-1.5 z-20 relative animate-item-entrance" style={{ animationDelay: '320ms' }}>
          <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} onError={() => setTurnstileError(true)} />
        </div>

        {turnstileError && <p className="text-xs text-center font-medium animate-error-banner" style={{ color: 'var(--color-danger-text)' }}>Bot check failed to load.</p>}

        <div className="animate-item-entrance" style={{ animationDelay: '380ms' }}>
          <Button 
            type="submit" 
            size="lg" 
            disabled={isSubmitting || !turnstileToken} 
            className="w-full font-semibold"
          >
            {isSubmitting ? <><LoadingSpinner size="sm" /> Signing in...</> : 'Sign in'}
          </Button>
        </div>
      </form>

      {error && (
        <div 
          className="flex items-center gap-2 mt-4 rounded-lg p-3 text-[13px] font-medium animate-error-banner" 
          style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="mt-5 text-center animate-item-entrance" style={{ animationDelay: '440ms' }}>
        <a 
          href="/reset-password" 
          className="text-[13px] font-medium hover:underline transition-all duration-300 hover:opacity-80" 
          style={{ color: 'var(--accent)' }}
        >
          Forgot password?
        </a>
      </div>
    </div>
  )
}
