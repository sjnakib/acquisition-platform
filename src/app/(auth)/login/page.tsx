'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'

export default function LoginPage() {
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
        else if (res.status === 429) setError('Too many attempts. Try again in 15 minutes.')
        else if (res.status === 400) setError(data.error ?? 'Bot verification failed. Please try again.')
        else setError(data.error ?? 'An error occurred.')
        return
      }

      const dest = data.role === 'client' ? '/overview' : '/dashboard'
      router.push(dest)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 sm:p-8 max-sm:rounded-none max-sm:shadow-none max-sm:p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500">Acquisition Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full h-9 rounded-md border border-slate-300 px-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !turnstileToken}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium flex items-center justify-center"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Sign in'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 text-center">
          <a href="/reset-password" className="text-sm text-blue-600 underline">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  )
}
