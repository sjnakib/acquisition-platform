import { BRAND } from '@/lib/brand'

interface BrandLogoProps {
  variant?: 'icon' | 'wordmark' | 'full'
  className?: string
}

function BuildingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color: 'var(--accent)' }}
    >
      <path
        d="M16 2L2 18h3v12h22V18h3L16 2z"
        fill="currentColor"
      />
      <rect x="13" y="20" width="6" height="10" rx="1" fill="currentColor" opacity="0.35" />
    </svg>
  )
}

export function BrandLogo({ variant = 'full', className = '' }: BrandLogoProps) {
  if (variant === 'icon') {
    return (
      <BuildingMark className={`h-5 w-5 ${className}`} />
    )
  }

  if (variant === 'wordmark') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <BuildingMark className="h-5 w-5 shrink-0" />
        <span className="text-[15px] font-medium leading-none" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {BRAND.name}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BuildingMark className="h-6 w-6 shrink-0" />
      <div className="flex flex-col">
        <span className="text-[18px] font-medium leading-tight" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {BRAND.name}
        </span>
        <span className="text-[9px] uppercase tracking-[0.12em] leading-tight" style={{ color: 'var(--color-text-tertiary)' }}>
          {BRAND.tagline}
        </span>
      </div>
    </div>
  )
}
