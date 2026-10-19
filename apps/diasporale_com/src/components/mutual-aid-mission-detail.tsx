"use client"

/**
 * La fiche d'une mission bénévole (DG-024 a) : l'association qui la porte, la
 * date ou la période dans son fuseau, le lieu approximatif, les places ; pour
 * le lecteur, s'inscrire avec son consentement EXPLICITE (son nom publié montré
 * à l'équipe) ou se retirer ; pour l'équipe vivante de la page, modifier, clore
 * les inscriptions, annuler et lire les bénévoles ; pour qui n'est pas de l'équipe,
 * signaler la mission (G9, chantier « confiance des surfaces »). PROPRIÉTAIRE :
 * chantier « entraide ».
 *
 * Aucune coordonnée n'est montrée ni demandée : l'équipe écrit aux bénévoles
 * par la messagerie, depuis leur profil. L'état de modération (G9) se dit à la
 * seule équipe vivante, par l'avis de modération de la fiche.
 */
import { AID_REASON_MAX_LENGTH, parseAidReason } from "@diasporale/domain"
import { Button, Card, Checkbox, EmptyState, Field, Label, ModerationBanner, Sheet, SheetClose, SheetContent, Textarea, TrustBadge, formatDate } from "@diasporale/features"
import { moderationBannerState, type AidMissionDetailView, type ContentReportTarget, type MutualAidCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, HandHeartIcon, UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useCallback, useId, useRef, useState, type FormEvent } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { type AssociationFeedback, errorKey, FeedbackLine, useGuardedAction } from "./association-parts"
import { AidConfirmButton, AidMissionStatusChip, AidMissionWhen, AidPersonName, AidPlace, aidLinkClass } from "./mutual-aid-parts"
import { AidMissionForm } from "./mutual-aid-mission-form"
import { ReportContentAction, ReportedContent } from "./report-content-sheet"
import { useNow } from "./service-request-ui"
import { ServicePager } from "./service-pager"

const cancelSchema = z.object({ reason: z.string() }).superRefine((values, context) => {
  const parsed = parseAidReason(values.reason)
  if (!parsed.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: parsed.code, path: ["reason"] })
})
type CancelValues = z.infer<typeof cancelSchema>

/** Annuler la mission : un motif facultatif, lu par les inscrits ; terminal. */
function CancelSheet(props: { readonly capability: MutualAidCapability; readonly mission: AidMissionDetailView; readonly onClose: () => void; readonly onDone: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const form = useForm<CancelValues>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: "" } })
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  const busy = form.formState.isSubmitting
  const send = async ({ reason }: CancelValues) => {
    setError(null)
    try {
      const result = await props.capability.cancelMission({ missionId: props.mission.id, expectedVersion: props.mission.version, reason })
      if (result.ok) props.onDone()
      else setError(errorKey(result.code))
    } catch {
      setError(errorKey("unknown"))
    }
  }
  // Une seule annulation à la fois, même sur deux validations rapprochées.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    void form.handleSubmit(send)(event).finally(() => { sending.current = false })
  }
  const reasonError = form.formState.errors.reason?.message
  return (
    <Sheet open onOpenChange={(open) => { if (!open && !busy) props.onClose() }}>
      <SheetContent title={t("mutualAid.mission.cancelSheet.title")} description={t("mutualAid.mission.cancelSheet.description")} closeLabel={t("common.close")}>
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <Field id={`${id}-motif`} label={t("mutualAid.mission.cancelSheet.reason")} hint={t("mutualAid.mission.cancelSheet.reasonHint", { max: AID_REASON_MAX_LENGTH })} error={reasonError ? t(errorKey(reasonError)) : undefined}>
            {(field) => <Textarea id={field.id} rows={3} maxLength={AID_REASON_MAX_LENGTH} disabled={busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("reason")} />}
          </Field>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{t(error)}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <SheetClose asChild><Button variant="ghost" disabled={busy}>{t("mutualAid.mission.cancelSheet.keep")}</Button></SheetClose>
            <Button type="submit" variant="destructive" disabled={busy} aria-busy={busy}>{t(busy ? "common.pleaseWait" : "mutualAid.mission.cancelSheet.confirm")}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** S'inscrire : la case de consentement naît décochée ; sans elle, rien n'est envoyé. */
function SignupForm(props: { readonly capability: MutualAidCapability; readonly mission: AidMissionDetailView; readonly busy: string | null; readonly onGesture: (key: string, done: string, work: () => ReturnType<MutualAidCapability["signUp"]>) => Promise<boolean> }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [consent, setConsent] = useState(false)
  const [missing, setMissing] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!consent) {
      setMissing(true)
      return
    }
    void props.onGesture("signup", "signedUp", () => props.capability.signUp({ missionId: props.mission.id, shareNameWithTeam: true }))
  }
  return (
    <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-consentement`}
          checked={consent}
          onCheckedChange={(checked) => { setConsent(checked === true); setMissing(false) }}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? `${id}-consentement-erreur` : undefined}
          disabled={props.busy !== null}
        />
        <Label htmlFor={`${id}-consentement`} className="font-normal leading-snug">{t("mutualAid.signup.consent", { page: props.mission.page.name })}</Label>
      </div>
      {missing ? <p id={`${id}-consentement-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{t(errorKey("aid_signup_consent_required"))}</p> : null}
      <div>
        <Button type="submit" disabled={props.busy !== null} aria-busy={props.busy === "signup"}>{t(props.busy === "signup" ? "common.pleaseWait" : "mutualAid.signup.submit")}</Button>
      </div>
    </form>
  )
}

function Volunteers(props: { readonly capability: MutualAidCapability; readonly missionId: string }) {
  const { t, locale } = useDiasporaleT()
  return (
    <ServicePager
      read={(cursor) => props.capability.useVolunteers({ missionId: props.missionId, cursor })}
      keyOf={(volunteer) => volunteer.id}
      empty={<EmptyState icon={<UsersRoundIcon />} title={t("mutualAid.volunteers.emptyTitle")} description={t("mutualAid.volunteers.emptyBody")} />}
    >
      {(volunteers) => (
        <ul className="flex min-w-0 flex-col gap-2">
          {volunteers.map((volunteer) => (
            <li key={volunteer.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2">
              <AidPersonName person={volunteer.person} />
              <span className="text-[13px] text-muted-foreground">{t("mutualAid.volunteers.since", { date: formatDate(volunteer.signedUpAt, locale) })}</span>
            </li>
          ))}
        </ul>
      )}
    </ServicePager>
  )
}

export function AidMissionDetail(props: { readonly capability: MutualAidCapability; readonly mission: AidMissionDetailView }) {
  const { t } = useDiasporaleT()
  const { capability, mission } = props
  const now = useNow()
  const { busy, run } = useGuardedAction()
  const [feedback, setFeedback] = useState<AssociationFeedback | null>(null)
  const [dialog, setDialog] = useState<"edit" | "cancel" | null>(null)
  const announcer = useRef<HTMLDivElement>(null)
  const live = mission.status === "open" || mission.status === "full"
  const remaining = Math.max(0, mission.places - mission.signupCount)
  // G9 : l'avis de modération, à l'équipe seule. En relecture ou retirée, la mission ne se sert qu'à elle :
  // personne ne s'y inscrit ; retirée, elle ne se modifie plus (clore, annuler et se retirer restent possibles).
  const banner = mission.canManage ? moderationBannerState(mission.moderation) : null
  const editable = live && banner !== "rejected"

  const gesture = useCallback(async (key: string, done: string, work: () => ReturnType<MutualAidCapability["signUp"]>): Promise<boolean> => {
    setFeedback(null)
    const result = await run(key, work)
    if (!result) return false
    setFeedback(result.ok ? { tone: "status", text: t(`mutualAid.feedback.${done}`) } : { tone: "alert", text: t(errorKey(result.code)) })
    if (result.ok) announcer.current?.focus()
    return result.ok
  }, [run, t])

  const done = (kind: "missionSaved" | "missionCancelled") => {
    setDialog(null)
    setFeedback({ tone: "status", text: t(`mutualAid.feedback.${kind}`) })
    announcer.current?.focus()
  }

  // G9 : une mission d'une autre page se signale ; signalée, la fiche entière est masquée pour la personne.
  const reportTarget: ContentReportTarget = { kind: "diasporaAidMission", id: mission.id }
  const article = (
    <article className="flex min-w-0 flex-col gap-5" aria-labelledby="mission-entraide">
      <NextLink href={routes.mutualAid(mission.country, mission.city)} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline focus-visible:shadow-focus">
        <ArrowLeftIcon aria-hidden className="size-4" />{t("mutualAid.backToList")}
      </NextLink>
      <header className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AidMissionStatusChip status={mission.status} startsAt={mission.startsAt} endsAt={mission.endsAt} now={now} />
          {mission.signedUp ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-medium">{t("mutualAid.mission.signedUp")}</span> : null}
        </div>
        <h1 id="mission-entraide" className="break-words font-display text-3xl font-bold leading-tight">{mission.title}</h1>
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("mutualAid.mission.by")}</span>
          <NextLink href={routes.page(mission.page.handle)} className={aidLinkClass}>{mission.page.name}</NextLink>
          <TrustBadge badge={mission.page.badge} />
        </p>
      </header>
      {banner !== null ? <ModerationBanner state={banner} /> : null}

      <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
        <dl className="grid min-w-0 grid-cols-1 gap-3 text-[15px] sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="font-medium text-muted-foreground">{t("mutualAid.mission.when")}</dt>
          <dd className="min-w-0"><AidMissionWhen startsAt={mission.startsAt} endsAt={mission.endsAt} timeZone={mission.timeZone} /></dd>
          <dt className="font-medium text-muted-foreground">{t("mutualAid.mission.where")}</dt>
          <dd className="min-w-0"><AidPlace country={mission.country} city={mission.city} area={mission.area} /></dd>
          <dt className="font-medium text-muted-foreground">{t("mutualAid.mission.placesLabel")}</dt>
          <dd className="min-w-0">
            {t("mutualAid.mission.places", { count: mission.places, taken: mission.signupCount })}
            {live ? <span className="block text-[13px] text-muted-foreground">{t("mutualAid.mission.remaining", { count: remaining })}</span> : null}
          </dd>
        </dl>
      </Card>

      {mission.status === "cancelled" ? (
        <p role="note" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {mission.cancelReason ? t("mutualAid.mission.cancelledWithReason", { reason: mission.cancelReason }) : t("mutualAid.mission.cancelled")}
        </p>
      ) : null}

      <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{mission.description}</p>

      <div ref={announcer} tabIndex={-1} className="min-w-0 rounded-md focus-visible:shadow-focus">
        <FeedbackLine feedback={dialog ? null : feedback} />
      </div>

      {/* En relecture ou retirée (avis ci-dessus), personne ne s'inscrit ; un membre déjà inscrit garde son retrait. */}
      {mission.signedUp || banner === null ? (
        <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><HandHeartIcon aria-hidden className="size-5" />{t("mutualAid.signup.title")}</h2>
          {mission.signedUp ? (
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-sm">{t("mutualAid.signup.registered", { page: mission.page.name })}</p>
              {/* Une fois la mission commencée, le retrait est fermé (règle du domaine) : aucun bouton qu'un refus attend. */}
              {now < mission.startsAt ? (
                <div>
                  <AidConfirmButton
                    label={t("mutualAid.signup.withdraw")}
                    title={t("mutualAid.signup.withdrawConfirm.title")}
                    body={t("mutualAid.signup.withdrawConfirm.body")}
                    confirmLabel={t("mutualAid.signup.withdrawConfirm.confirm")}
                    busy={busy !== null}
                    onConfirm={() => gesture("withdraw", "signupWithdrawn", () => capability.withdrawSignup(mission.id))}
                  />
                </div>
              ) : null}
            </div>
          ) : mission.signup.allowed ? (
            <SignupForm capability={capability} mission={mission} busy={busy} onGesture={gesture} />
          ) : (
            <p className="text-sm text-muted-foreground">{t(errorKey(mission.signup.refusal ?? "unknown"))}</p>
          )}
          <p className="text-[13px] text-muted-foreground">{t("mutualAid.signup.privacy")}</p>
        </Card>
      ) : null}

      {mission.canManage ? (
        <section aria-labelledby="equipe-mission" className="flex min-w-0 flex-col gap-4">
          <h2 id="equipe-mission" className="text-lg font-semibold">{t("mutualAid.team.title")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {editable ? <Button variant="outline" disabled={busy !== null} onClick={() => setDialog("edit")}>{t("mutualAid.team.edit")}</Button> : null}
            {live ? (
              <AidConfirmButton
                label={t("mutualAid.team.close")}
                title={t("mutualAid.team.closeConfirm.title")}
                body={t("mutualAid.team.closeConfirm.body")}
                confirmLabel={t("mutualAid.team.closeConfirm.confirm")}
                busy={busy !== null}
                onConfirm={() => gesture("close", "missionClosed", () => capability.closeMission({ missionId: mission.id, expectedVersion: mission.version }))}
              />
            ) : null}
            {mission.status !== "cancelled" ? (
              <Button variant="ghost" className="text-destructive" disabled={busy !== null} onClick={() => setDialog("cancel")}>{t("mutualAid.team.cancel")}</Button>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="font-semibold">{t("mutualAid.volunteers.title")}</h3>
            <p className="text-[13px] text-muted-foreground">{t("mutualAid.volunteers.lead")}</p>
            <Volunteers capability={capability} missionId={mission.id} />
          </div>
        </section>
      ) : (
        <ReportContentAction target={reportTarget} className="self-start" />
      )}

      {dialog === "edit" ? (
        <Sheet open onOpenChange={(open) => { if (!open) setDialog(null) }}>
          <SheetContent title={t("mutualAid.team.editTitle")} description={t("mutualAid.team.editDescription")} closeLabel={t("common.close")}>
            <AidMissionForm
              capability={capability}
              pages={[]}
              initial={mission}
              defaultCountry={mission.country}
              onSaved={() => done("missionSaved")}
              onCancel={() => setDialog(null)}
            />
          </SheetContent>
        </Sheet>
      ) : null}
      {dialog === "cancel" ? <CancelSheet capability={capability} mission={mission} onClose={() => setDialog(null)} onDone={() => done("missionCancelled")} /> : null}
    </article>
  )
  return <ReportedContent target={reportTarget} back={{ href: routes.mutualAid(mission.country, mission.city), label: t("mutualAid.backToList") }}>{article}</ReportedContent>
}
