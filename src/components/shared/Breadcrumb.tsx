'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null

  return (
    <nav
      className="flex items-center gap-0.5 text-[13px] mb-1"
      style={{ fontFamily: 'var(--font-dm-sans)' }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1

        if (isLast || !item.href) {
          return (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 flex-shrink-0"
                  style={{ color: 'var(--color-text-tertiary)', opacity: 0.5 }}
                />
              )}
              <span
                className="px-1.5 py-0.5 rounded-md font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {item.label}
              </span>
            </span>
          )
        }

        return (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: 'var(--color-text-tertiary)', opacity: 0.5 }}
              />
            )}
            <Link
              href={item.href}
              className="px-1.5 py-0.5 rounded-md transition-all duration-150 no-underline"
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-2)'
                e.currentTarget.style.color = 'var(--color-text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-tertiary)'
              }}
            >
              {item.label}
            </Link>
          </span>
        )
      })}
    </nav>
  )
}
