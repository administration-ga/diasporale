import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

/**
 * Bouton de la charte DIASPORALE — API shadcn (variant, size, asChild) pour
 * que le passage aux primitives du moteur (`@antia/ui`, PA6) ne change aucun
 * appel. Cible de 44 px par défaut (cahier EXT-DG-05) ; `sm` (36 px) est
 * réservé aux actions secondaires en ligne, espacées d'au moins 8 px.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,color,box-shadow] duration-150 ease-charte select-none disabled:pointer-events-none disabled:opacity-55 focus-visible:shadow-focus [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-[var(--primary-fill-hover)]",
        secondary: "bg-accent text-accent-foreground hover:bg-[var(--ink-200)]",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-[var(--danger-fill-hover)]",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[15px]",
        lg: "h-12 px-5 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
)

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Rendre l'enfant (lien) avec l'apparence du bouton. */
    asChild?: boolean
  }

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button"
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  )
}
