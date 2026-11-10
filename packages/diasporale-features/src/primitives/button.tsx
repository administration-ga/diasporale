import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

/**
 * Bouton de la charte DIASPORALE — API shadcn (variant, size, asChild) pour
 * que le passage aux primitives du moteur (`@antsia/ui`, PA6) ne change aucun
 * appel. Cible de 44 px par défaut (cahier EXT-DG-05) ; `sm` (36 px) est
 * réservé aux actions secondaires en ligne, espacées d'au moins 8 px.
 *
 * Charte v4 (maquette « sept thèmes ») : une pilule sans contour, la couleur
 * suffit, et une couleur par famille d'actions :
 *   · `primary` — publier, l'action principale (aplat d'identité) ;
 *   · `social` — suivre, se relier ;
 *   · `message` — écrire (tonal) ; `send` — envoyer un message (aplat) ;
 *   · `react` — réagir ; `commerce` — participer, acheter, candidater ;
 *   · `success` — valider, accepter ; `destructive` — supprimer ;
 *   · `secondary` — action d'identité secondaire (tonal) ;
 *   · `outline` — le bouton neutre (Annuler) : le creux, gris, sans filet ;
 *   · `ghost` — transparent ; `link` — lien souligné.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-[background-color,color,box-shadow] duration-150 ease-charte select-none disabled:pointer-events-none disabled:opacity-55 focus-visible:shadow-focus [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        primary: "bg-primary-fill text-primary-on hover:bg-primary-fill-hover",
        social: "bg-social-fill text-social-on hover:bg-social-fill-hover",
        message: "bg-message-soft text-message-ink hover:bg-message-soft-hover",
        send: "bg-message-fill text-message-on hover:bg-message-fill-hover",
        react: "bg-react-fill text-react-on hover:bg-react-fill-hover",
        commerce: "bg-commerce-fill text-commerce-on hover:bg-commerce-fill-hover",
        success: "bg-success-fill text-success-on hover:bg-success-fill-hover",
        destructive: "bg-danger-fill text-danger-on hover:bg-danger-fill-hover",
        secondary: "bg-primary-soft text-primary hover:bg-primary-soft-hover",
        outline: "bg-neutral text-foreground hover:bg-neutral-hover",
        ghost: "text-foreground hover:bg-muted",
        link: "h-auto px-0 text-primary underline decoration-1 underline-offset-[3px] hover:decoration-2",
      },
      size: {
        sm: "h-9 px-[13px] text-[13px] [&_svg:not([class*='size-'])]:size-4",
        md: "h-11 px-[18px] text-sm",
        lg: "h-12 px-[22px] text-[15px]",
        icon: "size-11",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
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
