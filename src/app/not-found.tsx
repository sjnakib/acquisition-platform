'use client'

import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Home, LogIn } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'

export default function NotFound() {
  const router = useRouter()
  const { data: user, isLoading } = useAuth()

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden select-none w-full"
      style={{ background: 'var(--color-canvas)' }}
    >
      {/* Dynamic Background Glassmorphism Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .glass-404-card {
          backdrop-filter: blur(20px) saturate(110%);
          -webkit-backdrop-filter: blur(20px) saturate(110%);
          background: rgba(255, 255, 255, 0.45);
          border: 1px solid rgba(30, 91, 63, 0.08);
          box-shadow: var(--shadow-xl), 0 0 45px rgba(30, 91, 63, 0.05);
        }
        .dark .glass-404-card {
          background: rgba(25, 25, 24, 0.55);
          border: 1px solid rgba(72, 163, 117, 0.06);
          box-shadow: var(--shadow-xl), 0 0 45px rgba(72, 163, 117, 0.04);
        }
      `}} />

      <div
        className="w-full max-w-[420px] rounded-2xl p-8 max-sm:p-6 glass-404-card text-center animate-card-entrance flex flex-col items-center"
      >
        {/* Brand Logo */}
        <div
          className="mb-8 animate-item-entrance"
          style={{ animationDelay: '80ms' }}
        >
          <BrandLogo variant="full" disableLink />
        </div>

        {/* 404 Heading */}
        <h1
          className="text-8xl font-bold tracking-tight mb-2 animate-item-entrance select-none"
          style={{
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-display)',
            animationDelay: '140ms',
            textShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
          }}
        >
          404
        </h1>

        {/* Page title / subtitle */}
        <h2
          className="text-lg font-semibold mb-3 animate-item-entrance"
          style={{
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-dm-sans)',
            animationDelay: '200ms',
          }}
        >
          Page does not exist
        </h2>

        <p
          className="text-[13px] leading-relaxed mb-8 max-w-[280px] mx-auto animate-item-entrance"
          style={{
            color: 'var(--color-text-secondary)',
            animationDelay: '260ms',
          }}
        >
          The page you are looking for doesn&apos;t exist or has been moved to another stage.
        </p>

        {/* Action Buttons */}
        <div
          className="flex flex-col sm:flex-row gap-3 w-full animate-item-entrance"
          style={{ animationDelay: '320ms' }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="flex-1 font-semibold h-10 text-xs gap-1.5 transition-all duration-200 hover:bg-[var(--color-surface-1)] active:scale-98"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go Back
          </Button>

          {isLoading ? (
            <Button
              disabled
              className="flex-1 font-semibold h-10 text-xs gap-1.5 transition-all duration-200 active:scale-98"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-tertiary)' }}
            >
              Loading...
            </Button>
          ) : !user ? (
            <Button
              asChild
              className="flex-1 font-semibold h-10 text-xs gap-1.5 transition-all duration-200 active:scale-98"
              style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
            >
              <Link href="/login">
                <LogIn className="h-3.5 w-3.5" />
                Return to Login
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className="flex-1 font-semibold h-10 text-xs gap-1.5 transition-all duration-200 active:scale-98"
              style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
            >
              <Link href="/projects">
                <Home className="h-3.5 w-3.5" />
                Projects Hub
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
