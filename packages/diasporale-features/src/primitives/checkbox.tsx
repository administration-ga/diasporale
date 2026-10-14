import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

/**
 * Case à cocher. Elle naît TOUJOURS décochée : l'appelant ne passe jamais
 * `defaultChecked` à `true` pour un consentement (contrat « aucune case
 * précochée », testé).
 */
export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-5 shrink-0 place-items-center rounded-[5px] border border-input bg-card transition-colors duration-150 ease-charte focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground aria-invalid:border-destructive",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator">
        <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
