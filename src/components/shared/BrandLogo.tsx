'use client'

import Link from 'next/link'
import { BRAND } from '@/lib/brand'

interface BrandLogoProps {
  variant?: 'icon' | 'wordmark' | 'full'
  className?: string
  disableLink?: boolean
}

// ----------------------------------------------------
// 1. PREMIUM ARCHITECTURAL SVG MARK
// ----------------------------------------------------
function BuildingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-all duration-300 hover:scale-105 active:scale-98`}
      style={{ filter: 'drop-shadow(0 0 6px rgba(30,191,115,0.15))' }}
    >
      <defs>
        {/* Dynamic, linear gradients matching theme colors */}
        <linearGradient id="glow-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="50%" stopColor="var(--color-accent-light)" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="glow-grad-secondary" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(16,185,129,0.15)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        
        {/* Embedded micro-animation stylesheet for glowing sweep line effect */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes sweep-animation {
            0% { transform: translateY(-20px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            100% { transform: translateY(22px); opacity: 0; }
          }
          .logo-sweep-line {
            animation: sweep-animation 3.5s infinite linear;
          }
        `}} />
      </defs>
      
      {/* Background soft shadow guide */}
      <circle cx="16" cy="16" r="14" fill="url(#glow-grad-secondary)" opacity="0.05" />
      
      {/* Structural multi-layered Skyscraper Mark representing "A" */}
      {/* Back layer */}
      <path
        d="M16 2L3 28h5.5l7.5-15 7.5 15H29L16 2z"
        fill="url(#glow-grad-primary)"
        opacity="0.9"
        style={{ transition: 'all 0.3s ease' }}
      />
      
      {/* Glass analytical front layer overlay (Forms "A" belt & visual depth) */}
      <path
        d="M16 9l-4.8 9.6h9.6L16 9z"
        fill="url(#glow-grad-secondary)"
        opacity="0.8"
      />
      
      {/* Micro-scale structural accents */}
      <rect x="14" y="24" width="4" height="6" rx="0.5" fill="var(--color-text-inverse)" opacity="0.95" />
      <circle cx="16" cy="15" r="1.5" fill="var(--color-text-inverse)" opacity="0.95" />
      
      {/* Scanning laser sweep line */}
      <line
        x1="4"
        y1="10"
        x2="28"
        y2="10"
        stroke="#4AF626"
        strokeWidth="0.75"
        className="logo-sweep-line"
        style={{ filter: 'drop-shadow(0 0 2px #4AF626)' }}
      />
    </svg>
  )
}

// ----------------------------------------------------
// 2. MAIN BRAND LOGO COMPONENT
// ----------------------------------------------------
export function BrandLogo({ variant = 'full', className = '', disableLink = false }: BrandLogoProps) {
  const renderLogoBody = () => {
    if (variant === 'icon') {
      return <BuildingMark className={`h-6 w-6 ${className}`} />
    }

    if (variant === 'wordmark') {
      return (
        <div className={`flex items-center gap-2.5 ${className}`}>
          <BuildingMark className="h-6 w-6 shrink-0" />
          <span
            className="text-[16px] font-semibold leading-none tracking-tight transition-all duration-300 hover:tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {BRAND.name}
          </span>
        </div>
      )
    }

    // Default Full variant with taglines
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <BuildingMark className="h-7 w-7 shrink-0" />
        <div className="flex flex-col text-left">
          <span
            className="text-[18px] font-semibold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {BRAND.name}
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] leading-tight font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
            {BRAND.tagline}
          </span>
        </div>
      </div>
    )
  }

  if (disableLink) {
    return (
      <div className="select-none inline-block">
        {renderLogoBody()}
      </div>
    )
  }

  return (
    <Link href="/projects" className="select-none inline-block focus-visible:outline-none">
      {renderLogoBody()}
    </Link>
  )
}
