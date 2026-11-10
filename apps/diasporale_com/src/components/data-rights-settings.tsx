"use client"

import { Button, Card, Checkbox, Label, Sheet, SheetContent, cn, formatDate } from "@diasporale/features"
import {
  ERASURE_GRACE_DAYS,
  ERASURE_GRACE_MS,
  erasureDaysLeft,
  erasureStateAt,
  useDataRights,
  type ActionErrorCode,
  type DataExportProgress,
  type DataRightsCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CircleStopIcon, DownloadIcon, Trash2Icon, Undo2Icon } from "lucide-react"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import {
  DecisionResults,
  errorFeedback,
  FeedbackLine,
  LoadingLine,
  REASON_BOUNDS,
  useDecisionNavigation,
  useFeedback,
  useMounted,
} from "./moderation-decisions"
import { ReportResults } from "./my-reports"

/**
 * « Mes données » (`#mes-donnees`, DG-026) : exporter les données de son compte
 * commun, demander puis annuler son effacement pendant la grâce, lire les
 * décisions de modération qui nous concernent et les contester, et suivre ses
 * propres signalements (`#mes-signalements`, SU01d du moteur).
 *
 * Elle reçoit la PERSONNE, jamais l'adhésion (NP-02) : la même section sert
 * les réglages d'un membre et la page `/mes-donnees`, ouverte à toute personne
 * connectée — suspendue, partie ou sans adhésion. Elle ne lit aucune capacité
 * de publication et ne renvoie vers aucune surface sociale (pas de lien vers le
 * contenu d'une décision). Chaque geste porte sur la personne affichée : les
 * panneaux renaissent avec elle, une réponse tardive est ignorée.
 */
export function DataRightsSettings(props: {
  person: DataRightsPerson
  /** `h1` quand la section est la page elle-même (`/mes-donnees`), `h2` dans les réglages. */
  heading?: "h1" | "h2"
}) {
  const { t } = useDiasporaleT()
  const rights = useDataRights()
  const titleId = useId()
  const { person } = props
  const Heading = props.heading ?? "h2"
  return (
    <section id="mes-donnees" aria-labelledby={titleId} className="scroll-mt-20">
      <Card className="flex min-w-0 flex-col gap-5 p-5">
        <div>
          <Heading id={titleId} className={cn("font-display font-bold", Heading === "h1" ? "text-3xl" : "text-xl")}>{t("settings.data")}</Heading>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{t("settings.dataRights.lead")}</p>
        </div>
        {rights === null ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t("settings.dataRights.unavailable")}</p>
        ) : (
          <div key={person.personId} className="flex min-w-0 flex-col gap-5">
            <ExportPanel rights={rights} personId={person.personId} handle={person.handle} />
            <ErasurePanel rights={rights} personId={person.personId} canLeave={person.canLeave} />
            <DecisionsPanel rights={rights} personId={person.personId} />
            {rights.useReports ? <ReportsPanel useReports={rights.useReports} personId={person.personId} /> : null}
          </div>
        )}
      </Card>
    </section>
  )
}

/** La personne de la session qui exerce ses droits, membre de DIASPORALE ou non. */
export interface DataRightsPerson {
  readonly personId: string
  /** Son identifiant public, s'il en a un : il nomme le fichier exporté. */
  readonly handle: string | null
  /**
   * Une adhésion vivante à quitter : l'effacement propose alors « Quitter DIASPORALE » comme
   * alternative. Faux pour qui est parti ou n'est jamais entré : il n'y a rien à quitter.
   */
  readonly canLeave: boolean
}

/** L'heure de l'appareil, relue chaque minute : le compte à rebours se tient sans relecture du serveur. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function Panel(props: { title: string; lead?: string; anchor?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section
      id={props.anchor}
      tabIndex={props.anchor ? -1 : undefined}
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col gap-3 border-t border-border pt-5", props.anchor && "scroll-mt-20 outline-none focus-visible:shadow-focus")}
    >
      <h3 id={id} className="font-semibold">{props.title}</h3>
      {props.lead ? <p className="text-sm leading-relaxed text-muted-foreground">{props.lead}</p> : null}
      {props.children}
    </section>
  )
}

// ── Export ─────────────────────────────────────────────────────────────────

/** Le nom du fichier : l'identifiant public s'il existe, sinon la seule date (aucune donnée de plus). */
function exportFileName(handle: string | null, exportedAt: number): string {
  const day = new Date(exportedAt).toISOString().slice(0, 10)
  return handle === null ? `diasporale-${day}.json` : `diasporale-${handle}-${day}.json`
}

/**
 * Enregistre le document sur l'appareil : une URL locale (`blob:`) le temps du
 * geste, révoquée aussitôt — aucune adresse publique, aucun stockage tiers.
 */
function saveJsonFile(name: string, json: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
    try {
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = name
      anchor.hidden = true
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    } finally {
      // Révoquée au tour suivant : certains navigateurs lisent l'adresse après le clic.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
    return true
  } catch {
    return false
  }
}

function ExportPanel({ rights, personId, handle }: { rights: DataRightsCapability; personId: string; handle: string | null }) {
  const { t, locale } = useDiasporaleT()
  const last = rights.useLastExport(personId)
  const mounted = useMounted()
  const controller = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<DataExportProgress | null>(null)
  const { feedback, show } = useFeedback()

  // Section démontée (autre page, autre personne) : plus aucune page d'export n'est lue.
  useEffect(() => {
    const running = controller
    return () => running.current?.abort()
  }, [])

  const start = async () => {
    if (controller.current) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setProgress(null)
    show(null)
    try {
      const result = await rights.prepareExport(personId, {
        signal: abort.signal,
        onProgress: (next) => { if (mounted.current && !abort.signal.aborted) setProgress(next) },
      })
      if (!mounted.current) return
      if (!result.ok) {
        show(result.code === "export_cancelled" ? { key: "errors.export_cancelled", error: false } : errorFeedback(result.code))
        return
      }
      show(saveJsonFile(exportFileName(handle, result.value.exportedAt), result.value.json) ? { key: "settings.exported", error: false } : errorFeedback("export_download_failed"))
    } catch {
      if (mounted.current) show(errorFeedback("unknown"))
    } finally {
      if (controller.current === abort) controller.current = null
      if (mounted.current) {
        setBusy(false)
        setProgress(null)
      }
    }
  }

  return (
    <Panel title={t("settings.dataRights.export.title")} lead={t("settings.dataRights.export.lead")}>
      {last ? (
        <p className="text-[13px] text-muted-foreground">
          {t("settings.dataRights.export.last", { date: formatDate(last.exportedAt, locale, { dateStyle: "long", timeStyle: "short" }) })}
        </p>
      ) : null}
      {busy ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <p className="text-sm font-medium">{t("settings.dataRights.export.preparing")}</p>
          <progress
            className="h-2 w-full accent-primary"
            aria-label={t("settings.dataRights.export.progressLabel")}
            max={progress ? Math.max(1, progress.total) : undefined}
            value={progress ? progress.done : undefined}
          />
          {progress ? (
            <p className="text-[13px] text-muted-foreground">{t("settings.dataRights.export.progress", { done: progress.done, total: progress.total })}</p>
          ) : null}
        </div>
      ) : null}
      <FeedbackLine feedback={feedback} />
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={busy} onClick={() => void start()}>
          <DownloadIcon aria-hidden />
          {t("settings.export")}
        </Button>
        {busy ? (
          <Button variant="ghost" onClick={() => controller.current?.abort()}>
            <CircleStopIcon aria-hidden />
            {t("settings.dataRights.export.stop")}
          </Button>
        ) : null}
      </div>
    </Panel>
  )
}

// ── Effacement ─────────────────────────────────────────────────────────────

function ErasurePanel({ rights, personId, canLeave }: { rights: DataRightsCapability; personId: string; canLeave: boolean }) {
  const { t, locale } = useDiasporaleT()
  const erasure = rights.useErasure(personId)
  const now = useNow()
  const mounted = useMounted()
  const running = useRef(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { feedback, show } = useFeedback()
  const state = erasure.status === "ready" ? erasureStateAt(erasure.data, now) : null

  // Le bouton du geste disparaît avec l'état qu'il change : le focus suit le nouvel état,
  // quel que soit l'ordre entre la réponse, la relecture réactive et la fermeture de la feuille.
  const region = useRef<HTMLDivElement>(null)
  const focusOn = useRef<NonNullable<typeof state> | null>(null)
  useEffect(() => {
    if (state === null || focusOn.current !== state) return
    focusOn.current = null
    region.current?.focus()
  }, [state])

  /** Rend `null` si la demande est enregistrée, sinon le code du refus (dit dans la feuille). */
  const request = async (): Promise<ActionErrorCode | null> => {
    setBusy(true)
    show(null)
    focusOn.current = "grace"
    try {
      const result = await rights.requestErasure(personId)
      if (!mounted.current) return null
      if (!result.ok) {
        focusOn.current = null
        return result.code
      }
      show({ key: "settings.dataRights.erasure.requested", values: { date: formatDate(result.value.dueAt, locale) }, error: false })
      return null
    } catch {
      focusOn.current = null
      return "unknown"
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const cancel = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    show(null)
    focusOn.current = "none"
    try {
      const result = await rights.cancelErasure(personId)
      if (!mounted.current) return
      if (!result.ok) focusOn.current = null
      show(result.ok ? { key: "settings.dataRights.erasure.cancelled", error: false } : errorFeedback(result.code))
    } catch {
      focusOn.current = null
      if (mounted.current) show(errorFeedback("unknown"))
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <Panel title={t("settings.dataRights.erasure.title")} lead={t("settings.dataRights.erasure.lead")}>
      <div ref={region} tabIndex={-1} className="flex min-w-0 flex-col gap-3 rounded-md focus-visible:shadow-focus">
        {erasure.status === "loading" ? (
          <LoadingLine />
        ) : erasure.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">{t("settings.dataRights.erasure.loadError")}</p>
        ) : erasure.data.state === "none" ? (
          <>
            {canLeave ? <p className="text-sm leading-relaxed">{t("settings.dataRights.erasure.leaveInstead")}</p> : null}
            <Button variant="destructive" className="self-start" disabled={busy} onClick={() => setOpen(true)}>
              <Trash2Icon aria-hidden />
              {t("settings.delete")}
            </Button>
          </>
        ) : state === "grace" ? (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium">
              {t("settings.dataRights.erasure.pending", { requested: formatDate(erasure.data.requestedAt, locale), due: formatDate(erasure.data.dueAt, locale) })}
            </p>
            <p className="text-sm">{t("settings.dataRights.erasure.daysLeft", { count: erasureDaysLeft(erasure.data.dueAt, now) })}</p>
            <Button variant="outline" disabled={busy} onClick={() => void cancel()}>
              <Undo2Icon aria-hidden />
              {busy ? t("common.pleaseWait") : t("settings.dataRights.erasure.cancel")}
            </Button>
          </div>
        ) : (
          <p role="status" className="rounded-xl bg-muted p-4 text-sm font-medium">{t("settings.dataRights.erasure.processing")}</p>
        )}
      </div>
      <FeedbackLine feedback={feedback} />
      <ErasureSheet open={open && state === "none"} onOpenChange={setOpen} now={now} request={request} canLeave={canLeave} />
    </Panel>
  )
}

/** La confirmation forte : portée, grâce, échéance sans retour, alternative du départ (s'il y a une adhésion), case à cocher. */
function ErasureSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  now: number
  request: () => Promise<ActionErrorCode | null>
  canLeave: boolean
}) {
  const { t, locale } = useDiasporaleT()
  const mounted = useMounted()
  const running = useRef(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const id = useId()

  const change = (open: boolean) => {
    if (!open) {
      setAcknowledged(false)
      setError(null)
    }
    props.onOpenChange(open)
  }

  const confirm = async () => {
    if (running.current || !acknowledged) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      const code = await props.request()
      if (!mounted.current) return
      if (code === null) change(false)
      else setError(code)
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <Sheet open={props.open} onOpenChange={change}>
      <SheetContent title={t("settings.deleteConfirmTitle")} description={t("settings.dataRights.erasure.scope")} closeLabel={t("common.close")}>
        <div className="flex flex-col gap-3 text-sm leading-relaxed">
          <p>{t("settings.deleteConfirmBody")}</p>
          <p>{t("settings.dataRights.erasure.grace", { days: ERASURE_GRACE_DAYS, date: formatDate(props.now + ERASURE_GRACE_MS, locale) })}</p>
          <p>{t("settings.dataRights.erasure.final")}</p>
          {props.canLeave ? <p>{t("settings.dataRights.erasure.leaveInstead")}</p> : null}
          <p className="text-muted-foreground">{t("settings.dataRights.erasure.exportFirst")}</p>
        </div>
        <div className="mt-5 flex items-start gap-3">
          <Checkbox id={id} checked={acknowledged} disabled={busy} onCheckedChange={(checked) => setAcknowledged(checked === true)} className="mt-0.5" />
          <Label htmlFor={id} className="leading-snug">{t("settings.deleteAcknowledge")}</Label>
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-destructive">{t(`errors.${error}`, REASON_BOUNDS)}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => change(false)}>{t("common.cancel")}</Button>
          <Button variant="destructive" disabled={busy || !acknowledged} onClick={() => void confirm()}>
            {busy ? t("common.pleaseWait") : t("settings.dataRights.erasure.confirm")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Décisions et recours ───────────────────────────────────────────────────

/** Les décisions qui me concernent, dans tous les réseaux du compte commun ; le recours porte sur la personne affichée. */
function DecisionsPanel({ rights, personId }: { rights: DataRightsCapability; personId: string }) {
  const { t } = useDiasporaleT()
  const navigation = useDecisionNavigation()
  const page = rights.useDecisions({ personId, cursor: navigation.cursor })

  return (
    <Panel title={t("settings.dataRights.decisions.title")} lead={t("settings.dataRights.decisions.lead")}>
      <DecisionResults
        query={page}
        navigation={navigation}
        appeal={(input) => rights.fileAppeal({ personId, ...input })}
        copy={{
          empty: "settings.dataRights.decisions.empty",
          emptyPage: "settings.dataRights.decisions.emptyPage",
          loadError: "settings.dataRights.decisions.loadError",
        }}
      />
    </Panel>
  )
}

// ── Mes signalements (SU01d du moteur) ─────────────────────────────────────

/** L'ancre de la rubrique : la route `settingsReports` de l'application y mène, depuis la cloche. */
const REPORTS_ANCHOR = "mes-signalements"

/**
 * Mes signalements : la destination de l'accusé de réception et de l'avis de décision. La
 * rubrique ne se remplit qu'après lecture : ouverte depuis la cloche, elle se place alors et
 * prend le focus.
 */
function ReportsPanel(props: { useReports: NonNullable<DataRightsCapability["useReports"]>; personId: string }) {
  const { t } = useDiasporaleT()
  const navigation = useDecisionNavigation()
  const page = props.useReports({ personId: props.personId, cursor: navigation.cursor })
  const loaded = page.status !== "loading"
  useEffect(() => {
    if (!loaded || window.location.hash !== `#${REPORTS_ANCHOR}`) return
    const section = document.getElementById(REPORTS_ANCHOR)
    if (!section) return
    section.scrollIntoView({ block: "start" })
    section.focus({ preventScroll: true })
  }, [loaded])

  return (
    <Panel anchor={REPORTS_ANCHOR} title={t("settings.dataRights.reports.title")} lead={t("settings.dataRights.reports.lead")}>
      <ReportResults query={page} navigation={navigation} />
    </Panel>
  )
}
