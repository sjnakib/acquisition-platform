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

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={getTheme() as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
