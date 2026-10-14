import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />
}

/**
 * Option en carte : toute la carte est la cible (44 px au moins), l'état choisi
 * se lit par le contour ET par la pastille (jamais par la seule couleur).
 */
export function RadioCard({ className, children, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      className={cn(
        "group flex min-h-11 w-full items-center gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-left transition-[border-color,box-shadow,background-color] duration-150 ease-charte hover:bg-muted focus-visible:shadow-focus data-[state=checked]:border-primary data-[state=checked]:bg-[var(--primary-50)]",
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
