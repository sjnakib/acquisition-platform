"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
 const { theme = "system" } = useTheme()

 return (
 <Sonner
 theme={theme as ToasterProps["theme"]}
 className="toaster group"
 toastOptions={{
 classNames: {
 toast:
 "group toast group-[.toaster]: group-[.toaster]: group-[.toaster]: group-[.toaster]:shadow-lg",
 description: "group-[.toast]:",
 actionButton:
 "group-[.toast]:bg-primary group-[.toast]:-foreground",
 cancelButton:
 "group-[.toast]: group-[.toast]:",
 },
 }}
 {...props}
 />
 )
}

export { Toaster }
