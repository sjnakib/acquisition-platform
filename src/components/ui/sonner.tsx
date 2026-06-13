"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function getTheme(): "light" | "dark" | "system" {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem("acq_theme")
    return stored === "dark" ? "dark" : stored === "light" ? "light" : "system"
  } catch {
    return "light"
  }
}

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={getTheme() as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--color-surface-0)] group-[.toaster]:text-[var(--color-text-primary)] group-[.toaster]:border-[var(--color-surface-3)] group-[.toaster]:shadow-[var(--shadow-lg)] group-[.toaster]:rounded-[var(--radius-lg)] group-[.toaster]:font-dm-sans group-[.toaster]:text-[13px]",
          description: "group-[.toast]:text-[var(--color-text-tertiary)]",
          ...toastOptions?.classNames,
        },
        style: {
          ...toastOptions?.style,
        },
        actionButtonStyle: {
          background: "var(--color-accent)",
          color: "var(--color-text-inverse)",
          fontWeight: "600",
          fontSize: "12px",
          borderRadius: "var(--radius-md)",
          padding: "6px 10px",
          fontFamily: "var(--font-dm-sans)",
          transition: "background-color 0.2s ease, opacity 0.2s ease",
          ...toastOptions?.actionButtonStyle,
        },
        cancelButtonStyle: {
          background: "var(--color-surface-2)",
          color: "var(--color-text-secondary)",
          fontWeight: "500",
          fontSize: "12px",
          borderRadius: "var(--radius-md)",
          padding: "6px 10px",
          fontFamily: "var(--font-dm-sans)",
          transition: "background-color 0.2s ease, opacity 0.2s ease",
          ...toastOptions?.cancelButtonStyle,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
