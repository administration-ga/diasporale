import { Switch as SwitchPrimitive } from "radix-ui"
import type { ComponentProps } from "react"

import { cn } from "../lib/cn"

/** Interrupteur (préférences, consentements dans les paramètres). */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-input bg-[var(--ink-200)] p-0.5 transition-colors duration-150 ease-charte focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55 data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-6 rounded-full bg-card shadow-card transition-transform duration-150 ease-charte data-[state=checked]:translate-x-5"
      />
    </SwitchPrimitive.Root>
  )
}
