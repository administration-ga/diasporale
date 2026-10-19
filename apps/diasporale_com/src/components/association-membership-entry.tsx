"use client"

import { ASSOCIATION_REQUEST_MESSAGE_MAX, type PageOwnerKind } from "@diasporale/domain"
import { Button, Field, Sheet, SheetClose, SheetContent, Skeleton, Textarea, formatDate } from "@diasporale/features"
import { useAssociations, type AssociationsCapability, type MyAssociationMembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ListChecksIcon, UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useRef, useState, type FormEvent } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { type AssociationFeedback, errorKey, FeedbackLine, LeaveAssociationButton, useGuardedAction } from "./association-parts"

/**
 * « Devenir adhérent » d'une association, DISTINCT de « Suivre » (plan global
 * §G3) : suivre donne l'actualité de la page, adhérer est une demande que ses
 * responsables acceptent ou non. Monté par la fiche d'une page (chantier
 * « pages ») ; ne rend rien pour une page qui n'est pas une association.
 * PROPRIÉTAIRE : chantier « associations ».
 */
export function AssociationMembershipEntry(props: { readonly pageId: string; readonly handle: string; readonly ownerKind: PageOwnerKind }) {
  const associations = useAssociations()
  const { t } = useDiasporaleT()
  const titleId = useId()
  if (props.ownerKind !== "association") return null
  return (
    // Monté dans la rangée d'actions de la fiche (à côté de « Suivre ») : une ligne entière à lui.
    <section aria-labelledby={titleId} className="flex w-full min-w-0 basis-full flex-col gap-3 rounded-xl bg-muted p-4">
      <div>
        <h2 id={titleId} className="text-base font-semibold">{t("associations.entry.title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("associations.entry.lead")}</p>
      </div>
      {associations
        ? <MembershipState associations={associations} pageId={props.pageId} handle={props.handle} />
        : <p className="text-sm text-muted-foreground">{t("associations.entry.unavailable")}</p>}
    </section>
  )
}

/** Les textes de la situation AVANT une demande : pourquoi elle n'est pas (encore) possible. */
const REFUSAL_LINES: Readonly<Record<string, string>> = {
  association_not_managed: "associations.entry.notManaged",
  association_rejoin_blocked: "associations.entry.rejoinBlocked",
  status_insufficient: "associations.entry.statusInsufficient",
}

function MembershipState(props: { readonly associations: AssociationsCapability; readonly pageId: string; readonly handle: string }) {
  const { t, locale } = useDiasporaleT()
  const state = props.associations.useMyMembership(props.pageId)
  const { busy, run } = useGuardedAction()
  const [feedback, setFeedback] = useState<AssociationFeedback | null>(null)

  if (state.status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">{t("common.pleaseWait")}</span>
        <Skeleton className="h-11 w-full max-w-64 rounded-md" />
      </div>
    )
  }
  if (state.status === "error") return <p role="alert" className="text-sm text-destructive">{t(errorKey(state.code))}</p>

  const view: MyAssociationMembershipView = state.data
  const membership = view.membership
  const date = (at: number) => formatDate(at, locale)

  const gesture = async (key: "cancelled" | "left", work: () => ReturnType<AssociationsCapability["leave"]>) => {
    setFeedback(null)
    const result = await run(key, work)
    if (!result) return false
    setFeedback(result.ok ? { tone: "status", text: t(`associations.feedback.${key}`) } : { tone: "alert", text: t(errorKey(result.code)) })
    return result.ok
  }

  // Après un refus, la date d'échéance passée vaut permission (la lecture ne se rejoue pas d'elle-même).
  const cooldownOver = view.request.refusal === "association_request_too_soon" && view.request.availableAt !== null && view.request.availableAt <= Date.now()
  const canRequest = (view.request.allowed || cooldownOver) && membership?.status !== "requested" && membership?.status !== "accepted"
  const refusalLine = view.request.refusal ? REFUSAL_LINES[view.request.refusal] : undefined

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {membership?.status === "accepted" ? (
        <>
          <p className="text-sm font-medium">{t("associations.entry.memberSince", { date: date(membership.statusChangedAt) })}</p>
          <p className="text-sm text-muted-foreground">{t("associations.entry.role", { role: t(`associations.role.${membership.role}`) })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <LeaveAssociationButton busy={busy !== null} onConfirm={() => gesture("left", () => props.associations.leave(props.pageId))} />
          </div>
        </>
      ) : membership?.status === "requested" ? (
        <>
          <p className="text-sm font-medium">{t("associations.entry.pending", { date: date(membership.requestedAt) })}</p>
          {membership.requestMessage ? <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{t("associations.entry.yourMessage", { message: membership.requestMessage })}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={busy !== null} aria-busy={busy === "cancelled"} onClick={() => void gesture("cancelled", () => props.associations.cancelRequest(props.pageId))}>
              {t(busy === "cancelled" ? "common.pleaseWait" : "associations.cancelRequest")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {membership?.status === "rejected" ? <p className="text-sm">{t("associations.entry.previousRejected")}</p> : null}
          {membership?.status === "removed" ? <p className="text-sm">{t("associations.entry.removed")}</p> : null}
          {membership?.status === "left" ? <p className="text-sm">{t("associations.entry.left")}</p> : null}
          {membership?.decisionReason ? <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{t("associations.reason", { reason: membership.decisionReason })}</p> : null}
          {membership?.status === "removed" && membership.readmissionAllowed ? <p className="text-sm">{t("associations.entry.readmissionAllowed")}</p> : null}
          {canRequest ? (
            <RequestSheet
              associations={props.associations}
              pageId={props.pageId}
              disabled={busy !== null}
              onSent={() => setFeedback({ tone: "status", text: t("associations.feedback.requested") })}
            />
          ) : view.request.refusal === "association_request_too_soon" && view.request.availableAt !== null ? (
            <p className="text-sm text-muted-foreground">{t("associations.entry.tooSoon", { date: date(view.request.availableAt) })}</p>
          ) : refusalLine ? (
            <p className="text-sm text-muted-foreground">{t(refusalLine)}</p>
          ) : null}
        </>
      )}
      <FeedbackLine feedback={feedback} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {view.responsibleRole ? (
          <NextLink href={routes.associationMembers(props.handle)} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline focus-visible:shadow-focus">
            <UsersRoundIcon aria-hidden className="size-4" />{t("associations.entry.manage")}
          </NextLink>
        ) : null}
        {membership ? (
          <NextLink href={routes.myAssociations()} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline focus-visible:shadow-focus">
            <ListChecksIcon aria-hidden className="size-4" />{t("associations.entry.myAssociations")}
          </NextLink>
        ) : null}
      </div>
    </div>
  )
}

const requestSchema = z.object({
  message: z.string().max(ASSOCIATION_REQUEST_MESSAGE_MAX, "association_message_too_long"),
})
type RequestValues = z.infer<typeof requestSchema>

/** La demande : un mot facultatif aux responsables, rien d'autre ; aucune coordonnée demandée. */
function RequestSheet(props: { readonly associations: AssociationsCapability; readonly pageId: string; readonly disabled: boolean; readonly onSent: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  const form = useForm<RequestValues>({ resolver: zodResolver(requestSchema), defaultValues: { message: "" } })
  const busy = form.formState.isSubmitting
  const send = async (values: RequestValues) => {
    setError(null)
    try {
      const result = await props.associations.request({ pageId: props.pageId, message: values.message })
      if (result.ok) {
        setOpen(false)
        form.reset()
        props.onSent()
      } else setError(errorKey(result.code))
    } catch {
      setError(errorKey("unknown"))
    }
  }
  // Un seul envoi à la fois, même sur deux validations rapprochées (Entrée, double clic).
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    void form.handleSubmit(send)(event).finally(() => { sending.current = false })
  }
  const messageError = form.formState.errors.message?.message
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!busy) { setOpen(next); setError(null) } }}>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={props.disabled} onClick={() => setOpen(true)}>{t("associations.entry.request")}</Button>
      </div>
      <SheetContent title={t("associations.requestSheet.title")} description={t("associations.requestSheet.description")} closeLabel={t("common.close")}>
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <Field
            id={`${id}-mot`}
            label={t("associations.requestSheet.message")}
            hint={t("associations.requestSheet.messageHint", { max: ASSOCIATION_REQUEST_MESSAGE_MAX })}
            error={messageError ? t(errorKey(messageError)) : undefined}
          >
            {(field) => (
              <Textarea
                id={field.id}
                aria-describedby={field.describedBy}
                aria-invalid={field.invalid || undefined}
                rows={4}
                maxLength={ASSOCIATION_REQUEST_MESSAGE_MAX}
                disabled={busy}
                {...form.register("message")}
              />
            )}
          </Field>
          <p className="text-[13px] leading-snug text-muted-foreground">{t("associations.requestSheet.free")}</p>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{t(error)}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <SheetClose asChild><Button variant="ghost" disabled={busy}>{t("common.cancel")}</Button></SheetClose>
            <Button type="submit" disabled={busy}>{t(busy ? "common.pleaseWait" : "associations.requestSheet.submit")}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
