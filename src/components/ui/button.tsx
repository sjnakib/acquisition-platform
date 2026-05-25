import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
 "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 ease-[var(--ease-spring,cubic-bezier(0.34,1.56,0.64,1))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-0 active:scale-[0.97]",
 {
 variants: {
 variant: {
 default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/95 hover:-translate-y-[1px] hover:shadow-md",
 destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/95 hover:-translate-y-[1px] hover:shadow-md",
 outline: "border border-input bg-transparent shadow-sm hover:bg-muted hover:border-primary/20 hover:-translate-y-[1px]",
 secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 hover:-translate-y-[1px]",
 ghost: "bg-transparent hover:bg-muted active:scale-[0.98]",
 link: "underline-offset-4 hover:underline text-primary",
 },
 size: {
 default: "h-[34px] px-[14px] text-[13px]",
 sm: "h-[28px] px-[10px] text-[12px]",
 lg: "h-10 px-[18px] text-[14px]",
 icon: "h-[34px] w-[34px]",
 },
 },
 defaultVariants: {
 variant: "default",
 size: "default",
 },
 }
)

export interface ButtonProps
 extends React.ButtonHTMLAttributes<HTMLButtonElement>,
 VariantProps<typeof buttonVariants> {
 asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
 ({ className, variant, size, asChild = false, ...props }, ref) => {
 const Comp = asChild ? Slot : "button"
 return (
 <Comp
 className={cn(buttonVariants({ variant, size, className }))}
 ref={ref}
 {...props}
 />
 )
 }
)
Button.displayName = "Button"

export { Button, buttonVariants }
