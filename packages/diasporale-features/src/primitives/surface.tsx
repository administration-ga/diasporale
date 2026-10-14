import type { ComponentProps } from "react"

import { cn } from "../lib/cn"
import { avatarTone, initials } from "../lib/avatar"

/** Carte de la charte : papier sur sable, filet chaud, ombre de 1 à 2 px. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-card", className)}
      {...props}
    />
  )
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}

export function Separator({ className, ...props }: ComponentProps<"hr">) {
  return <hr data-slot="separator" className={cn("border-0 border-t border-border", className)} {...props} />
}

const TONE_CLASSES: Record<number, string> = {
  1: "bg-avatar-1",
  2: "bg-avatar-2",
  3: "bg-avatar-3",
  4: "bg-avatar-4",
  5: "bg-avatar-5",
  6: "bg-avatar-6",
}

const SIZE_CLASSES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const

/**
 * Avatar à initiales : teinte stable par identifiant (jamais par le nom), une
 * des six teintes de la charte, initiales en blanc (≥ 5,07:1 sur chacune).
 * `shape="square"` pour une page (organisation), rond pour une personne.
 */
export function Avatar(props: {
  id: string
  name: string
  size?: keyof typeof SIZE_CLASSES
  shape?: "round" | "square"
  className?: string
}) {
  const tone = avatarTone(props.id)
  return (
    <span
      aria-hidden
      data-slot="avatar"
      className={cn(
        "inline-grid shrink-0 select-none place-items-center font-semibold text-avatar-foreground",
        TONE_CLASSES[tone],
        SIZE_CLASSES[props.size ?? "md"],
        props.shape === "square" ? "rounded-lg" : "rounded-full",
        props.className,
      )}
    >
      {initials(props.name)}
    </span>
  )
}
