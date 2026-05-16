import React from 'react'

interface PageHeaderProps {
 title: string
 description?: string
 breadcrumb?: { label: string; href?: string }[]
 actions?: React.ReactNode
}

export function PageHeader({ title, description, breadcrumb, actions }: PageHeaderProps) {
 return (
 <div
 className="flex items-end justify-between gap-4 mb-8 pb-6 border-b"
 style={{ borderColor: 'var(--color-surface-2)' }}
 >
 <div className="flex flex-col gap-1">
 {breadcrumb && breadcrumb.length > 0 && (
 <div
 className="flex items-center gap-1 text-[11px] mb-1"
 style={{ color: 'var(--color-text-tertiary)' }}
 >
 {breadcrumb.map((b, i) => (
 <React.Fragment key={b.label}>
 {i > 0 && <span className="opacity-40">/</span>}
 {b.href ? (
 <a href={b.href} className="hover:underline" style={{ color: 'var(--color-text-tertiary)' }}>
 {b.label}
 </a>
 ) : (
 <span>{b.label}</span>
 )}
 </React.Fragment>
 ))}
 </div>
 )}
 <h1
 className="text-[24px] font-semibold leading-tight"
 style={{
 color: 'var(--color-text-primary)',
 fontFamily: 'var(--font-dm-sans)',
 letterSpacing: '-0.02em',
 }}
 >
 {title}
 </h1>
 {description && (
 <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
 {description}
 </p>
 )}
 </div>
 {actions && (
 <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
 )}
 </div>
 )
}
