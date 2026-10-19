"use client"

/**
 * Briques partagées des écrans de gestion des pages (DG-008). PROPRIÉTAIRE :
 * chantier « gestion des pages ». Présentation seulement : les droits sont
 * relus par le fournisseur (moteur ou démonstration), jamais déduits ici.
 */
import { Button, EmptyState, Sheet, SheetContent } from "@diasporale/features"
import { usePageAdmin, type ActionErrorCode, type ManagedPageRole, type PageClaimStatus, type PageManagement } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BadgeCheckIcon, CircleSlashIcon, ClockIcon, ShieldIcon, UndoIcon, UnplugIcon, type LucideIcon } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

/** La gestion des pages du fournisseur, ou `null` : l'écran dit alors « indisponible ». */
export function usePageManagement(): PageManagement | null {
  return usePageAdmin()?.management ?? null
}

export function PageAdminUnavailable() {
  const { t } = useDiasporaleT()
  return <EmptyState icon={<UnplugIcon />} title={t("pageAdmin.unavailable.title")} description={t("pageAdmin.unavailable.body")} />
}

/** Un refus traduit (`errors.<code>`), annoncé. */
export function ErrorNotice(props: { readonly code: ActionErrorCode | string; readonly className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <p role="alert" className={props.className ?? "text-sm text-destructive"}>
      {t(`errors.${props.code}`)}
    </p>
  )
}

const STATUS_ICONS: Readonly<Record<PageClaimStatus, LucideIcon>> = {
  pending: ClockIcon,
  approved: BadgeCheckIcon,
  rejected: CircleSlashIcon,
  withdrawn: UndoIcon,
}

/** L'état d'une revendication : une icône ET un libellé, jamais la seule couleur. */
export function ClaimStatusChip(props: { readonly status: PageClaimStatus }) {
  const { t } = useDiasporaleT()
  const Icon = STATUS_ICONS[props.status]
  return (
    <span data-claim-status={props.status} className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--esp-neutral-chip)] px-2.5 text-xs font-semibold">
      <Icon aria-hidden className="size-4" />
      {t(`pageAdmin.claimStatus.${props.status}`)}
    </span>
  )
}

export function RoleChip(props: { readonly role: ManagedPageRole }) {
  const { t } = useDiasporaleT()
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--esp-neutral-chip)] px-2 text-[11px] font-semibold">
      <ShieldIcon aria-hidden className="size-3.5" />
      {t(`pageAdmin.role.${props.role}`)}
    </span>
  )
}

/**
 * Confirmation d'un geste qui retire quelque chose (un signataire, une
 * demande) : titre et conséquence dits, double clic sans effet.
 */
export function ConfirmSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly body: string
  readonly confirm: string
  readonly onConfirm: () => Promise<boolean>
  readonly children?: ReactNode
}) {
  const { t } = useDiasporaleT()
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  return (
    <Sheet open={props.open} onOpenChange={(open) => { if (!running.current) props.onOpenChange(open) }}>
      <SheetContent title={props.title} description={props.body} closeLabel={t("common.close")}>
        {props.children}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => props.onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (running.current) return
              running.current = true
              setBusy(true)
              try {
                if (await props.onConfirm()) props.onOpenChange(false)
              } finally {
                running.current = false
                setBusy(false)
              }
            }}
          >
            {busy ? t("common.pleaseWait") : props.confirm}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Le nom PUBLIÉ d'une personne, ou un nom neutre si son profil est retiré (jamais un identifiant interne). */
export function usePersonLabel() {
  const { t } = useDiasporaleT()
  return (person: { readonly displayName: string | null; readonly handle: string | null }) => person.displayName ?? t("pageAdmin.team.neutralName")
}
