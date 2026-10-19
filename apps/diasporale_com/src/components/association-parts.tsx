"use client"

/**
 * Briques communes des surfaces « associations » (DG-010) : la fiche d'une
 * association, ses adhérents, « Mes associations ». Une action à la fois, une
 * issue annoncée (`role="status"` ou `role="alert"`), une confirmation avant
 * de quitter, une pagination par curseurs opaques. PROPRIÉTAIRE : chantier
 * « associations ».
 */
import { Button, Sheet, SheetClose, SheetContent } from "@diasporale/features"
import { ERROR_CODES, type ActionResult, type ErrorCode } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useCallback, useLayoutEffect, useRef, useState } from "react"

/** La clé d'un code de refus : un code fermé connu, sinon `unknown` — jamais une clé inventée. */
export function errorKey(code: string): string {
  return `errors.${ERROR_CODES.has(code as ErrorCode) ? code : "unknown"}`
}

export interface AssociationFeedback {
  readonly tone: "status" | "alert"
  readonly text: string
}

/**
 * Une action à la fois : un second clic pendant l'attente ne relance rien, et
 * l'issue n'est rendue qu'à un écran encore monté.
 */
export function useGuardedAction() {
  const mounted = useRef(true)
  const running = useRef(false)
  const [busy, setBusy] = useState<string | null>(null)
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const run = useCallback(async (key: string, work: () => Promise<ActionResult>): Promise<ActionResult | null> => {
    if (running.current) return null
    running.current = true
    setBusy(key)
    try {
      const result = await work()
      return mounted.current ? result : null
    } catch {
      return mounted.current ? { ok: false, code: "unknown" } : null
    } finally {
      running.current = false
      if (mounted.current) setBusy(null)
    }
  }, [])
  return { busy, run }
}

export function FeedbackLine(props: { readonly feedback: AssociationFeedback | null }) {
  if (!props.feedback) return null
  return (
    <p role={props.feedback.tone} className={props.feedback.tone === "alert" ? "text-sm font-medium text-destructive" : "text-sm text-foreground"}>
      {props.feedback.text}
    </p>
  )
}

/** La pile des curseurs d'une liste paginée : on revient en arrière sans relire tout le début. */
export function useCursorPages() {
  const [navigation, setNavigation] = useState<{ readonly cursors: readonly (string | null)[]; readonly index: number }>({ cursors: [null], index: 0 })
  const cursor = navigation.cursors[navigation.index] ?? null
  const next = (continueCursor: string | null) => {
    if (continueCursor === null || navigation.cursors.slice(0, navigation.index + 1).includes(continueCursor)) return
    setNavigation((current) => ({ cursors: [...current.cursors.slice(0, current.index + 1), continueCursor], index: current.index + 1 }))
  }
  const previous = () => setNavigation((current) => (current.index > 0 ? { ...current, index: current.index - 1 } : current))
  return { cursor, index: navigation.index, next, previous }
}

/** Précédents · page n · suivants — toujours atteignables au clavier, désactivés quand rien n'est à lire. */
export function ListPager(props: { readonly index: number; readonly canPrevious: boolean; readonly canNext: boolean; readonly onPrevious: () => void; readonly onNext: () => void }) {
  const { t } = useDiasporaleT()
  if (!props.canPrevious && !props.canNext) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="outline" aria-disabled={!props.canPrevious} className="aria-disabled:opacity-55" onClick={() => { if (props.canPrevious) props.onPrevious() }}>
        {t("associations.list.previous")}
      </Button>
      <span className="text-sm text-muted-foreground">{t("associations.list.page", { number: props.index + 1 })}</span>
      <Button variant="outline" aria-disabled={!props.canNext} className="aria-disabled:opacity-55" onClick={() => { if (props.canNext) props.onNext() }}>
        {t("associations.list.next")}
      </Button>
    </div>
  )
}

/** Quitter l'association : un geste CONFIRMÉ (le focus va d'abord sur « Annuler »). */
export function LeaveAssociationButton(props: { readonly busy: boolean; readonly onConfirm: () => Promise<boolean> }) {
  const { t } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!props.busy) setOpen(next) }}>
      <Button variant="outline" disabled={props.busy} onClick={() => setOpen(true)}>
        {t("associations.leave")}
      </Button>
      <SheetContent
        title={t("associations.leaveConfirm.title")}
        description={t("associations.leaveConfirm.body")}
        closeLabel={t("common.close")}
        onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus() }}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <SheetClose asChild><Button ref={cancel} variant="ghost" disabled={props.busy}>{t("common.cancel")}</Button></SheetClose>
          <Button
            variant="destructive"
            disabled={props.busy}
            onClick={async () => {
              if (await props.onConfirm()) setOpen(false)
            }}
          >
            {t(props.busy ? "common.pleaseWait" : "associations.leaveConfirm.confirm")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
