"use client"

/**
 * Le menu « … » de la fiche d'un objet de DIASPORALE — profil d'autrui (RP-02), page
 * (AS-02) : les gestes secondaires, jamais un bouton plein, pour qu'un seul bouton plein
 * reste visible dans la zone. Radix : ouverture au clavier, flèches, Échap rend le
 * focus au déclencheur ; cible de 44 px.
 */
import { cn } from "@diasporale/features"
import { MoreHorizontalIcon, type LucideIcon } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import type { ReactNode } from "react"

export function ObjectMenu(props: { readonly label: string; readonly children: ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={props.label}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus"
      >
        <MoreHorizontalIcon className="size-5" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={12} className="z-60 min-w-60 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-float">
          {props.children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function ObjectMenuItem(props: { readonly icon: LucideIcon; readonly tone?: "danger"; readonly onSelect: () => void; readonly children: ReactNode }) {
  const Icon = props.icon
  return (
    <DropdownMenu.Item
      onSelect={props.onSelect}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none data-[highlighted]:bg-muted",
        props.tone === "danger" && "text-destructive",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {props.children}
    </DropdownMenu.Item>
  )
}
