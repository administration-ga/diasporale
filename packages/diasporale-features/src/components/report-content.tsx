"use client"

/**
 * Le geste « Signaler » commun à tous les objets de DIASPORALE (G9, MD-02) — contenus
 * de la vague H, commentaire, publication de groupe ou de galerie, page, évènement,
 * profil. PROPRIÉTAIRE : chantier « confiance des surfaces » ; sorti de l'application
 * dans ce paquet par MD-02, pour servir aussi les surfaces du paquet (commentaires).
 *
 *   · `ReportContentAction` / `ReportContentButton` : le bouton (cible de 44 px) qui
 *     ouvre la feuille — le premier lit la capacité du fournisseur, le second la reçoit ;
 *   · `ReportContentSheet` : la feuille, React Hook Form + Zod — un motif FERMÉ parmi
 *     ceux du moteur, aucune saisie libre, une confirmation explicite, l'issue dite par
 *     sonner (envoyé, déjà signalé, démonstration), un refus traduit qui laisse la
 *     feuille ouverte. Pour un profil, elle dit que le réseau racine traite le dossier ;
 *   · `ReportedContent` / `ReportedContentMask` : l'avis qui remplace, pour la personne
 *     qui l'a signalé, le contenu signalé.
 *
 * Capacité absente (fournisseur qui ne la sert pas, ou brique rendue hors de
 * l'application) : ni bouton ni masque. Jamais sur son propre contenu, ni sur la page
 * que l'on administre : l'écran qui monte le geste en juge, et le moteur refuse de
 * toute façon son propre contenu. Un envoi à la fois ; rejoué, le signalement rend
 * « déjà signalé » sans rien recréer. Le focus revient au déclencheur à la fermeture ;
 * quand le contenu se masque, il passe à l'avis qui le remplace.
 */
import { zodResolver } from "@hookform/resolvers/zod"
import { FlagIcon } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { contentReportKey, reportReachesRootNetwork, type ContentReportTarget, type ContentReportsCapability } from "../data/content-reports-port"
import { useOptionalDataSource } from "../data/context"
import { ERROR_CODES, type ActionErrorCode, type ErrorCode } from "../data/errors"
import { REPORT_REASONS } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { Button } from "../primitives/button"
import { RadioCard, RadioGroup } from "../primitives/radio-group"
import { Sheet, SheetContent, SheetTrigger } from "../primitives/sheet"
import { ReportEmergencyNotice, ReportRulesLink } from "./report-guidance"

/** La capacité, ou `null` : fournisseur sans signalements, ou brique rendue hors de l'application. */
export function useOptionalContentReports(): ContentReportsCapability | null {
  return useOptionalDataSource()?.contentReports ?? null
}

/** Un code reçu qui n'est pas fermé se dit « erreur inconnue », jamais tel quel. */
function errorKey(code: string): string {
  return `errors.${ERROR_CODES.has(code as ErrorCode) ? code : "unknown"}`
}

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { message: "report_reason_required" }),
})
type ReportValues = z.infer<typeof reportSchema>

/**
 * Le masque le plus proche : la feuille lui annonce la cible qu'elle envoie (ou `null`
 * après un refus), et l'avis qui remplacera le contenu prend alors le focus.
 */
const MaskFocusContext = createContext<((key: string | null) => void) | null>(null)

/** À l'ouverture, le focus va au premier motif ; aucun n'est choisi d'avance. */
function focusFirstReason(event: Event): void {
  const container = event.currentTarget
  const first = container instanceof HTMLElement ? container.querySelector<HTMLElement>("[role=radio]") : null
  if (first === null) return
  event.preventDefault()
  first.focus()
}

// ═══════════════════════════════════════════════════════════════
// La feuille
// ═══════════════════════════════════════════════════════════════

export interface ReportContentSheetProps {
  readonly capability: ContentReportsCapability
  readonly target: ContentReportTarget
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Le déclencheur, rendu comme déclencheur de la feuille : le focus lui revient à la fermeture. */
  readonly trigger?: ReactNode
  /** Une précision propre à la nature (kit d'arrivée : un abus, pas une information périmée). */
  readonly hint?: string
}

export function ReportContentSheet(props: ReportContentSheetProps) {
  const { t } = useDiasporaleT()
  const [busy, setBusy] = useState(false)
  // Pendant l'envoi, la feuille ne se ferme pas d'un geste distrait (Échap, voile, croix).
  const change = (open: boolean) => {
    if (!open && busy) return
    props.onOpenChange(open)
  }
  // La démonstration ne promet aucun examen : rien n'est transmis à une équipe.
  const description = t(props.capability.demonstration ? "contentReports.descriptionDemo" : "contentReports.description")
  return (
    <Sheet open={props.open} onOpenChange={change}>
      {props.trigger !== undefined ? <SheetTrigger asChild>{props.trigger}</SheetTrigger> : null}
      {props.open ? (
        <SheetContent
          title={t(`contentReports.title.${props.target.kind}`)}
          description={description}
          closeLabel={t("report.close")}
          onOpenAutoFocus={focusFirstReason}
        >
          <ReportForm
            capability={props.capability}
            target={props.target}
            hint={props.hint}
            onBusyChange={setBusy}
            onClose={() => props.onOpenChange(false)}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function ReportForm(props: {
  readonly capability: ContentReportsCapability
  readonly target: ContentReportTarget
  readonly hint: string | undefined
  readonly onBusyChange: (busy: boolean) => void
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const ids = useId()
  const announceToMask = useContext(MaskFocusContext)
  const active = useRef(true)
  const locked = useRef(false)
  // L'envoi en cours, tenu ici : l'état de soumission du formulaire retombe dès qu'une seconde validation est écartée.
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ActionErrorCode | null>(null)
  const form = useForm<ReportValues>({ resolver: zodResolver(reportSchema) })
  const reasonError = form.formState.errors.reason?.message
  // Un profil est commun à tout le moteur : son dossier va au réseau racine (MD-02). La démonstration ne transmet rien.
  const rootNotice = !props.capability.demonstration && reportReachesRootNetwork(props.target.kind)

  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  const send = async ({ reason }: ReportValues) => {
    // Le verrou synchrone couvre aussi deux validations avant le prochain rendu.
    if (locked.current) return
    locked.current = true
    setBusy(true)
    props.onBusyChange(true)
    setFailure(null)
    // Annoncé AVANT l'envoi : le masque peut remplacer le contenu dès que le fournisseur répond.
    announceToMask?.(contentReportKey(props.target))
    try {
      const result = await props.capability.report({ kind: props.target.kind, id: props.target.id, reason })
      if (!result.ok) {
        announceToMask?.(null)
        if (active.current) setFailure(result.code)
        return
      }
      // L'issue se dit même quand le contenu, aussitôt masqué, a déjà retiré la feuille.
      if (!result.value.created) toast.info(t("contentReports.already"))
      else toast.success(t(props.capability.demonstration ? "contentReports.sentDemo" : "contentReports.sent"))
      if (active.current) props.onClose()
    } catch {
      announceToMask?.(null)
      if (active.current) setFailure("unknown")
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
      props.onBusyChange(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(send)(event)} className="flex min-w-0 flex-col gap-4" aria-busy={busy}>
      {/* MD-06 : un signalement n'alerte pas les secours ; la consigne d'urgence passe en tête. */}
      <ReportEmergencyNotice />
      {props.capability.demonstration ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("contentReports.demoNotice")}</p> : null}
      {rootNotice ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("contentReports.rootNotice")}</p> : null}
      {props.hint !== undefined ? <p className="text-sm">{props.hint}</p> : null}
      <fieldset className="flex min-w-0 flex-col gap-2" disabled={busy}>
        <legend className="mb-1 text-sm font-medium">{t("contentReports.reasonLegend")}</legend>
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={field.onChange}
              aria-label={t("contentReports.reasonLegend")}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? `${ids}-motif` : undefined}
            >
              {REPORT_REASONS.map((reason) => (
                <RadioCard key={reason} value={reason}>
                  <span className="text-sm">{t(`report.reason.${reason}`)}</span>
                </RadioCard>
              ))}
            </RadioGroup>
          )}
        />
        {reasonError ? (
          <p id={`${ids}-motif`} role="alert" className="text-[13px] font-medium text-destructive">
            {t(errorKey(reasonError))}
          </p>
        ) : null}
      </fieldset>
      {props.capability.demonstration ? null : <p className="text-[13px] text-muted-foreground">{t("report.followUp")}</p>}
      {/* MD-05 : chaque motif renvoie à une règle, que la page des règles détaille. */}
      <ReportRulesLink />
      {failure !== null ? <p role="alert" className="text-sm font-medium text-destructive">{t(errorKey(failure))}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="destructive" disabled={busy} aria-busy={busy}>
          <FlagIcon aria-hidden />
          {t(busy ? "common.pleaseWait" : "contentReports.confirm")}
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════
// Le bouton
// ═══════════════════════════════════════════════════════════════

export interface ReportContentActionProps {
  readonly target: ContentReportTarget
  /** Une précision propre à la nature, dite dans la feuille. */
  readonly hint?: string
  readonly className?: string
}

/** Le bouton « Signaler », capacité lue chez le fournisseur ; absente, ou cible déjà signalée : rien. */
export function ReportContentAction(props: ReportContentActionProps) {
  const capability = useOptionalContentReports()
  if (capability === null) return null
  return <ReportContentButton {...props} capability={capability} />
}

/** Le bouton « Signaler », capacité reçue ; cible déjà signalée par la personne : rien. */
export function ReportContentButton(props: ReportContentActionProps & { readonly capability: ContentReportsCapability }) {
  const { t } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  const reported = props.capability.useReported(props.target)
  // Déjà signalé : le contenu est masqué pour la personne, aucun second geste n'est offert.
  if (reported) return null
  return (
    <ReportContentSheet
      capability={props.capability}
      target={props.target}
      open={open}
      onOpenChange={setOpen}
      hint={props.hint}
      trigger={
        <Button variant="ghost" size="sm" className={cn("min-h-11 text-destructive", props.className)}>
          <FlagIcon aria-hidden />
          {t(`contentReports.action.${props.target.kind}`)}
        </Button>
      }
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// Le masque
// ═══════════════════════════════════════════════════════════════

export interface ReportedContentProps {
  readonly target: ContentReportTarget
  readonly children: ReactNode
  /** Le retour (un lien rendu par l'application), quand le contenu masqué occupait toute la fiche. */
  readonly back?: ReactNode
  readonly className?: string
}

/** Le contenu ; signalé par la personne de la session, l'avis qui le remplace pour elle. Capacité lue chez le fournisseur. */
export function ReportedContent(props: ReportedContentProps) {
  const capability = useOptionalContentReports()
  if (capability === null) return <>{props.children}</>
  return <ReportedContentMask {...props} capability={capability} />
}

/** Le même masque, capacité reçue. */
export function ReportedContentMask(props: ReportedContentProps & { readonly capability: ContentReportsCapability }) {
  const { t } = useDiasporaleT()
  const reported = props.capability.useReported(props.target)
  const targetKey = contentReportKey(props.target)
  const notice = useRef<HTMLDivElement>(null)
  const pending = useRef<string | null>(null)
  const announce = useCallback((announced: string | null) => {
    pending.current = announced
  }, [])

  useEffect(() => {
    // Signalé depuis ce contenu : son déclencheur a disparu avec lui, le focus passe à l'avis.
    if (!reported || pending.current !== targetKey) return
    pending.current = null
    notice.current?.focus()
  }, [reported, targetKey])

  if (!reported) return <MaskFocusContext.Provider value={announce}>{props.children}</MaskFocusContext.Provider>
  return (
    <div
      ref={notice}
      tabIndex={-1}
      role="note"
      className={cn("flex min-w-0 flex-col items-start gap-1 rounded-lg bg-muted px-3 py-3 text-sm focus-visible:shadow-focus", props.className)}
    >
      <p className="font-semibold">{t("contentReports.masked.title")}</p>
      <p>{t(props.capability.demonstration ? "contentReports.masked.bodyDemo" : "contentReports.masked.body")}</p>
      {props.back ?? null}
    </div>
  )
}
