import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-[6px] py-[2px] rounded-full text-[11px] font-medium whitespace-nowrap border transition-colors",
  {
    variants: {
      variant: {
        success: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
        warning: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
        danger: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
        info: "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
        neutral: "border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]",
        accent: "border-[var(--color-accent-light)] bg-[var(--color-accent-bg)] text-[var(--color-accent-muted)]",
        "score-vg": "border-[var(--color-score-vg-border)] bg-[var(--color-score-vg-bg)] text-[var(--color-score-vg-text)]",
        "score-g": "border-[var(--color-score-g-border)] bg-[var(--color-score-g-bg)] text-[var(--color-score-g-text)]",
        "score-b": "border-[var(--color-score-b-border)] bg-[var(--color-score-b-bg)] text-[var(--color-score-b-text)]",
        "score-vb": "border-[var(--color-score-vb-border)] bg-[var(--color-score-vb-bg)] text-[var(--color-score-vb-text)]",
      },
      size: {
        sm: "text-[10px] px-[4px] py-px",
        md: "",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0"
          style={{ backgroundColor: 'currentColor' }}
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
