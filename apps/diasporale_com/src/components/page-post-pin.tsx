"use client"

import { Button, Sheet, SheetContent, SheetTrigger } from "@diasporale/features"
import { ACTION_ERROR_CODES, type ActionErrorCode, type PagePinningCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { PinIcon, PinOffIcon } from "lucide-react"
import { type FormEvent, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface PagePostPinProps {
  readonly capability: PagePinningCapability
  readonly pageId: string
  readonly postId: string
  readonly pinnedPostId: string | null
  readonly ready: boolean
}

interface PinAttempt {
  readonly key: number
  readonly expectedPinnedPostId: string | null
  readonly postId: string | null
}

const pinErrors: ReadonlySet<string> = new Set(ACTION_ERROR_CODES)

function closedError(code: unknown): ActionErrorCode {
  return typeof code === "string" && pinErrors.has(code) ? (code as ActionErrorCode) : "unknown"
}

/** Chaque ouverture capture l'épingle lue ; une mise à jour ne remplace pas ce choix. */
export function PagePostPinButton(props: PagePostPinProps) {
  const { t } = useDiasporaleT()
  const sequence = useRef(0)
  const activeAttempt = useRef<number | null>(null)
  const [attempt, setAttempt] = useState<PinAttempt | null>(null)
  const pinned = props.pinnedPostId === props.postId
  const Icon = pinned ? PinOffIcon : PinIcon

  useLayoutEffect(() => () => { activeAttempt.current = null }, [])

  const changeOpen = (open: boolean) => {
    if (!open) {
      activeAttempt.current = null
      setAttempt(null)
      return
    }
    if (!props.ready || activeAttempt.current !== null) return
    const key = ++sequence.current
    activeAttempt.current = key
    setAttempt({ key, expectedPinnedPostId: props.pinnedPostId, postId: pinned ? null : props.postId })
  }

  return (
    <Sheet open={attempt !== null} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" disabled={!props.ready} className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left">
          <Icon aria-hidden />
          <span className="min-w-0 break-words">{t(pinned ? "pagePinning.unpin" : "pagePinning.pin")}</span>
        </Button>
      </SheetTrigger>
      {attempt ? (
        <SheetContent
          key={attempt.key}
          title={t(attempt.postId === null ? "pagePinning.unpinTitle" : "pagePinning.pinTitle")}
          description={t(attempt.postId === null ? "pagePinning.unpinDescription" : "pagePinning.pinDescription")}
          closeLabel={t("common.close")}
        >
          <PinConfirmation
            key={attempt.key}
            {...props}
            attempt={attempt}
            isCurrent={() => activeAttempt.current === attempt.key}
            onClose={() => changeOpen(false)}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function PinConfirmation(props: PagePostPinProps & {
  readonly attempt: PinAttempt
  readonly isCurrent: () => boolean
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<ActionErrorCode | null>(null)
  const unpinning = props.attempt.postId === null
  const conflict = failure === "page_pin_changed"
  const changedSinceOpening = props.ready && props.pinnedPostId !== props.attempt.expectedPinnedPostId
  const blocked = !props.ready || changedSinceOpening || conflict
  const Icon = unpinning ? PinOffIcon : PinIcon

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Le verrou synchrone couvre aussi deux événements avant le prochain rendu.
    if (locked.current || !props.isCurrent() || blocked) return
    locked.current = true
    setPending(true)
    setFailure(null)
    try {
      const result = await props.capability.setPinned({
        pageId: props.pageId,
        postId: props.attempt.postId,
        expectedPinnedPostId: props.attempt.expectedPinnedPostId,
      })
      if (!props.isCurrent()) return
      if (!result.ok) {
        setFailure(closedError(result.code))
        return
      }
      toast.success(t("pagePinning.saved"))
      props.onClose()
    } catch {
      if (props.isCurrent()) setFailure("unknown")
    } finally {
      locked.current = false
      if (props.isCurrent()) setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-w-0 flex-col gap-4" aria-busy={pending}>
      {!unpinning && props.attempt.expectedPinnedPostId !== null ? (
        <p className="text-sm text-muted-foreground">{t("pagePinning.replaceWarning")}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">{t("pagePinning.audienceKept")}</p>
      {failure ? <p role="alert" className="text-sm text-destructive">{t(`errors.${failure}`)}</p> : null}
      {changedSinceOpening && !conflict ? <p role="alert" className="text-sm text-destructive">{t("pagePinning.changedSinceOpening")}</p> : null}
      {!props.ready ? <p role="status" className="text-sm text-muted-foreground">{t("pagePinning.readRequired")}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" className="h-auto min-h-11 max-w-full whitespace-normal py-2" onClick={props.onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={pending || blocked} aria-busy={pending} className="h-auto min-h-11 max-w-full whitespace-normal py-2">
          <Icon aria-hidden />
          <span className="min-w-0 break-words">{t(pending ? "common.pleaseWait" : unpinning ? "pagePinning.confirmUnpin" : "pagePinning.confirmPin")}</span>
        </Button>
      </div>
    </form>
  )
}
