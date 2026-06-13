'use client'

import React, { ReactNode, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

// px gap between the anchor edge and the tooltip bubble
const GAP = 8

type Position = 'top' | 'bottom' | 'left' | 'right'

interface AnchorGeometry {
  /** Fixed top/left to place the outer positioning shell */
  top: number
  left: number
  /** CSS transform on the outer shell to centre the tooltip relative to the anchor */
  outerTransform: string
  position: Position
}

function computeAnchorGeometry(rect: DOMRect, position: Position): AnchorGeometry {
  const midX = rect.left + rect.width / 2
  const midY = rect.top + rect.height / 2

  switch (position) {
    case 'right':
      return { top: midY, left: rect.right + GAP, outerTransform: 'translateY(-50%)', position }
    case 'left':
      return { top: midY, left: rect.left - GAP, outerTransform: 'translate(-100%, -50%)', position }
    case 'bottom':
      return { top: rect.bottom + GAP, left: midX, outerTransform: 'translateX(-50%)', position }
    case 'top':
    default:
      return { top: rect.top - GAP, left: midX, outerTransform: 'translate(-50%, -100%)', position }
  }
}

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: Position
  /** Always show the tooltip regardless of hover state (e.g. validation errors) */
  forceOpen?: boolean
  variant?: 'default' | 'warning'
  className?: string
}

export function Tooltip({
  content,
  children,
  position = 'top',
  forceOpen = false,
  variant = 'default',
  className,
}: TooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [geometry, setGeometry] = useState<AnchorGeometry | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Mount portal only on the client to avoid SSR mismatch
  useEffect(() => {
    const timer = setTimeout(() => setPortalReady(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const updateGeometry = useCallback(() => {
    if (wrapperRef.current) {
      setGeometry(computeAnchorGeometry(wrapperRef.current.getBoundingClientRect(), position))
    }
  }, [position])

  // Recompute when forceOpen activates (no hover event fires)
  useEffect(() => {
    if (forceOpen) updateGeometry()
  }, [forceOpen, updateGeometry])

  if (!content) return <>{children}</>

  const visible = portalReady && (hovered || forceOpen) && geometry !== null

  const themeStyle = (
    variant === 'warning'
      ? {
          '--tooltip-bg': 'var(--color-warning-bg)',
          '--tooltip-text': 'var(--color-warning-text)',
          '--tooltip-border': 'var(--color-warning-border)',
        }
      : {
          '--tooltip-bg': 'var(--color-text-primary)',
          '--tooltip-text': 'var(--color-text-inverse)',
          '--tooltip-border': 'transparent',
        }
  ) as React.CSSProperties

  return (
    <>
      <div
        ref={wrapperRef}
        className={cn('relative', className)}
        onMouseEnter={() => { updateGeometry(); setHovered(true) }}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </div>

      {visible && geometry && createPortal(
        /*
         * Two-element structure keeps the two transforms from conflicting:
         *   outer  — fixed positioning shell (top/left + centering transform, no animation)
         *   inner  — visible bubble (animate-tooltip-show applies scale/opacity only)
         *
         * data-tooltip-position drives transform-origin via CSS so the bubble always
         * appears to grow outward from the anchor icon.
         */
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{
            top: geometry.top,
            left: geometry.left,
            transform: geometry.outerTransform,
          }}
        >
          <div
            data-tooltip-position={geometry.position}
            className="animate-tooltip-show px-3 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap"
            style={{
              ...themeStyle,
              background: 'var(--tooltip-bg)',
              color: 'var(--tooltip-text)',
              border: '1px solid var(--tooltip-border)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {content}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
