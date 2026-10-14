"use client"

import { Tabs as TabsPrimitive } from "radix-ui"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "../lib/cn"

/**
 * Onglets « chemise » — repris du squelette de l'espace agent (charte §8) :
 * languettes sur une piste en pilule, l'onglet actif en papier sur le sable.
 *
 * Deux usages, deux sémantiques, jamais confondues :
 *   · `FolderTabsNav` — des LIENS (portées du fil, volets) : `nav` +
 *     `aria-current="page"`, chaque onglet a son adresse ;
 *   · `FolderTabs*` — des PANNEAUX d'une même page (hub pays) : motif ARIA
 *     `tablist` de Radix (flèches, Début/Fin, activation au focus).
 */
const trackClass =
  "flex w-full gap-1 overflow-x-auto rounded-[var(--esp-r-chrome)] bg-[var(--esp-neutral-chip)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
const tabClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[var(--esp-r-chrome)] px-4 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-150 ease-charte hover:text-foreground focus-visible:shadow-focus"
const activeClass = "bg-card text-[var(--primary-700)] shadow-card"

export interface FolderNavItem {
  readonly id: string
  readonly label: ReactNode
  readonly href: string
  readonly active: boolean
  readonly icon?: ReactNode
}

export function FolderTabsNav(props: {
  label: string
  items: readonly FolderNavItem[]
  renderLink: (item: FolderNavItem, className: string, children: ReactNode) => ReactNode
  className?: string
}) {
  return (
    <nav aria-label={props.label} className={cn(trackClass, props.className)}>
      {props.items.map((item) =>
        props.renderLink(
          item,
          cn(tabClass, item.active && activeClass),
          <>
            {item.icon}
            {item.label}
          </>,
        ),
      )}
    </nav>
  )
}

export const FolderTabs = TabsPrimitive.Root

export function FolderTabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="folder-tabs-list" className={cn(trackClass, className)} {...props} />
}

export function FolderTabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="folder-tabs-trigger"
      className={cn(tabClass, "data-[state=active]:bg-card data-[state=active]:text-[var(--primary-700)] data-[state=active]:shadow-card", className)}
      {...props}
    />
  )
}

export function FolderTabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="folder-tabs-content" className={cn("mt-4 focus-visible:outline-none", className)} {...props} />
  )
}
