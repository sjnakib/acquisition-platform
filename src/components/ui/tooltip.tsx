import React, { ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  forceOpen?: boolean
  variant?: 'default' | 'warning'
}

export function Tooltip({ content, children, position = 'top', forceOpen = false, variant = 'default' }: TooltipProps) {
  if (!content) return <>{children}</>

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--tooltip-bg)] border-[4px] border-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--tooltip-bg)] border-[4px] border-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--tooltip-bg)] border-[4px] border-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--tooltip-bg)] border-[4px] border-transparent',
  }

  const styles = variant === 'warning' ? {
    '--tooltip-bg': 'var(--color-warning-bg)',
    '--tooltip-text': 'var(--color-warning-text)',
    '--tooltip-border': 'var(--color-warning-border)',
  } as React.CSSProperties : {
    '--tooltip-bg': 'var(--color-text-primary)',
    '--tooltip-text': 'var(--color-text-inverse)',
    '--tooltip-border': 'var(--color-surface-3)',
  } as React.CSSProperties

  const visibilityClasses = forceOpen 
    ? 'opacity-100 scale-100'
    : 'opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-95'

  return (
    <div className="relative group inline-block">
      {children}
      <div
        className={`pointer-events-none absolute ${positionClasses[position]} px-3 py-1.5 text-[11px] font-medium rounded-md shadow-md whitespace-nowrap z-50 transition-all duration-150 ${visibilityClasses}`}
        style={{
          ...styles,
          background: 'var(--tooltip-bg)',
          color: 'var(--tooltip-text)',
          border: '1px solid var(--tooltip-border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {content}
        <div className={`absolute ${arrowClasses[position]}`} />
      </div>
    </div>
  )
}
