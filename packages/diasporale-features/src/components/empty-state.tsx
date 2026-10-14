import type { ReactNode } from "react"

import { cn } from "../lib/cn"

/**
 * État vide GÉNÉRATIF (P5) : ce qui manque, puis l'action qui le comble.
 * Jamais un écran muet — l'appelant fournit toujours un titre et, quand la
 * personne peut agir, une action.
 */
export function EmptyState(props: {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--ink-300)] bg-card/60 px-6 py-10 text-center",
        props.className,
      )}
    >
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-tag text-tag-code [&_svg]:size-6">
        {props.icon}
      </span>
      <p className="font-display text-lg font-bold leading-snug">{props.title}</p>
      {props.description ? <p className="max-w-prose text-sm text-muted-foreground">{props.description}</p> : null}
      {props.action ? <div className="mt-1">{props.action}</div> : null}
    </div>
  )
}
