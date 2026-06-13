'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

// ── Tab Active Context (for keepMounted tabs) ────────────────────────────

const TabActiveContext = React.createContext<boolean>(true)

/**
 * Hook for child components rendered inside a <TabsContent>.
 * Returns `true` when the parent tab is currently active.
 * Useful for gating data fetching / subscriptions when tabs use `keepMounted`.
 */
export function useIsTabActive(): boolean {
  return React.useContext(TabActiveContext)
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [localValue, setLocalValue] = React.useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const activeValue = isControlled ? controlledValue : localValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setLocalValue(newValue)
      }
      if (onValueChange) {
        onValueChange(newValue)
      }
    },
    [isControlled, onValueChange]
  )

  const contextValue = React.useMemo(
    () => ({
      value: activeValue,
      onValueChange: handleValueChange,
    }),
    [activeValue, handleValueChange]
  )

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export type TabsListProps = React.HTMLAttributes<HTMLDivElement>

export function TabsList({ className, children, ...props }: TabsListProps) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('TabsList must be used within a Tabs component')
  }

  const listRef = React.useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState<{ left: number; width: number } | null>(null)

  React.useEffect(() => {
    const listEl = listRef.current
    if (!listEl) return

    const updateIndicator = () => {
      const activeTrigger = listEl.querySelector('[data-state="active"]') as HTMLButtonElement | null
      if (!activeTrigger) {
        setIndicatorStyle(null)
        return
      }
      setIndicatorStyle({
        left: activeTrigger.offsetLeft,
        width: activeTrigger.offsetWidth,
      })
    }

    // Run initially to position the active line
    updateIndicator()

    // Setup ResizeObserver to recalibrate on parent container size shifts
    const observer = new ResizeObserver(updateIndicator)
    observer.observe(listEl)
    
    // Also track individual trigger size boundaries to handle font scaling/state switches
    const triggers = listEl.querySelectorAll('[data-state]')
    triggers.forEach((t) => observer.observe(t))

    return () => {
      observer.disconnect()
    }
  }, [context.value])

  return (
    <div
      ref={listRef}
      className={cn(
        'relative flex items-center gap-1 border-b overflow-x-auto select-none',
        className
      )}
      style={{ borderColor: 'var(--color-surface-2)' }}
      {...props}
    >
      {children}
      
      {/* Dynamic, Hardware-Accelerated Sliding Indicator Underline */}
      {indicatorStyle && (
        <div
          className="absolute bottom-0 h-[2px] bg-[var(--accent)] pointer-events-none"
          style={{
            left: 0,
            width: `${indicatorStyle.width}px`,
            transform: `translateX(${indicatorStyle.left}px)`,
            transition: 'transform 220ms var(--ease-premium), width 220ms var(--ease-premium)',
          }}
        />
      )}
    </div>
  )
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('TabsTrigger must be used within a Tabs component')
  }

  const isActive = context.value === value

  return (
    <button
      type="button"
      onClick={() => context.onValueChange(value)}
      data-state={isActive ? 'active' : 'inactive'}
      className={cn(
        'relative pb-3 pt-1 px-3 text-sm font-medium transition-colors duration-200 whitespace-nowrap cursor-pointer focus-visible:outline-none focus:outline-none',
        isActive
          ? 'text-[var(--accent)] font-semibold'
          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  /** When true, inactive tabs are hidden with CSS instead of being unmounted.
   *  Preserves component state, TanStack Query caches, and local UI state
   *  across tab switches. Default: false (original unmount behavior). */
  keepMounted?: boolean
}

export function TabsContent({
  value,
  keepMounted,
  className,
  children,
  ...props
}: TabsContentProps) {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('TabsContent must be used within a Tabs component')
  }

  const isActive = context.value === value

  // Track first activation so entrance animation only plays once
  const [hasBeenActive, setHasBeenActive] = React.useState(false)
  const shouldAnimate = isActive && !hasBeenActive

  React.useEffect(() => {
    if (isActive && !hasBeenActive) {
      const timer = setTimeout(() => setHasBeenActive(true), 0)
      return () => clearTimeout(timer)
    }
  }, [isActive, hasBeenActive])

  // Original behavior: unmount when inactive (keepMounted not set)
  if (!isActive && !keepMounted) return null

  return (
    <TabActiveContext.Provider value={isActive}>
      <div
        className={cn(
          'w-full h-full',
          !isActive && 'hidden',
          shouldAnimate && 'animate-tab-entrance',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TabActiveContext.Provider>
  )
}
