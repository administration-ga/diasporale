"use client"

import { XIcon } from "lucide-react"
import { useState, type ComponentProps, type ReactNode } from "react"

import { cn } from "../lib/cn"

/**
 * Carte flottante — la forme unique des avis de la charte v2 (§7) : modération,
 * statut d'adhésion, démonstration, consignes. Une carte posée DEVANT la page
 * (un souffle d'ombre, aucun filet ni liseré), le ton porté par la seule pastille
 * d'icône, le titre en encre. Une information n'est jamais portée par la seule
 * couleur : icône ET titre.
 *
 * `dismissLabel` présent ⇒ une croix (cible de 44 px) écarte la carte ;
 * `onDismiss` prévient l'appelant (mémoriser le choix, retirer une notification).
 * Sans `dismissLabel`, la carte reste : un marqueur bloquant ou un code à
 * recopier ne se ferme pas.
 */
export type NoticeTone = "pending" | "success" | "danger" | "info" | "demo"

const TONE_CLASSES: Record<NoticeTone, string> = {
  pending: "bg-pending text-pending-foreground",
  success: "bg-published text-published-foreground",
  danger: "bg-rejected text-rejected-foreground",
  info: "bg-[var(--info-50)] text-[var(--info-600)]",
  demo: "bg-demo text-demo-foreground",
}

export function FloatingNotice({
  tone,
  icon,
  heading,
  actions,
  dismissLabel,
  onDismiss,
  className,
  children,
  ...rest
}: Omit<ComponentProps<"div">, "title"> & {
  tone: NoticeTone
  icon: ReactNode
  heading: ReactNode
  actions?: ReactNode
  dismissLabel?: string
  onDismiss?: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div
      data-slot="floating-notice"
      data-tone={tone}
      {...rest}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-xl bg-popover p-3.5 text-left text-popover-foreground shadow-float",
        dismissLabel ? "pr-12" : null,
        className,
      )}
    >
      <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", TONE_CLASSES[tone])}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold leading-snug">{heading}</p>
        {children ? <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold">{actions}</div> : null}
      </div>
      {dismissLabel ? (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={() => {
            setDismissed(true)
            onDismiss?.()
          }}
          className="absolute right-1 top-1 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors duration-150 ease-charte hover:bg-[var(--esp-neutral-hover)] hover:text-foreground focus-visible:shadow-focus"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
