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
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-semibold group-[.toast]:text-[11px] group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 transition-colors hover:opacity-90",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          ...toastOptions?.classNames,
        },
        style: {
          ...toastOptions?.style,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
