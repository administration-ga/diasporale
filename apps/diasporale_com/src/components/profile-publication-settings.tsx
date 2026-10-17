"use client"

import { Button, Card, Sheet, SheetClose, SheetContent, SheetTrigger, Skeleton } from "@diasporale/features"
import { useDataSource, type ActionErrorCode, type DiasporaleDataSource, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"

import { ProfileIdentitySettings } from "./profile-identity-settings"

type ProfilePublication = NonNullable<DiasporaleDataSource["profilePublication"]>
type Command = "privacy" | "withdraw" | "republish"
type ReaderScope = { readonly publication: ProfilePublication; readonly personId: string; readonly snapshot: string }
type Confirmation = { readonly scope: ReaderScope; readonly command: "withdraw" | "republish" }
type Feedback =
  | { readonly scope: ReaderScope; readonly kind: "error"; readonly code: ActionErrorCode }
  | { readonly scope: ReaderScope; readonly kind: "saved"; readonly command: Command }

/** Les commandes portent sur le profil commun, indépendamment du droit de publier dans DIASPORALE. */
export function ProfilePublicationSettings(props: { membership: MembershipView }) {
  const source = useDataSource()
  const { t } = useDiasporaleT()
  const id = useId()
  if (!source.profilePublication) return null

  return (
    <section id="profil" aria-labelledby={`${id}-titre`} className="scroll-mt-20">
      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 id={`${id}-titre`} className="font-display text-xl font-bold">{t("settings.profilePublication.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("settings.profilePublication.globalScope")}</p>
        </div>
        <OwnProfilePublication
          key={`${source.kind}:${props.membership.personId}`}
          personId={props.membership.personId}
          publication={source.profilePublication}
        />
      </Card>
    </section>
  )
}

function OwnProfilePublication(props: { personId: string; publication: ProfilePublication }) {
  const { t } = useDiasporaleT()
  const profile = props.publication.useMyProfile()
  const own = profile.status === "ready" && profile.data?.personId === props.personId ? profile.data : null
  const snapshot = own ? JSON.stringify([own.personId, own.handle, own.displayName, own.headline, own.published, own.private]) : profile.status
  const scope = useMemo(() => ({ publication: props.publication, personId: props.personId, snapshot }), [props.publication, props.personId, snapshot])
  const active = useRef<ReaderScope | null>(null)
  const running = useRef<symbol | null>(null)
  const dialog = useRef<Confirmation | null>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  useLayoutEffect(() => {
    active.current = scope
    if (dialog.current?.scope !== scope) dialog.current = null
    return () => { if (active.current === scope) active.current = null }
  }, [scope])

  const shownFeedback = feedback?.scope === scope ? feedback : null
  const feedbackText = shownFeedback?.kind === "error"
    ? t(`errors.${shownFeedback.code}`)
    : shownFeedback ? t(`settings.profilePublication.saved.${shownFeedback.command}`) : null
  const hasIdentity = own !== null && Boolean(own.handle?.trim() && own.displayName?.trim())
  const canSetPrivacy = own !== null && (own.published || hasIdentity)
  const canRepublish = own !== null && !own.published && hasIdentity
  const command = own?.published ? "withdraw" : "republish"
  const open = confirmation?.scope === scope && confirmation.command === command

  const changeConfirmation = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (dialog.current?.scope === scope) {
        dialog.current = null
        setConfirmation(null)
      }
      return
    }
    if (active.current !== scope || !own || running.current || (!own.published && !canRepublish)) return
    const next = { scope, command } as const
    dialog.current = next
    setConfirmation(next)
    setFeedback(null)
  }

  const execute = async (action: Command) => {
    if (active.current !== scope || !own || running.current) return
    if (action === "privacy") {
      if (!canSetPrivacy || dialog.current !== null) return
    } else {
      if (dialog.current?.scope !== scope || dialog.current.command !== action) return
      if (action === "withdraw" ? !own.published : !canRepublish) return
    }

    const operation = Symbol()
    running.current = operation
    setBusy(true)
    setFeedback(null)
    try {
      const result = action === "privacy"
        ? await props.publication.setPrivacy(props.personId, !own.private)
        : action === "withdraw"
          ? await props.publication.withdraw(props.personId)
          : await props.publication.republish(props.personId)
      if (active.current !== scope) return
      if (!result.ok) {
        setFeedback({ scope, kind: "error", code: result.code })
        return
      }
      changeConfirmation(false)
      setFeedback({ scope, kind: "saved", command: action })
    } catch {
      if (active.current === scope) setFeedback({ scope, kind: "error", code: "unknown" })
    } finally {
      if (running.current === operation) {
        running.current = null
        if (active.current !== null) setBusy(false)
      }
    }
  }

  const acquireIdentity = () => {
    if (active.current !== scope || running.current || dialog.current !== null) return null
    const operation = Symbol()
    running.current = operation
    setBusy(true)
    return () => {
      if (running.current !== operation) return
      running.current = null
      if (active.current !== null) setBusy(false)
    }
  }

  if (profile.status === "loading") return (
    <div role="status"><span className="sr-only">{t("common.pleaseWait")}</span><Skeleton className="h-28 w-full rounded-xl" /></div>
  )
  if (profile.status === "error") return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p>{t("settings.profilePublication.loadError")}</p>
      <Button variant="outline" onClick={() => { if (active.current === scope && !running.current) window.location.reload() }}>
        {t("settings.profilePublication.reload")}
      </Button>
    </div>
  )
  if (!own) return <p className="text-sm text-muted-foreground">{t("settings.profilePublication.unavailable")}</p>

  const state = own.published ? own.private ? "private" : "published" : canRepublish ? "withdrawn" : "unpublished"

  return (
    <div className="flex flex-col gap-5" aria-busy={busy}>
      <p role="status" className="text-sm font-medium">{t(`settings.profilePublication.state.${state}`)}</p>
      <ProfileIdentitySettings profile={own} publication={props.publication} disabled={busy} acquire={acquireIdentity} />
      {canSetPrivacy ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t("settings.profilePublication.privateLead")}</p>
          {!own.published ? <p className="text-sm font-medium">{t(own.private ? "settings.profilePublication.privacyOn" : "settings.profilePublication.privacyOff")}</p> : null}
          <Button variant="outline" disabled={busy} onClick={() => void execute("privacy")}>
            {t(busy ? "settings.profilePublication.working" : own.private ? "settings.profilePublication.makeDiscoverable" : "settings.profilePublication.makePrivate")}
          </Button>
        </div>
      ) : null}
      {own.published || canRepublish ? (
        <div className="flex flex-col items-start gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">{t(own.published ? "settings.profilePublication.withdrawLead" : "settings.profilePublication.republishLead")}</p>
          <Sheet open={open} onOpenChange={changeConfirmation}>
            <SheetTrigger asChild>
              <Button variant={own.published ? "destructive" : "primary"} disabled={busy}>
                {t(own.published ? "settings.profilePublication.withdraw" : "settings.profilePublication.republish")}
              </Button>
            </SheetTrigger>
            <SheetContent
              title={t(`settings.profilePublication.confirm.${command}.title`)}
              description={t(`settings.profilePublication.confirm.${command}.body`)}
              closeLabel={t("common.close")}
              onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus() }}
            >
              {open && shownFeedback?.kind === "error" ? <p role="alert" className="text-sm text-destructive">{feedbackText}</p> : null}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <SheetClose asChild><Button ref={cancel} variant="ghost">{t("common.cancel")}</Button></SheetClose>
                <Button variant={command === "withdraw" ? "destructive" : "primary"} disabled={busy} onClick={() => void execute(command)}>
                  {t(busy ? "settings.profilePublication.working" : `settings.profilePublication.confirm.${command}.confirm`)}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      ) : null}
      {!open && feedbackText ? <p role={shownFeedback?.kind === "error" ? "alert" : "status"} className={shownFeedback?.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{feedbackText}</p> : null}
    </div>
  )
}
