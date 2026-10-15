import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />
}

/**
 * Option en carte : toute la carte est la cible (44 px au moins). Aucun contour
 * (charte v3.2) : l'option est un aplat ; choisie, elle prend la teinte de
 * sélection, qui se lève au-dessus de la carte en sombre, et sa pastille se
 * remplit — l'état ne repose jamais sur la seule couleur.
 */
export function RadioCard({ className, children, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      className={cn(
        "group flex min-h-11 w-full items-center gap-3 rounded-md bg-muted px-3.5 py-2.5 text-left transition-[box-shadow,background-color] duration-150 ease-charte focus-visible:shadow-focus data-[state=unchecked]:hover:bg-[var(--esp-neutral-chip)] data-[state=checked]:bg-[var(--primary-50)]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="grid size-5 shrink-0 place-items-center rounded-full border border-input bg-card group-data-[state=checked]:border-primary"
      >
        <span className="size-2.5 rounded-full bg-primary opacity-0 transition-opacity duration-150 group-data-[state=checked]:opacity-100" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </RadioGroupPrimitive.Item>
  )
}
